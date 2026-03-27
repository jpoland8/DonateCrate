import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/api-auth";

export async function POST() {
  const ctx = await getAuthenticatedContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { supabase, profile } = ctx;
  const today = new Date().toISOString().slice(0, 10);

  const { data: cycle, error: cycleError } = await supabase
    .from("pickup_cycles")
    .select("id,pickup_date")
    .gte("pickup_date", today)
    .order("pickup_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (cycleError) return NextResponse.json({ error: cycleError.message }, { status: 500 });
  if (!cycle) return NextResponse.json({ error: "No active pickup cycle found" }, { status: 404 });
  if (today >= cycle.pickup_date) {
    return NextResponse.json({ error: "Pickup is today or has already passed — changes are no longer accepted" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("pickup_requests")
    .upsert(
      {
        user_id: profile.id,
        pickup_cycle_id: cycle.id,
        status: "requested",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,pickup_cycle_id" },
    )
    .select("id,status,pickup_cycle_id,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, pickupRequest: data });
}
