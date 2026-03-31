import { NextResponse } from "next/server";
import { z } from "zod";
import { canManagePartnerSchedule } from "@/lib/access";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { getActivePartnerMemberships, userCanAccessPartner } from "@/lib/partner-access";
import { apiLimiter } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updateCycleSchema = z.object({
  action: z.literal("update_cycle"),
  cycleId: z.string().uuid(),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickupWindowLabel: z.string().max(120).optional(),
});

const recurringScheduleSchema = z.object({
  action: z.literal("set_recurring_schedule"),
  zoneId: z.string().uuid(),
  startPickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  horizonMode: z.enum(["months", "forever"]).default("months"),
  months: z.number().int().min(1).max(24).optional(),
  weekendPolicy: z.enum(["none", "next_business_day"]).default("none"),
  pickupWindowLabel: z.string().max(120).optional(),
});

const deleteCycleSchema = z.object({
  action: z.literal("delete_cycle"),
  cycleId: z.string().uuid(),
});

const patchSchema = z.discriminatedUnion("action", [updateCycleSchema, recurringScheduleSchema, deleteCycleSchema]);

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Cutoff is set to midnight of the pickup day — responses are accepted until the day before.
function cutoffForPickup(pickupDate: string) {
  return `${pickupDate}T00:00:00.000Z`;
}

function getPickupDateForMonth(year: number, monthIndex: number, dayOfMonth: number, weekendPolicy: "none" | "next_business_day") {
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const clampedDay = Math.min(dayOfMonth, daysInMonth);
  const base = new Date(Date.UTC(year, monthIndex, clampedDay));

  if (weekendPolicy === "next_business_day") {
    const day = base.getUTCDay();
    if (day === 6) base.setUTCDate(base.getUTCDate() + 2);
    if (day === 0) base.setUTCDate(base.getUTCDate() + 1);
  }
  return base;
}

export async function GET(request: Request) {
  const limited = apiLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ctx.partnerRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { memberships, error: membershipError } = await getActivePartnerMemberships({
    supabase: ctx.supabase,
    userId: ctx.profile.id,
  });
  if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 });

  const partnerIds = memberships.map((membership) => membership.partnerId);
  if (partnerIds.length === 0) return NextResponse.json({ pickupCycles: [] });

  const { data, error } = await ctx.supabase
    .from("pickup_cycles")
    .select("id,zone_id,cycle_month,pickup_date,pickup_window_label,scheduled_by_partner_id,service_zones!inner(id,name,code,partner_id,partner_pickup_date_override_allowed,recurring_pickup_day,default_pickup_window_label)")
    .in("service_zones.partner_id", partnerIds)
    .order("pickup_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pickupCycles: data ?? [] });
}

