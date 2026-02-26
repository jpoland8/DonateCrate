import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { ensureDefaultPickupRequestForUser } from "@/lib/pickup-defaults";

export async function GET() {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, profile } = ctx;
  const today = new Date().toISOString().slice(0, 10);
  await ensureDefaultPickupRequestForUser({ supabase, userId: profile.id, today });

  const [{ data: prefs }, { data: latestRequest }, { data: currentCycle }] = await Promise.all([
    supabase
      .from("notification_preferences")
      .select("email_enabled,sms_enabled,quiet_hours_start,quiet_hours_end")
      .eq("user_id", profile.id)
      .maybeSingle(),
    supabase
      .from("pickup_requests")
      .select("status,updated_at")
      .eq("user_id", profile.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("pickup_cycles")
      .select("id,pickup_date,request_cutoff_at")
      .gte("pickup_date", today)
      .order("pickup_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const { data: thisCycleRequest } = currentCycle
    ? await supabase
        .from("pickup_requests")
        .select("status,updated_at")
        .eq("user_id", profile.id)
        .eq("pickup_cycle_id", currentCycle.id)
        .maybeSingle()
    : { data: null };

  return NextResponse.json({
    preferences: prefs ?? {
      email_enabled: true,
      sms_enabled: true,
      quiet_hours_start: null,
      quiet_hours_end: null,
    },
    latestRequest: latestRequest ?? null,
    currentCycle: currentCycle ?? null,
    currentCycleRequest: thisCycleRequest ?? null,
  });
}
