import { NextResponse } from "next/server";
import { z } from "zod";
import { canManagePartnerSchedule } from "@/lib/access";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { apiLimiter } from "@/lib/rate-limit";
import { userCanAccessPartner } from "@/lib/partner-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  routeId: z.string().uuid(),
  driverId: z.string().uuid(),
});

export async function POST(request: Request) {
  const limited = apiLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManagePartnerSchedule(ctx.partnerRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: route, error: routeError } = await supabaseAdmin
    .from("routes")
    .select("id,partner_id,fulfillment_mode")
    .eq("id", parsed.data.routeId)
    .maybeSingle();

  if (routeError || !route) return NextResponse.json({ error: routeError?.message ?? "Route not found" }, { status: 404 });
  if (!route.partner_id || route.fulfillment_mode !== "partner_team") {
    return NextResponse.json({ error: "This route is not managed by a partner team" }, { status: 403 });
  }

  const canAccess = await userCanAccessPartner({
    supabase: ctx.supabase,
    userId: ctx.profile.id,
    partnerId: route.partner_id,
  });
  if (!canAccess) return NextResponse.json({ error: "This route is not assigned to your nonprofit" }, { status: 403 });

  const [{ data: driver, error: driverError }, { count: stopCount, error: stopCountError }] = await Promise.all([
    supabaseAdmin
      .from("drivers")
      .select("id,active,user_id")
      .eq("id", parsed.data.driverId)
      .maybeSingle(),
    supabaseAdmin
      .from("pickup_stops")
      .select("id", { count: "exact", head: true })
      .eq("route_id", parsed.data.routeId),
  ]);

  if (driverError || !driver) return NextResponse.json({ error: driverError?.message ?? "Driver not found" }, { status: 404 });
  if (!driver.active) return NextResponse.json({ error: "Selected driver is inactive" }, { status: 409 });
  if (stopCountError) return NextResponse.json({ error: stopCountError.message }, { status: 500 });
  if ((stopCount ?? 0) === 0) return NextResponse.json({ error: "Build the route before assigning a driver" }, { status: 409 });

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("partner_memberships")
    .select("role,active")
    .eq("partner_id", route.partner_id)
    .eq("user_id", driver.user_id)
    .maybeSingle();

  if (membershipError || !membership?.active) {
    return NextResponse.json({ error: membershipError?.message ?? "Selected driver is not active in this organization" }, { status: 403 });
  }
  if (!["partner_coordinator", "partner_driver"].includes(membership.role)) {
    return NextResponse.json({ error: "Only coordinators and drivers can be assigned to routes" }, { status: 403 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("routes")
    .update({ driver_id: parsed.data.driverId, status: "assigned" })
    .eq("id", parsed.data.routeId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
