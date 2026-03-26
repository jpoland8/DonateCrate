import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { userCanAccessPartner } from "@/lib/partner-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const querySchema = z.object({
  routeId: z.string().uuid(),
});

function buildGoogleMapsUrl(points: Array<{ lat: number; lng: number }>) {
  if (points.length === 0) return null;
  const origin = `${points[0].lat},${points[0].lng}`;
  const destination = `${points[points.length - 1].lat},${points[points.length - 1].lng}`;
  const waypoints = points.slice(1, -1).map((point) => `${point.lat},${point.lng}`).join("|");
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: "driving",
  });
  if (waypoints.length > 0) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export async function GET(request: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ctx.partnerRole) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabaseAdmin = createSupabaseAdminClient();

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    routeId: url.searchParams.get("routeId") || "",
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid route id" }, { status: 400 });

  const { data: route, error: routeError } = await supabaseAdmin
    .from("routes")
    .select("id,status,driver_id,partner_id,zone_id,pickup_cycle_id,fulfillment_mode,service_zones(code,name),pickup_cycles(pickup_date)")
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

  const { data: stops, error: stopError } = await supabaseAdmin
    .from("pickup_stops")
    .select("id,stop_order,status,pickup_request_id")
    .eq("route_id", parsed.data.routeId)
    .order("stop_order", { ascending: true });
  if (stopError) return NextResponse.json({ error: stopError.message }, { status: 500 });

  const requestIds = (stops ?? []).map((stop) => stop.pickup_request_id);
  const { data: requests } =
    requestIds.length > 0
      ? await supabaseAdmin.from("pickup_requests").select("id,user_id,status,note").in("id", requestIds)
      : { data: [] as Array<{ id: string; user_id: string; status: string; note: string | null }> };

  const userIds = Array.from(new Set((requests ?? []).map((row) => row.user_id)));
  type UserRow = { id: string; email: string; full_name: string | null };
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

  const [{ data: users }, { data: addresses }] = await Promise.all([
    userIds.length > 0
      ? supabaseAdmin.from("users").select("id,email,full_name").in("id", userIds)
      : Promise.resolve({ data: [] as UserRow[] }),
    userIds.length > 0
      ? supabaseAdmin
          .from("addresses")
          .select("user_id,address_line1,city,state,postal_code,lat,lng,created_at")
          .in("user_id", userIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as AddressRow[] }),
  ]);

  const requestById = new Map((requests ?? []).map((row) => [row.id, row]));
  const userById = new Map((users ?? []).map((row) => [row.id, row]));
  const addressByUserId = new Map<string, AddressRow>();
  for (const address of addresses ?? []) {
    if (!addressByUserId.has(address.user_id)) {
      addressByUserId.set(address.user_id, address);
    }
  }

  const previewStops = (stops ?? []).map((stop) => {
    const requestItem = requestById.get(stop.pickup_request_id);
    const user = requestItem ? userById.get(requestItem.user_id) : null;
    const address = requestItem ? addressByUserId.get(requestItem.user_id) : null;
    return {
      id: stop.id,
      pickupRequestId: stop.pickup_request_id,
      stopOrder: stop.stop_order,
      stopStatus: stop.status,
      requestStatus: requestItem?.status ?? null,
      requestNote: requestItem?.note ?? null,
      email: user?.email ?? null,
      fullName: user?.full_name ?? null,
      address: address
        ? {
            addressLine1: address.address_line1,
            city: address.city,
            state: address.state,
            postalCode: address.postal_code,
            lat: address.lat,
            lng: address.lng,
          }
        : null,
    };
  });

  const directionsPoints = previewStops
    .map((stop) => stop.address)
    .filter((address): address is NonNullable<typeof address> => Boolean(address?.lat != null && address?.lng != null))
    .map((address) => ({ lat: address.lat as number, lng: address.lng as number }));

  return NextResponse.json({
    route,
    googleMapsUrl: buildGoogleMapsUrl(directionsPoints),
    stops: previewStops,
  });
}
