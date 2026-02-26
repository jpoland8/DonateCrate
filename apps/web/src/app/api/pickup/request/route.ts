import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/api-auth";

export async function POST() {
  const ctx = await getAuthenticatedContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { supabase, profile } = ctx;

  const { data: cycle, error: cycleError } = await supabase
    .from("pickup_cycles")
    .select("id,pickup_date,request_cutoff_at")
    .gte("pickup_date", new Date().toISOString().slice(0, 10))
    .order("pickup_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (cycleError) return NextResponse.json({ error: cycleError.message }, { status: 500 });
  if (!cycle) return NextResponse.json({ error: "No active pickup cycle found" }, { status: 404 });
  if (new Date() > new Date(cycle.request_cutoff_at)) {
    return NextResponse.json({ error: "Request cutoff has passed for this cycle" }, { status: 409 });
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
