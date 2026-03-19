import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";

const bodySchema = z.object({
  routeId: z.string().uuid(),
  driverId: z.string().uuid(),
});

export async function POST(request: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const { data: driver, error: driverError } = await ctx.supabase
    .from("drivers")
    .select("id,active")
    .eq("id", parsed.data.driverId)
    .maybeSingle();

  if (driverError || !driver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  }
  if (!driver.active) {
    return NextResponse.json({ error: "Selected driver is inactive" }, { status: 409 });
  }

  const { count: stopCount, error: stopCountError } = await ctx.supabase
    .from("pickup_stops")
    .select("id", { count: "exact", head: true })
    .eq("route_id", parsed.data.routeId);
  if (stopCountError) return NextResponse.json({ error: stopCountError.message }, { status: 500 });
  if ((stopCount ?? 0) === 0) {
    return NextResponse.json({ error: "Generate the route stops before assigning a driver" }, { status: 409 });
  }

  const { data: route, error } = await ctx.supabase
    .from("routes")
    .update({ driver_id: parsed.data.driverId, status: "assigned" })
    .eq("id", parsed.data.routeId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, route });
}
