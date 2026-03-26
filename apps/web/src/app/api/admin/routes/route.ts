import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { geocodeAddress } from "@/lib/geocode";

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
    .select("id,status,created_at,pickup_cycle_id,zone_id,driver_id,drivers(employee_id),pickup_cycles(pickup_date)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const routeIds = (data ?? []).map((route) => route.id);
  const { data: stops } =
    routeIds.length > 0
      ? await ctx.supabase.from("pickup_stops").select("route_id").in("route_id", routeIds)
      : { data: [] as Array<{ route_id: string }> };

  const stopCountByRouteId = new Map<string, number>();
  for (const stop of stops ?? []) {
    stopCountByRouteId.set(stop.route_id, (stopCountByRouteId.get(stop.route_id) ?? 0) + 1);
  }

  return NextResponse.json({
    routes: (data ?? []).map((route) => ({
      ...route,
      stopCount: stopCountByRouteId.get(route.id) ?? 0,
    })),
  });
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
    .select("id,center_lat,center_lng,operation_model,partner_id")
    .eq("code", parsed.data.zoneCode)
    .maybeSingle();

  if (zoneError || !zone) return NextResponse.json({ error: "Zone not found" }, { status: 404 });

  const { data: existingRoutes, error: existingRoutesError } = await ctx.supabase
    .from("routes")
    .select("id,status,driver_id,partner_id,fulfillment_mode")
    .eq("zone_id", zone.id)
    .eq("pickup_cycle_id", parsed.data.pickupCycleId)
    .order("created_at", { ascending: false })
  if (existingRoutesError) return NextResponse.json({ error: existingRoutesError.message }, { status: 500 });

  const existingRoute = existingRoutes?.[0] ?? null;
  const duplicateRouteIds = (existingRoutes ?? [])
    .slice(1)
    .filter((route) => route.status !== "completed")
    .map((route) => route.id);
  if (duplicateRouteIds.length > 0) {
    await ctx.supabase.from("pickup_stops").delete().in("route_id", duplicateRouteIds);
    await ctx.supabase
      .from("routes")
      .update({ status: "canceled", driver_id: null })
      .in("id", duplicateRouteIds);
  }

  const fulfillmentMode = zone.operation_model === "partner_operated" && zone.partner_id ? "partner_team" : "employee_driver";

  const route = existingRoute
    ? { id: existingRoute.id }
    : await ctx.supabase
        .from("routes")
        .insert({
          zone_id: zone.id,
          pickup_cycle_id: parsed.data.pickupCycleId,
          status: "draft",
          partner_id: zone.partner_id ?? null,
          fulfillment_mode: fulfillmentMode,
          partner_visible: fulfillmentMode === "partner_team",
        })
        .select("id")
        .single()
        .then(({ data, error }) => {
          if (error || !data) throw new Error(error?.message ?? "Route create failed");
          return data;
        });
  if (!route?.id) return NextResponse.json({ error: "Route create failed" }, { status: 500 });

  const { data: requests, error: requestsError } = await ctx.supabase
    .from("pickup_requests")
    .select("id,user_id,created_at")
    .eq("pickup_cycle_id", parsed.data.pickupCycleId)
    .in("status", ["requested", "confirmed"])
    .order("created_at", { ascending: true });

  if (requestsError) return NextResponse.json({ error: requestsError.message }, { status: 500 });

  if ((requests ?? []).length > 0) {
    const requestRows = requests ?? [];
    const userIds = requestRows.map((row) => row.user_id);
    const { data: memberships, error: membershipError } = await ctx.supabase
      .from("zone_memberships")
      .select("user_id,status")
      .eq("zone_id", zone.id)
      .in("user_id", userIds);
    if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 });

    const eligibleUserSet = new Set(
      (memberships ?? []).filter((row) => row.status === "active").map((row) => row.user_id),
    );
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

    const { data: addresses, error: addressesError } = await ctx.supabase
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
          await ctx.supabase
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

    let orderedRequestIds = stopsWithCoords
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((stop) => stop.requestId);

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
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
          origin,
        )}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(
          waypoints,
        )}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
        const directionsResponse = await fetch(url, { cache: "no-store" });
        const directionsJson = (await directionsResponse.json()) as {
          status?: string;
          routes?: Array<{ waypoint_order?: number[] }>;
        };
        const waypointOrder = directionsJson.routes?.[0]?.waypoint_order ?? [];
        if (directionsJson.status === "OK" && waypointOrder.length === stopsWithCoords.length) {
          orderedRequestIds = waypointOrder.map((index) => stopsWithCoords[index]?.requestId).filter(Boolean) as string[];
        }
      } catch {
        // Fall back to created_at ordering if directions API is unavailable.
      }
    }

    const remainder = stopsWithoutCoords
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((stop) => stop.requestId);
    const finalOrder = [...orderedRequestIds, ...remainder];

    const stops = finalOrder.map((requestId, index) => ({
      route_id: route.id,
      pickup_request_id: requestId,
      stop_order: index + 1,
      status: "scheduled",
    }));
    const { error: deleteStopsError } = await ctx.supabase.from("pickup_stops").delete().eq("route_id", route.id);
    if (deleteStopsError) return NextResponse.json({ error: deleteStopsError.message }, { status: 500 });
    const { error: stopsError } = await ctx.supabase.from("pickup_stops").insert(stops);
    if (stopsError) return NextResponse.json({ error: stopsError.message }, { status: 500 });

    await ctx.supabase
      .from("routes")
      .update({
        status: existingRoute?.driver_id ? "assigned" : "draft",
        driver_id: fulfillmentMode === "employee_driver" ? existingRoute?.driver_id ?? null : null,
        partner_id: zone.partner_id ?? null,
        fulfillment_mode: fulfillmentMode,
        partner_visible: fulfillmentMode === "partner_team",
      })
      .eq("id", route.id);

    return NextResponse.json({
      ok: true,
      routeId: route.id,
      stopCount: finalOrder.length,
      optimized: canOptimize,
      missingCoordinates: remainder.length,
      regenerated: Boolean(existingRoute),
    });
  }

  await ctx.supabase
    .from("pickup_stops")
    .delete()
    .eq("route_id", route.id);
  await ctx.supabase
    .from("routes")
    .update({
      status: existingRoute?.driver_id ? "assigned" : "draft",
      driver_id: fulfillmentMode === "employee_driver" ? existingRoute?.driver_id ?? null : null,
      partner_id: zone.partner_id ?? null,
      fulfillment_mode: fulfillmentMode,
      partner_visible: fulfillmentMode === "partner_team",
    })
    .eq("id", route.id);

  return NextResponse.json({
    ok: true,
    routeId: route.id,
    stopCount: requests?.length ?? 0,
    regenerated: Boolean(existingRoute),
  });
}