export async function PATCH(request: Request) {
  const limited = apiLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManagePartnerSchedule(ctx.partnerRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const input = parsed.data;
  const supabaseAdmin = createSupabaseAdminClient();

  if (input.action === "update_cycle") {
    const { data: cycleRows, error: cycleError } = await ctx.supabase
      .from("pickup_cycles")
      .select("id,zone_id,service_zones!inner(partner_id,partner_pickup_date_override_allowed)")
      .eq("id", input.cycleId)
      .limit(1);

    const cycle = cycleRows?.[0];
    if (cycleError || !cycle) return NextResponse.json({ error: cycleError?.message ?? "Pickup cycle not found" }, { status: 404 });

    const zone = Array.isArray(cycle.service_zones) ? cycle.service_zones[0] : cycle.service_zones;
    if (!zone?.partner_pickup_date_override_allowed) {
      return NextResponse.json({ error: "Pickup dates are controlled by DonateCrate for this zone" }, { status: 403 });
    }
    const canAccess = await userCanAccessPartner({
      supabase: ctx.supabase,
      userId: ctx.profile.id,
      partnerId: zone?.partner_id,
    });
    if (!canAccess) return NextResponse.json({ error: "This pickup cycle is not assigned to your nonprofit" }, { status: 403 });

    const updatePayload = {
      pickup_date: input.pickupDate,
      request_cutoff_at: cutoffForPickup(input.pickupDate),
      pickup_window_label: input.pickupWindowLabel?.trim() ? input.pickupWindowLabel.trim() : null,
      scheduled_by_partner_id: zone?.partner_id ?? null,
    };

    const { data, error } = await supabaseAdmin
      .from("pickup_cycles")
      .update(updatePayload)
      .eq("id", input.cycleId)
      .select("id,pickup_date,pickup_window_label,scheduled_by_partner_id")
      .limit(1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, pickupCycle: data?.[0] ?? null });
  }

  if (input.action === "delete_cycle") {
    const { data: cycleRows, error: cycleError } = await ctx.supabase
      .from("pickup_cycles")
      .select("id,zone_id,service_zones!inner(partner_id,partner_pickup_date_override_allowed)")
      .eq("id", input.cycleId)
      .limit(1);

    const cycle = cycleRows?.[0];
    if (cycleError || !cycle) return NextResponse.json({ error: cycleError?.message ?? "Pickup cycle not found" }, { status: 404 });

    const zone = Array.isArray(cycle.service_zones) ? cycle.service_zones[0] : cycle.service_zones;
    if (!zone?.partner_pickup_date_override_allowed) {
      return NextResponse.json({ error: "Pickup dates are controlled by DonateCrate for this zone" }, { status: 403 });
    }
    const canAccess = await userCanAccessPartner({
      supabase: ctx.supabase,
      userId: ctx.profile.id,
      partnerId: zone?.partner_id,
    });
    if (!canAccess) return NextResponse.json({ error: "This pickup cycle is not assigned to your nonprofit" }, { status: 403 });

    const { error: deleteError } = await supabaseAdmin.from("pickup_cycles").delete().eq("id", input.cycleId);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    return NextResponse.json({ ok: true, deletedCycleId: input.cycleId });
  }

  // set_recurring_schedule
  const { data: zoneRows, error: zoneError } = await ctx.supabase
    .from("service_zones")
    .select("id,partner_id,partner_pickup_date_override_allowed")
    .eq("id", input.zoneId)
    .limit(1);

  const zone = zoneRows?.[0];
  if (zoneError || !zone) return NextResponse.json({ error: zoneError?.message ?? "Zone not found" }, { status: 404 });
  if (!zone.partner_pickup_date_override_allowed) {
    return NextResponse.json({ error: "Recurring scheduling is controlled by DonateCrate for this zone" }, { status: 403 });
  }
  const canAccess = await userCanAccessPartner({
    supabase: ctx.supabase,
    userId: ctx.profile.id,
    partnerId: zone.partner_id,
  });
  if (!canAccess) return NextResponse.json({ error: "This zone is not assigned to your nonprofit" }, { status: 403 });

  const startPickup = new Date(`${input.startPickupDate}T00:00:00.000Z`);
  const anchorDay = startPickup.getUTCDate();
  const horizonMonths = input.horizonMode === "forever" ? 60 : (input.months ?? 6);
  const cycleInputs = Array.from({ length: horizonMonths }).map((_, index) => {
    const monthDate = new Date(Date.UTC(startPickup.getUTCFullYear(), startPickup.getUTCMonth() + index, 1));
    const pickup = getPickupDateForMonth(
      monthDate.getUTCFullYear(),
      monthDate.getUTCMonth(),
      anchorDay,
      input.weekendPolicy,
    );
    const pickupDateStr = isoDate(pickup);
    return {
      zone_id: zone.id,
      cycle_month: isoDate(monthDate),
      pickup_date: pickupDateStr,
      request_cutoff_at: cutoffForPickup(pickupDateStr),
      pickup_window_label: input.pickupWindowLabel?.trim() ? input.pickupWindowLabel.trim() : null,
      scheduled_by_partner_id: zone.partner_id ?? null,
    };
  });

  const { data: cycles, error: cyclesError } = await supabaseAdmin
    .from("pickup_cycles")
    .upsert(cycleInputs, { onConflict: "zone_id,cycle_month" })
    .select("id,zone_id,cycle_month,pickup_date,pickup_window_label");
  if (cyclesError) return NextResponse.json({ error: cyclesError.message }, { status: 500 });

  const { data: activeMembers, error: activeMembersError } = await supabaseAdmin
    .from("zone_memberships")
    .select("zone_id,user_id")
    .eq("zone_id", zone.id)
    .eq("status", "active");
  if (activeMembersError) return NextResponse.json({ error: activeMembersError.message }, { status: 500 });

  const memberUserIds = Array.from(new Set((activeMembers ?? []).map((member) => member.user_id)));
  if (memberUserIds.length > 0 && (cycles ?? []).length > 0) {
    const { data: eligibleSubscriptions, error: eligibleSubsError } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id,status")
      .in("user_id", memberUserIds)
      .in("status", ["active", "past_due", "paused"]);
    if (eligibleSubsError) return NextResponse.json({ error: eligibleSubsError.message }, { status: 500 });

    const eligibleUserIds = new Set((eligibleSubscriptions ?? []).map((row) => row.user_id));
    const defaultRequests = (cycles ?? []).flatMap((cycle) =>
      (activeMembers ?? [])
        .filter((member) => eligibleUserIds.has(member.user_id))
        .map((member) => ({
          user_id: member.user_id,
          pickup_cycle_id: cycle.id,
          status: "requested",
          note: "Auto-created by partner recurring pickup schedule",
          updated_at: new Date().toISOString(),
        })),
    );

    if (defaultRequests.length > 0) {
      const { error: defaultRequestError } = await supabaseAdmin
        .from("pickup_requests")
        .upsert(defaultRequests, { onConflict: "user_id,pickup_cycle_id", ignoreDuplicates: true });
      if (defaultRequestError) return NextResponse.json({ error: defaultRequestError.message }, { status: 500 });
    }
  }

  const { error: zoneUpdateError } = await supabaseAdmin
    .from("service_zones")
    .update({
      recurring_pickup_day: anchorDay,
      default_pickup_window_label: input.pickupWindowLabel?.trim() ? input.pickupWindowLabel.trim() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", zone.id);
  if (zoneUpdateError) return NextResponse.json({ error: zoneUpdateError.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    schedule: {
      zoneId: zone.id,
      recurringPickupDay: anchorDay,
      defaultPickupWindowLabel: input.pickupWindowLabel?.trim() ? input.pickupWindowLabel.trim() : null,
    },
    pickupCycles: cycles ?? [],
  });
}
