import { NextResponse } from "next/server";
import { z } from "zod";
import { canManagePartnerSchedule } from "@/lib/access";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { geocodeAddress } from "@/lib/geocode";
import { userCanAccessPartner } from "@/lib/partner-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  pickupCycleId: z.string().uuid(),
});

export async function POST(request: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManagePartnerSchedule(ctx.partnerRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: cycleRow, error: cycleError } = await supabaseAdmin
    .from("pickup_cycles")
    .select("id,zone_id,service_zones!inner(id,center_lat,center_lng,operation_model,partner_id)")
    .eq("id", parsed.data.pickupCycleId)
    .maybeSingle();

  if (cycleError || !cycleRow) return NextResponse.json({ error: cycleError?.message ?? "Pickup cycle not found" }, { status: 404 });
  const zone = Array.isArray(cycleRow.service_zones) ? cycleRow.service_zones[0] : cycleRow.service_zones;
  if (!zone?.partner_id || zone.operation_model !== "partner_operated") {
    return NextResponse.json({ error: "This pickup cycle is not managed by a partner team" }, { status: 403 });
  }

  const canAccess = await userCanAccessPartner({
    supabase: ctx.supabase,
    userId: ctx.profile.id,
    partnerId: zone.partner_id,
  });
  if (!canAccess) return NextResponse.json({ error: "This pickup cycle is not assigned to your nonprofit" }, { status: 403 });

  const { data: existingRoutes, error: existingRoutesError } = await supabaseAdmin
    .from("routes")
    .select("id,status,driver_id")
    .eq("zone_id", cycleRow.zone_id)
    .eq("pickup_cycle_id", parsed.data.pickupCycleId)
    .order("created_at", { ascending: false });
  if (existingRoutesError) return NextResponse.json({ error: existingRoutesError.message }, { status: 500 });

  const existingRoute = existingRoutes?.[0] ?? null;
  const duplicateRouteIds = (existingRoutes ?? [])
    .slice(1)
    .filter((route) => route.status !== "completed")
    .map((route) => route.id);
  if (duplicateRouteIds.length > 0) {
    await supabaseAdmin.from("pickup_stops").delete().in("route_id", duplicateRouteIds);
    await supabaseAdmin.from("routes").update({ status: "canceled", driver_id: null }).in("id", duplicateRouteIds);
  }

  let route: { id: string; driver_id: string | null };
  if (existingRoute) {
    route = { id: existingRoute.id, driver_id: existingRoute.driver_id };
  } else {
    const { data: createdRoute, error: createRouteError } = await supabaseAdmin
      .from("routes")
      .insert({
        zone_id: cycleRow.zone_id,
        pickup_cycle_id: parsed.data.pickupCycleId,
        status: "draft",
        partner_id: zone.partner_id,
        fulfillment_mode: "partner_team",
        partner_visible: true,
      })
      .select("id,driver_id")
      .single();
    if (createRouteError || !createdRoute) {
      return NextResponse.json({ error: createRouteError?.message ?? "Route create failed" }, { status: 500 });
    }
    route = createdRoute;
  }

  const { data: requests, error: requestsError } = await supabaseAdmin
    .from("pickup_requests")
    .select("id,user_id,created_at")
    .eq("pickup_cycle_id", parsed.data.pickupCycleId)
    .in("status", ["requested", "confirmed"])
    .order("created_at", { ascending: true });
  if (requestsError) return NextResponse.json({ error: requestsError.message }, { status: 500 });

  if ((requests ?? []).length === 0) {
    await supabaseAdmin.from("pickup_stops").delete().eq("route_id", route.id);
    await supabaseAdmin
      .from("routes")
      .update({
        status: route.driver_id ? "assigned" : "draft",
        driver_id: route.driver_id ?? null,
        partner_id: zone.partner_id,
        fulfillment_mode: "partner_team",
        partner_visible: true,
      })
      .eq("id", route.id);

    return NextResponse.json({
      ok: true,
      routeId: route.id,
      stopCount: 0,
      regenerated: Boolean(existingRoute),
      missingCoordinates: 0,
      optimized: false,
    });
  }

  const requestRows = requests ?? [];
  const userIds = requestRows.map((row) => row.user_id);
  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from("zone_memberships")
    .select("user_id,status")
    .eq("zone_id", cycleRow.zone_id)
    .in("user_id", userIds);
  if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 });

  const eligibleUserSet = new Set((memberships ?? []).filter((row) => row.status === "active").map((row) => row.user_id));
  const filteredRequests = requestRows.filter((row) => eligibleUserSet.has(row.user_id));

  type AddressRow = {
    user_id: string;
    address_line1: string;
    city: string;
    state: string;
    postal_code: string;
    lat: number | null;
    lng: number | null;
    created_at: string;
  };

  const { data: addresses, error: addressesError } = await supabaseAdmin
    .from("addresses")
    .select("user_id,address_line1,city,state,postal_code,lat,lng,created_at")
    .in("user_id", Array.from(eligibleUserSet))
    .order("created_at", { ascending: false });
  if (addressesError) return NextResponse.json({ error: addressesError.message }, { status: 500 });

  const addressByUserId = new Map<string, AddressRow>();
  for (const address of addresses ?? []) {
    if (!addressByUserId.has(address.user_id)) {
      addressByUserId.set(address.user_id, address as AddressRow);
    }
  }

  const stopsWithCoords: Array<{ requestId: string; lat: number; lng: number; createdAt: string }> = [];
  const stopsWithoutCoords: Array<{ requestId: string; createdAt: string }> = [];

  for (const requestRow of filteredRequests) {
    const address = addressByUserId.get(requestRow.user_id);
    if (!address) {
      stopsWithoutCoords.push({ requestId: requestRow.id, createdAt: requestRow.created_at });
      continue;
    }

    let lat = address.lat;
    let lng = address.lng;
    if (lat == null || lng == null) {
      const geocoded = await geocodeAddress({
        addressLine1: address.address_line1,
        city: address.city,
        state: address.state,
        postalCode: address.postal_code,
      });
      if (geocoded) {
        lat = geocoded.lat;
        lng = geocoded.lng;
        await supabaseAdmin
          .from("addresses")
          .update({ lat, lng })
          .eq("user_id", address.user_id)
          .eq("address_line1", address.address_line1)
          .eq("postal_code", address.postal_code);
      }
    }

    if (lat == null || lng == null) {
      stopsWithoutCoords.push({ requestId: requestRow.id, createdAt: requestRow.created_at });
    } else {
      stopsWithCoords.push({ requestId: requestRow.id, lat, lng, createdAt: requestRow.created_at });
    }
  }

  let orderedRequestIds = stopsWithCoords.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((stop) => stop.requestId);
  const canOptimize =
    stopsWithCoords.length > 1 &&
    zone.center_lat != null &&
    zone.center_lng != null &&
    Boolean(process.env.GOOGLE_PLACES_API_KEY);

  if (canOptimize) {
    try {
      const origin = `${zone.center_lat},${zone.center_lng}`;
      const destination = origin;
      const waypoints = `optimize:true|${stopsWithCoords.map((stop) => `${stop.lat},${stop.lng}`).join("|")}`;
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
      const directionsResponse = await fetch(url, { cache: "no-store" });
      const directionsJson = (await directionsResponse.json()) as { status?: string; routes?: Array<{ waypoint_order?: number[] }> };
      const waypointOrder = directionsJson.routes?.[0]?.waypoint_order ?? [];
      if (directionsJson.status === "OK" && waypointOrder.length === stopsWithCoords.length) {
        orderedRequestIds = waypointOrder.map((index) => stopsWithCoords[index]?.requestId).filter(Boolean) as string[];
      }
    } catch {
      // Fall back to created-at ordering.
    }
  }

  const remainder = stopsWithoutCoords.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((stop) => stop.requestId);
  const finalOrder = [...orderedRequestIds, ...remainder];
  const stops = finalOrder.map((requestId, index) => ({
    route_id: route.id,
    pickup_request_id: requestId,
    stop_order: index + 1,
    status: "scheduled",
  }));

  const { error: deleteStopsError } = await supabaseAdmin.from("pickup_stops").delete().eq("route_id", route.id);
  if (deleteStopsError) return NextResponse.json({ error: deleteStopsError.message }, { status: 500 });
  if (stops.length > 0) {
    const { error: insertStopsError } = await supabaseAdmin.from("pickup_stops").insert(stops);
    if (insertStopsError) return NextResponse.json({ error: insertStopsError.message }, { status: 500 });
  }

  await supabaseAdmin
    .from("routes")
    .update({
      status: route.driver_id ? "assigned" : "draft",
      driver_id: route.driver_id ?? null,
      partner_id: zone.partner_id,
      fulfillment_mode: "partner_team",
      partner_visible: true,
    })
    .eq("id", route.id);

  return NextResponse.json({
    ok: true,
    routeId: route.id,
    stopCount: finalOrder.length,
    regenerated: Boolean(existingRoute),
    missingCoordinates: remainder.length,
    optimized: canOptimize,
  });
}
