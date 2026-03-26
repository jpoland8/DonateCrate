import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { sendPartnerDonationReceipt } from "@/lib/partner-donation-receipt";
import { userCanAccessPartner } from "@/lib/partner-access";
import { deriveRouteStatus, isResolvedStopStatus } from "@/lib/route-status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  status: z.enum(["picked_up", "not_ready", "no_access", "rescheduled", "scheduled"]),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ stopId: string }> },
) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    ctx.profile.role !== "admin" &&
    ctx.profile.role !== "driver" &&
    !ctx.partnerRole
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { stopId } = await context.params;
  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const supabaseAdmin = createSupabaseAdminClient();

  const { data: stop, error: stopError } = await ctx.supabase
    .from("pickup_stops")
    .select("id,route_id,pickup_request_id,status")
    .eq("id", stopId)
    .maybeSingle();

  if (stopError || !stop) return NextResponse.json({ error: "Stop not found" }, { status: 404 });

  const { data: route, error: routeError } = await ctx.supabase
    .from("routes")
    .select("id,driver_id,status,partner_id,fulfillment_mode")
    .eq("id", stop.route_id)
    .maybeSingle();

  if (routeError || !route) return NextResponse.json({ error: "Route not found" }, { status: 404 });

  if (ctx.profile.role === "driver") {
    const { data: driver } = await ctx.supabase
      .from("drivers")
      .select("id")
      .eq("user_id", ctx.profile.id)
      .maybeSingle();

    if (!driver || route.driver_id !== driver.id) {
      return NextResponse.json({ error: "This stop is not assigned to the current driver" }, { status: 403 });
    }
  }

  if (ctx.partnerRole) {
    if (route.fulfillment_mode !== "partner_team") {
      return NextResponse.json({ error: "This route is not managed by a partner team" }, { status: 403 });
    }

    const canAccess = await userCanAccessPartner({
      supabase: ctx.supabase,
      userId: ctx.profile.id,
      partnerId: route.partner_id,
    });
    if (!canAccess) {
      return NextResponse.json({ error: "This stop is not assigned to your nonprofit" }, { status: 403 });
    }

    if (ctx.partnerRole === "partner_driver") {
      const { data: driverProfile, error: driverProfileError } = await ctx.supabase
        .from("drivers")
        .select("id,active")
        .eq("user_id", ctx.profile.id)
        .maybeSingle();

      if (driverProfileError || !driverProfile?.active) {
        return NextResponse.json({ error: "This driver does not have an active route profile" }, { status: 403 });
      }
      if (route.driver_id !== driverProfile.id) {
        return NextResponse.json({ error: "This stop is not assigned to the current partner driver" }, { status: 403 });
      }
    }
  }

  const nextStatus = parsed.data.status;
  const updatedAt = new Date().toISOString();
  const wasPickedUp = stop.status === "picked_up";

  const { data: updatedStopRows, error: updateStopError } = await supabaseAdmin
    .from("pickup_stops")
    .update({
      status: nextStatus,
      completed_at: nextStatus === "scheduled" ? null : updatedAt,
    })
    .eq("id", stop.id)
    .select("id,status")
    .limit(1);

  if (updateStopError) return NextResponse.json({ error: updateStopError.message }, { status: 500 });
  const updatedStop = updatedStopRows?.[0] ?? null;

  if (nextStatus === "picked_up" || nextStatus === "not_ready" || nextStatus === "no_access") {
    const pickupRequestUpdate =
      nextStatus === "picked_up"
        ? { status: "picked_up", note: null }
        : nextStatus === "not_ready"
          ? { status: "not_ready", note: "Driver marked stop as not ready" }
          : { status: "missed", note: "Driver marked stop as no access" };

    await supabaseAdmin
      .from("pickup_requests")
      .update({
        ...pickupRequestUpdate,
        updated_at: updatedAt,
      })
      .eq("id", stop.pickup_request_id);
  } else if (nextStatus === "rescheduled") {
    await supabaseAdmin
      .from("pickup_requests")
      .update({
        note: "Driver marked stop for reschedule review",
        updated_at: updatedAt,
      })
      .eq("id", stop.pickup_request_id);
  } else if (nextStatus === "scheduled") {
    await supabaseAdmin
      .from("pickup_requests")
      .update({
        status: "requested",
        note: null,
        updated_at: updatedAt,
      })
      .eq("id", stop.pickup_request_id);
  }

  const { data: routeStops } = await ctx.supabase
    .from("pickup_stops")
    .select("status")
    .eq("route_id", route.id);

  const routeStatus = deriveRouteStatus({
    driverId: route.driver_id ?? null,
    stopStatuses: (routeStops ?? []).map((item) => item.status),
  });

  await supabaseAdmin.from("routes").update({ status: routeStatus }).eq("id", route.id);

  const allResolved = (routeStops ?? []).length > 0 && (routeStops ?? []).every((item) => isResolvedStopStatus(item.status));

  if (nextStatus === "picked_up" && !wasPickedUp && route.partner_id) {
    await sendPartnerDonationReceipt({
      supabase: supabaseAdmin,
      pickupRequestId: stop.pickup_request_id,
      partnerId: route.partner_id,
      donationDate: null,
    }).catch(() => null);
  }

  return NextResponse.json({
    ok: true,
    stop: updatedStop,
    routeStatus,
    allResolved,
  });
}
