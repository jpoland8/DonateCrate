import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";

const querySchema = z.object({
  routeId: z.string().uuid(),
});

type Point = {
  lat: number;
  lng: number;
  order: number;
};

function fallbackMapSvg(message: string, stopCount = 0) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#111111"/>
      <stop offset="100%" stop-color="#2d2d2d"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="700" fill="url(#bg)"/>
  <circle cx="220" cy="140" r="120" fill="#ff6a00" opacity="0.18"/>
  <circle cx="980" cy="540" r="180" fill="#ff6a00" opacity="0.12"/>
  <rect x="120" y="120" width="960" height="460" rx="32" fill="none" stroke="#ffffff22" stroke-width="2"/>
  <text x="160" y="220" fill="#ffffff" font-family="Arial, sans-serif" font-size="44" font-weight="700">Route map preview unavailable</text>
  <text x="160" y="280" fill="#d4d4d4" font-family="Arial, sans-serif" font-size="28">${message}</text>
  <text x="160" y="340" fill="#ffb37a" font-family="Arial, sans-serif" font-size="24">Stops on route: ${stopCount}</text>
  <text x="160" y="410" fill="#d4d4d4" font-family="Arial, sans-serif" font-size="24">You can still review the ordered stop list below and assign a driver.</text>
</svg>`;
}

function renderRouteMapSvg(points: Point[]) {
  const width = 1200;
  const height = 700;
  const padding = 90;
  const minLat = Math.min(...points.map((point) => point.lat));
  const maxLat = Math.max(...points.map((point) => point.lat));
  const minLng = Math.min(...points.map((point) => point.lng));
  const maxLng = Math.max(...points.map((point) => point.lng));

  const latSpan = Math.max(maxLat - minLat, 0.01);
  const lngSpan = Math.max(maxLng - minLng, 0.01);

  const projected = points.map((point) => {
    const x = padding + ((point.lng - minLng) / lngSpan) * (width - padding * 2);
    const y = height - padding - ((point.lat - minLat) / latSpan) * (height - padding * 2);
    return { ...point, x, y };
  });

  const path = projected.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const markers = projected
    .map(
      (point) => `
  <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="18" fill="#ff6a00" stroke="#fff" stroke-width="3"/>
  <text x="${point.x.toFixed(1)}" y="${(point.y + 7).toFixed(1)}" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="16" font-weight="700">${point.order}</text>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#121212"/>
      <stop offset="100%" stop-color="#252525"/>
    </linearGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#ffffff10" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#grid)"/>
  <circle cx="190" cy="140" r="110" fill="#ff6a00" opacity="0.12"/>
  <circle cx="980" cy="530" r="170" fill="#ff6a00" opacity="0.09"/>
  <rect x="52" y="52" width="${width - 104}" height="${height - 104}" rx="28" fill="none" stroke="#ffffff1f" stroke-width="2"/>
  <polyline points="${path}" fill="none" stroke="#ffb37a" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" opacity="0.95"/>
  ${markers}
  <rect x="72" y="70" width="280" height="108" rx="20" fill="#00000088" stroke="#ffffff20" stroke-width="1"/>
  <text x="96" y="110" fill="#ffffff" font-family="Arial, sans-serif" font-size="30" font-weight="700">Local Route Preview</text>
  <text x="96" y="145" fill="#d4d4d4" font-family="Arial, sans-serif" font-size="20">Stops: ${points.length}</text>
  <text x="96" y="170" fill="#d4d4d4" font-family="Arial, sans-serif" font-size="20">Ordered by current route sequence</text>
</svg>`;
}

export async function GET(request: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
  if (requestIds.length === 0) {
    return new NextResponse(fallbackMapSvg("Generate the route to create ordered stops for this cycle."), {
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
    });
  }

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
      return { lat: coords.lat, lng: coords.lng, order: stop.stop_order };
    })
    .filter((point): point is Point => Boolean(point));

  if (orderedPoints.length === 0) {
    return new NextResponse(
      fallbackMapSvg("No geocoded coordinates are available for the route stops yet.", orderedPoints.length),
      {
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
      },
    );
  }

  return new NextResponse(renderRouteMapSvg(orderedPoints), {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store",
    },
  });
}
