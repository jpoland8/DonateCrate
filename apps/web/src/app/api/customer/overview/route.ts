import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { ensureDefaultPickupRequestForUser } from "@/lib/pickup-defaults";

export async function GET() {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, profile } = ctx;
  const today = new Date().toISOString().slice(0, 10);
  await ensureDefaultPickupRequestForUser({ supabase, userId: profile.id, today });

  const [
    { data: prefs },
    { data: latestRequest },
    { data: currentCycle },
    { data: address },
    { data: notificationEvents },
    { data: recentPickupRequests },
  ] =
    await Promise.all([
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
      .select("id,pickup_date,request_cutoff_at,pickup_window_label")
      .gte("pickup_date", today)
      .order("pickup_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("addresses")
      .select("address_line1,city,state,postal_code")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("notification_events")
      .select("id,channel,event_type,status,created_at,last_attempt_at,last_error")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("pickup_requests")
      .select("id,status,updated_at,pickup_cycles(pickup_date)")
      .eq("user_id", profile.id)
      .order("updated_at", { ascending: false })
      .limit(8),
  ]);

  const { data: thisCycleRequest } = currentCycle
    ? await supabase
        .from("pickup_requests")
        .select("status,updated_at")
        .eq("user_id", profile.id)
        .eq("pickup_cycle_id", currentCycle.id)
        .maybeSingle()
    : { data: null };

  const profileComplete = Boolean(
    profile.full_name?.trim() &&
      profile.phone?.trim() &&
      address?.address_line1?.trim() &&
      address?.city?.trim() &&
      address?.state?.trim() &&
      address?.postal_code?.trim(),
  );

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
    notificationEvents: notificationEvents ?? [],
    recentPickupRequests: recentPickupRequests ?? [],
    profileComplete,
    address: address ?? null,
  });
}
