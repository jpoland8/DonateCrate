import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";

const bodySchema = z.object({
  zoneCode: z.string().default("knoxville-37922"),
  cycleMonth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  requestCutoffAt: z.string(),
});

export async function POST(request: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { supabase } = ctx;
  const { data: zone, error: zoneError } = await supabase
    .from("service_zones")
    .select("id")
    .eq("code", parsed.data.zoneCode)
    .maybeSingle();

  if (zoneError || !zone) {
    return NextResponse.json({ error: zoneError?.message ?? "Zone not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("pickup_cycles")
    .upsert(
      {
        zone_id: zone.id,
        cycle_month: parsed.data.cycleMonth,
        pickup_date: parsed.data.pickupDate,
        request_cutoff_at: parsed.data.requestCutoffAt,
      },
      { onConflict: "zone_id,cycle_month" },
    )
    .select("id,cycle_month,pickup_date,request_cutoff_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: activeMembers, error: activeMembersError } = await supabase
    .from("zone_memberships")
    .select("user_id")
    .eq("zone_id", zone.id)
    .eq("status", "active");

  if (activeMembersError) {
    return NextResponse.json({ error: activeMembersError.message }, { status: 500 });
  }

  const memberUserIds = (activeMembers ?? []).map((member) => member.user_id);
  if (memberUserIds.length > 0) {
    const { data: eligibleSubscriptions, error: eligibleSubsError } = await supabase
      .from("subscriptions")
      .select("user_id,status")
      .in("user_id", memberUserIds)
      .in("status", ["trialing", "active", "past_due", "paused"]);

    if (eligibleSubsError) {
      return NextResponse.json({ error: eligibleSubsError.message }, { status: 500 });
    }

    const eligibleUserIds = (eligibleSubscriptions ?? []).map((row) => row.user_id);
    if (eligibleUserIds.length > 0) {
      const defaultRequests = eligibleUserIds.map((userId) => ({
        user_id: userId,
        pickup_cycle_id: data.id,
        status: "requested",
        note: "Auto-created by monthly default pickup policy",
        updated_at: new Date().toISOString(),
      }));

      const { error: defaultRequestError } = await supabase
        .from("pickup_requests")
        .upsert(defaultRequests, { onConflict: "user_id,pickup_cycle_id", ignoreDuplicates: true });

      if (defaultRequestError) {
        return NextResponse.json({ error: defaultRequestError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true, pickupCycle: data });
}

export async function GET() {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await ctx.supabase
    .from("pickup_cycles")
    .select("id,cycle_month,pickup_date,request_cutoff_at")
    .order("pickup_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pickupCycles: data ?? [] });
}
