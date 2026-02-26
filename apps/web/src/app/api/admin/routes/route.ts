import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";

const postSchema = z.object({
  pickupCycleId: z.string().uuid(),
  zoneCode: z.string().default("knoxville-37922"),
});

export async function GET() {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await ctx.supabase
    .from("routes")
    .select("id,status,created_at,pickup_cycle_id,driver_id,drivers(employee_id),pickup_cycles(pickup_date)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ routes: data ?? [] });
}

export async function POST(request: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const { data: zone, error: zoneError } = await ctx.supabase
    .from("service_zones")
    .select("id")
    .eq("code", parsed.data.zoneCode)
    .maybeSingle();

  if (zoneError || !zone) return NextResponse.json({ error: "Zone not found" }, { status: 404 });

  const { data: route, error: routeError } = await ctx.supabase
    .from("routes")
    .insert({
      zone_id: zone.id,
      pickup_cycle_id: parsed.data.pickupCycleId,
      status: "draft",
    })
    .select("id")
    .single();

  if (routeError || !route) return NextResponse.json({ error: routeError?.message ?? "Route create failed" }, { status: 500 });

  const { data: requests, error: requestsError } = await ctx.supabase
    .from("pickup_requests")
    .select("id")
    .eq("pickup_cycle_id", parsed.data.pickupCycleId)
    .eq("status", "requested")
    .order("created_at", { ascending: true });

  if (requestsError) return NextResponse.json({ error: requestsError.message }, { status: 500 });

  if ((requests ?? []).length > 0) {
    const stops = requests!.map((requestItem, index) => ({
      route_id: route.id,
      pickup_request_id: requestItem.id,
      stop_order: index + 1,
      status: "scheduled",
    }));
    const { error: stopsError } = await ctx.supabase.from("pickup_stops").insert(stops);
    if (stopsError) return NextResponse.json({ error: stopsError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, routeId: route.id, stopCount: requests?.length ?? 0 });
}
