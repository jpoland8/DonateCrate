import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";

const querySchema = z.object({
  routeId: z.string().uuid(),
});

export async function GET(request: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Google API key not configured" }, { status: 500 });

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    routeId: url.searchParams.get("routeId") ?? "",
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid route id" }, { status: 400 });

  const routeId = parsed.data.routeId;
  const { data: stops, error: stopsError } = await ctx.supabase
    .from("pickup_stops")
    .select("stop_order,pickup_request_id")
    .eq("route_id", routeId)
    .order("stop_order", { ascending: true });
  if (stopsError) return NextResponse.json({ error: stopsError.message }, { status: 500 });

  const requestIds = (stops ?? []).map((stop) => stop.pickup_request_id);
  if (requestIds.length === 0) return NextResponse.json({ error: "No stops on this route" }, { status: 404 });

  const { data: requests, error: requestError } = await ctx.supabase
    .from("pickup_requests")
    .select("id,user_id")
    .in("id", requestIds);
  if (requestError) return NextResponse.json({ error: requestError.message }, { status: 500 });

  const userIds = Array.from(new Set((requests ?? []).map((row) => row.user_id)));
  const { data: addresses, error: addressError } = await ctx.supabase
    .from("addresses")
    .select("user_id,lat,lng,created_at")
    .in("user_id", userIds)
    .order("created_at", { ascending: false });
  if (addressError) return NextResponse.json({ error: addressError.message }, { status: 500 });

  const addressByUserId = new Map<string, { lat: number | null; lng: number | null }>();
  for (const address of addresses ?? []) {
    if (!addressByUserId.has(address.user_id)) {
      addressByUserId.set(address.user_id, { lat: address.lat, lng: address.lng });
    }
  }

  const requestById = new Map((requests ?? []).map((row) => [row.id, row.user_id]));
  const orderedPoints = (stops ?? [])
    .map((stop) => {
      const userId = requestById.get(stop.pickup_request_id);
      if (!userId) return null;
      const coords = addressByUserId.get(userId);
      if (!coords?.lat || !coords?.lng) return null;
      return `${coords.lat},${coords.lng}`;
    })
    .filter((point): point is string => Boolean(point));

  if (orderedPoints.length === 0) {
    return NextResponse.json({ error: "No route coordinates available for this route" }, { status: 404 });
  }

  const markerParams = orderedPoints.map((point) => `markers=color:orange|size:mid|${encodeURIComponent(point)}`);
  const pathParam = orderedPoints.length > 1 ? `path=color:0xff6a00ff|weight:4|${orderedPoints.map(encodeURIComponent).join("|")}` : "";
  const parts = [
    "size=1200x700",
    "maptype=roadmap",
    ...markerParams,
    pathParam,
    `key=${encodeURIComponent(apiKey)}`,
  ].filter(Boolean);

  const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?${parts.join("&")}`;
  const mapResponse = await fetch(mapUrl, { cache: "no-store" });
  if (!mapResponse.ok) return NextResponse.json({ error: "Failed to render map image" }, { status: 502 });

  const contentType = mapResponse.headers.get("content-type") || "image/png";
  const bytes = await mapResponse.arrayBuffer();
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}
