import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";

const singleSchema = z.object({
  mode: z.literal("single").default("single"),
  zoneCode: z.string().default("knoxville-37922"),
  applyToAllActiveZones: z.boolean().default(false),
  cycleMonth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  requestCutoffAt: z.string(),
});

const recurringSchema = z.object({
  mode: z.literal("recurring"),
  zoneCode: z.string().default("knoxville-37922"),
  applyToAllActiveZones: z.boolean().default(false),
  startPickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  horizonMode: z.enum(["months", "forever"]).default("months"),
  months: z.number().int().min(1).max(60).optional(),
  weekendPolicy: z.enum(["none", "next_business_day"]).default("none"),
  cutoffDaysBefore: z.number().int().min(0).max(30).default(7),
});

const bodySchema = z.union([singleSchema, recurringSchema]);

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
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
  const input = parsed.data;
  const { data: zoneRows, error: zoneError } = input.applyToAllActiveZones
    ? await supabase.from("service_zones").select("id,code").eq("status", "active")
    : await supabase.from("service_zones").select("id,code").eq("code", input.zoneCode).limit(1);

  if (zoneError || !zoneRows || zoneRows.length === 0) {
    return NextResponse.json({ error: zoneError?.message ?? "No eligible zones found" }, { status: 404 });
  }

  const zones = zoneRows.map((zone) => ({ id: zone.id, code: zone.code }));
  const cycleInputs =
    input.mode === "recurring"
      ? (() => {
        const horizonMonths = input.horizonMode === "forever" ? 60 : (input.months ?? 6);
          const startPickup = new Date(`${input.startPickupDate}T00:00:00.000Z`);
          const anchorDay = startPickup.getUTCDate();
          return zones.flatMap((zone) =>
            Array.from({ length: horizonMonths }).map((_, index) => {
            const monthDate = new Date(Date.UTC(startPickup.getUTCFullYear(), startPickup.getUTCMonth() + index, 1));
            const pickup = getPickupDateForMonth(
              monthDate.getUTCFullYear(),
              monthDate.getUTCMonth(),
              anchorDay,
              input.weekendPolicy,
            );
            const cutoff = new Date(pickup);
            cutoff.setUTCDate(cutoff.getUTCDate() - input.cutoffDaysBefore);
              return {
                zone_id: zone.id,
                cycle_month: isoDate(monthDate),
                pickup_date: isoDate(pickup),
                request_cutoff_at: cutoff.toISOString(),
              };
            }),
          );
        })()
      : [
          ...zones.map((zone) => ({
            zone_id: zone.id,
            cycle_month: input.cycleMonth,
            pickup_date: input.pickupDate,
            request_cutoff_at: input.requestCutoffAt,
          })),
        ];

  const { data, error } = await supabase
    .from("pickup_cycles")
    .upsert(cycleInputs, { onConflict: "zone_id,cycle_month" })
    .select("id,zone_id,cycle_month,pickup_date,request_cutoff_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const zoneIds = zones.map((zone) => zone.id);
  const { data: activeMembers, error: activeMembersError } = await supabase
    .from("zone_memberships")
    .select("zone_id,user_id")
    .in("zone_id", zoneIds)
    .eq("status", "active");

  if (activeMembersError) {
    return NextResponse.json({ error: activeMembersError.message }, { status: 500 });
  }

  const memberUserIds = Array.from(new Set((activeMembers ?? []).map((member) => member.user_id)));
  if (memberUserIds.length > 0) {
    const { data: eligibleSubscriptions, error: eligibleSubsError } = await supabase
      .from("subscriptions")
      .select("user_id,status")
      .in("user_id", memberUserIds)
      .in("status", ["active", "past_due", "paused"]);

    if (eligibleSubsError) {
      return NextResponse.json({ error: eligibleSubsError.message }, { status: 500 });
    }

    const eligibleUserIds = (eligibleSubscriptions ?? []).map((row) => row.user_id);
    if (eligibleUserIds.length > 0 && (data ?? []).length > 0) {
      const eligibleUserIdSet = new Set(eligibleUserIds);
      const activeMembersByZone = new Map<string, string[]>();
      for (const member of activeMembers ?? []) {
        if (!eligibleUserIdSet.has(member.user_id)) continue;
        const current = activeMembersByZone.get(member.zone_id) ?? [];
        current.push(member.user_id);
        activeMembersByZone.set(member.zone_id, current);
      }

      const defaultRequests = (data ?? []).flatMap((cycle) =>
        (activeMembersByZone.get(cycle.zone_id) ?? []).map((userId) => ({
          user_id: userId,
          pickup_cycle_id: cycle.id,
          status: "requested",
          note: "Auto-created by monthly default pickup policy",
          updated_at: new Date().toISOString(),
        })),
      );

      const { error: defaultRequestError } = await supabase
        .from("pickup_requests")
        .upsert(defaultRequests, { onConflict: "user_id,pickup_cycle_id", ignoreDuplicates: true });

      if (defaultRequestError) {
        return NextResponse.json({ error: defaultRequestError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    appliedZoneCount: zones.length,
    createdCount: data?.length ?? 0,
    horizonMonthsApplied: input.mode === "recurring" ? (input.horizonMode === "forever" ? 60 : (input.months ?? 6)) : 1,
    pickupCycles: data ?? [],
  });
}

export async function GET() {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await ctx.supabase
    .from("pickup_cycles")
    .select("id,zone_id,cycle_month,pickup_date,request_cutoff_at,service_zones(code,name)")
    .order("pickup_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pickupCycles: data ?? [] });
}
