import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { adminLimiter } from "@/lib/rate-limit";

const patchSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(["requested", "skipped", "confirmed", "picked_up", "not_ready", "missed"]),
});

export async function GET(request: Request) {
  const limited = adminLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status") ?? "";
  const cycleId = url.searchParams.get("cycleId") ?? "";
  const { page, pageSize, from, to } = parsePagination(request, { pageSize: 50 });

  let query = ctx.supabase
    .from("pickup_requests")
    .select(
      "id,status,updated_at,user_id,pickup_cycle_id,users!inner(email,full_name),pickup_cycles!inner(pickup_date)",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }
  if (cycleId) {
    query = query.eq("pickup_cycle_id", cycleId);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const paginated = paginatedResponse(data ?? [], count ?? 0, { page, pageSize });
  return NextResponse.json({ pickupRequests: data ?? [], ...paginated });
}

export async function PATCH(request: Request) {
  const limited = adminLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const { error } = await ctx.supabase
    .from("pickup_requests")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.requestId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
