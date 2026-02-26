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

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    routeId: url.searchParams.get("routeId") || "",
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid route id" }, { status: 400 });

  const routeId = parsed.data.routeId;

  const { data: route, error: routeError } = await ctx.supabase
    .from("routes")
    .select("id,status,zone_id,pickup_cycle_id,service_zones(code,name),pickup_cycles(pickup_date)")
    .eq("id", routeId)
    .maybeSingle();
  if (routeError || !route) return NextResponse.json({ error: routeError?.message ?? "Route not found" }, { status: 404 });

  const { data: stops, error: stopError } = await ctx.supabase
    .from("pickup_stops")
    .select("id,stop_order,status,pickup_request_id")
    .eq("route_id", routeId)
    .order("stop_order", { ascending: true });
  if (stopError) return NextResponse.json({ error: stopError.message }, { status: 500 });

  const requestIds = (stops ?? []).map((stop) => stop.pickup_request_id);
  const { data: requests } =
    requestIds.length > 0
      ? await ctx.supabase.from("pickup_requests").select("id,user_id,status,note").in("id", requestIds)
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
      ? ctx.supabase.from("users").select("id,email,full_name").in("id", userIds)
      : Promise.resolve({ data: [] as UserRow[] }),
    userIds.length > 0
      ? ctx.supabase
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

  return NextResponse.json({
    route,
    stops: (stops ?? []).map((stop) => {
      const requestItem = requestById.get(stop.pickup_request_id);
      const user = requestItem ? userById.get(requestItem.user_id) : null;
      const address = requestItem ? addressByUserId.get(requestItem.user_id) : null;
      return {
        id: stop.id,
        stopOrder: stop.stop_order,
        stopStatus: stop.status,
        requestStatus: requestItem?.status ?? null,
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
    }),
  });
}
