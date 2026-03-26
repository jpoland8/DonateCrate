import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
  search: z.string().optional(),
  role: z.enum(["all", "customer", "driver", "admin", "partner_admin", "partner_coordinator", "partner_driver"]).default("all"),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ zoneId: string }> },
) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { zoneId } = await params;
  if (!zoneId) return NextResponse.json({ error: "Missing zone id" }, { status: 400 });

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    page: url.searchParams.get("page") ?? "1",
    pageSize: url.searchParams.get("pageSize") ?? "12",
    search: url.searchParams.get("search") ?? undefined,
    role: url.searchParams.get("role") ?? "all",
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid query params" }, { status: 400 });

  const { page, pageSize, search, role } = parsed.data;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = ctx.supabase
    .from("users")
    .select(
      "id,email,full_name,phone,role,addresses(address_line1,city,state,postal_code,created_at),zone_memberships!inner(zone_id,status)",
      { count: "exact" },
    )
    .eq("zone_memberships.zone_id", zoneId)
    .eq("zone_memberships.status", "active")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (role !== "all") query = query.eq("role", role);
  if (search && search.trim().length > 0) {
    const q = search.trim();
    query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const members = (data ?? []).map((row) => {
    const addresses = Array.isArray(row.addresses) ? row.addresses : [];
    const primaryAddress = addresses[0] ?? null;
    return {
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      phone: row.phone,
      role: row.role,
      primary_address: primaryAddress
        ? {
            address_line1: primaryAddress.address_line1,
            city: primaryAddress.city,
            state: primaryAddress.state,
            postal_code: primaryAddress.postal_code,
          }
        : null,
    };
  });

  return NextResponse.json({
    members,
    pagination: {
      page,
      pageSize,
      total: count ?? 0,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
    },
  });
}
