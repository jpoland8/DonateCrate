import { NextResponse } from "next/server";
import { z } from "zod";
import { GLOBAL_APP_ROLES } from "@/lib/access";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { adminLimiter } from "@/lib/rate-limit";

const patchSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(GLOBAL_APP_ROLES),
});

export async function GET(request: Request) {
  const limited = adminLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim().toLowerCase() ?? "";
  const { page, pageSize, from, to } = parsePagination(request, { pageSize: 50, maxPageSize: 200 });

  let query = ctx.supabase
    .from("users")
    .select(
      "id,email,full_name,phone,role,created_at,addresses(address_line1,city,state,postal_code,created_at),zone_memberships(status,service_zones(id,code,name))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const users = (data ?? []).map((row) => {
    const addresses = Array.isArray(row.addresses) ? row.addresses : [];
    const zoneMemberships = Array.isArray(row.zone_memberships) ? row.zone_memberships : [];
    const primaryAddress = addresses[0] ?? null;
    const zones = zoneMemberships
      .map((membership) => {
        const zoneRaw = Array.isArray(membership.service_zones)
          ? membership.service_zones[0]
          : membership.service_zones;
        if (!zoneRaw || typeof zoneRaw !== "object") return null;
        if (!("id" in zoneRaw) || !("code" in zoneRaw) || !("name" in zoneRaw)) return null;
        return {
          id: String(zoneRaw.id),
          code: String(zoneRaw.code),
          name: String(zoneRaw.name),
          membershipStatus: String(membership.status ?? "active"),
        };
      })
      .filter((item): item is { id: string; code: string; name: string; membershipStatus: string } => Boolean(item));

    return {
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      phone: row.phone,
      role: row.role,
      created_at: row.created_at,
      primary_address: primaryAddress
        ? {
            address_line1: primaryAddress.address_line1,
            city: primaryAddress.city,
            state: primaryAddress.state,
            postal_code: primaryAddress.postal_code,
          }
        : null,
      zones,
    };
  });

  // Return both paginated format and legacy `users` key for backward compat
  const paginated = paginatedResponse(users, count ?? 0, { page, pageSize });
  return NextResponse.json({ users, ...paginated });
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
    .from("users")
    .update({ role: parsed.data.role, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
