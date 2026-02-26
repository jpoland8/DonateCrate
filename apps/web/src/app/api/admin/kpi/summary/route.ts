import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/api-auth";

export async function GET() {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { supabase } = ctx;
  const [
    { count: activeSubscribers },
    { count: waitlistCount },
    { count: routeCount },
    { count: pickupSuccessCount },
  ] = await Promise.all([
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("waitlist_entries").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("routes").select("id", { count: "exact", head: true }),
    supabase.from("pickup_stops").select("id", { count: "exact", head: true }).eq("status", "picked_up"),
  ]);

  return NextResponse.json({
    activeSubscribers: activeSubscribers ?? 0,
    waitlistCount: waitlistCount ?? 0,
    routeCount: routeCount ?? 0,
    pickupSuccessCount: pickupSuccessCount ?? 0,
  });
}
