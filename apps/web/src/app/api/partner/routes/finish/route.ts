import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { userCanAccessPartner } from "@/lib/partner-access";
import { isResolvedStopStatus } from "@/lib/route-status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  routeId: z.string().uuid(),
});

export async function POST(request: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ctx.partnerRole) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: route, error: routeError } = await supabaseAdmin
    .from("routes")
    .select("id,driver_id,partner_id,fulfillment_mode")
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
  if (!canAccess) {
    return NextResponse.json({ error: "This route is not assigned to your nonprofit" }, { status: 403 });
  }

  if (ctx.partnerRole === "partner_driver") {
    const { data: driverProfile, error: driverError } = await supabaseAdmin
      .from("drivers")
      .select("id,active")
      .eq("user_id", ctx.profile.id)
      .maybeSingle();

    if (driverError || !driverProfile?.active || driverProfile.id !== route.driver_id) {
      return NextResponse.json({ error: "This route is not assigned to the current partner driver" }, { status: 403 });
    }
  }

  const { data: stops, error: stopsError } = await supabaseAdmin
    .from("pickup_stops")
    .select("id,status")
    .eq("route_id", route.id);

  if (stopsError) return NextResponse.json({ error: stopsError.message }, { status: 500 });
  if (!(stops ?? []).length) {
    return NextResponse.json({ error: "Build the route before finishing it" }, { status: 409 });
  }

  const unresolvedCount = (stops ?? []).filter((stop) => !isResolvedStopStatus(stop.status)).length;
  if (unresolvedCount > 0) {
    return NextResponse.json({ error: "Every stop must be marked before the route can be finished" }, { status: 409 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("routes")
    .update({ status: "completed" })
    .eq("id", route.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true, routeStatus: "completed" });
}
