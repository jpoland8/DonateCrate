import { NextResponse } from "next/server";
import { z } from "zod";
import { createCorrelationId, getAuthenticatedContext } from "@/lib/api-auth";
import { normalizeToE164US } from "@/lib/twilio";

const queueRemindersSchema = z.object({
  action: z.enum(["queue_cycle_reminders", "retry_events"]),
  pickupCycleId: z.string().uuid().optional(),
  eventIds: z.array(z.string().uuid()).optional(),
  cadence: z.enum(["72h", "24h", "day_of"]).optional(),
});

function buildReminderMessage(pickupDate: string, cadence: "72h" | "24h" | "day_of") {
  const formattedDate = new Date(pickupDate).toLocaleDateString();
  if (cadence === "72h") {
    return `DonateCrate reminder: your pickup is coming up on ${formattedDate}. Start filling your bag now so it is ready for route day.`;
  }
  if (cadence === "24h") {
    return `DonateCrate reminder: your pickup is tomorrow, ${formattedDate}. Place your bag out before route time.`;
  }
  return `DonateCrate reminder: pickup day is here. Place your DonateCrate bag out for collection today, ${formattedDate}.`;
}

export async function GET() {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await ctx.supabase
    .from("notification_events")
    .select("id,user_id,channel,event_type,status,provider_message_id,attempt_count,last_attempt_at,last_error,correlation_id,created_at")
    .order("created_at", { ascending: false })
    .limit(120);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notificationEvents: data ?? [] });
}

export async function POST(request: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const correlationId = createCorrelationId("admin_notify");
  const payload = await request.json().catch(() => null);
  const parsed = queueRemindersSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload", correlationId }, { status: 400 });

  if (parsed.data.action === "retry_events") {
    const eventIds = parsed.data.eventIds ?? [];
    if (eventIds.length === 0) {
      return NextResponse.json({ error: "Select at least one notification event", correlationId }, { status: 400 });
    }

    const { error } = await ctx.supabase
      .from("notification_events")
      .update({ status: "queued", last_error: null })
      .in("id", eventIds);

    if (error) return NextResponse.json({ error: error.message, correlationId }, { status: 500 });
    return NextResponse.json({ ok: true, correlationId, queued: eventIds.length });
  }

  const pickupCycleId = parsed.data.pickupCycleId;
  const cadence = parsed.data.cadence ?? "24h";
  if (!pickupCycleId) {
    return NextResponse.json({ error: "Pickup cycle is required", correlationId }, { status: 400 });
  }

  const { data: cycle, error: cycleError } = await ctx.supabase
    .from("pickup_cycles")
    .select("id,pickup_date")
    .eq("id", pickupCycleId)
    .maybeSingle();
  if (cycleError || !cycle) {
    return NextResponse.json({ error: cycleError?.message ?? "Pickup cycle not found", correlationId }, { status: 404 });
  }

  const { data: requests, error: requestError } = await ctx.supabase
    .from("pickup_requests")
    .select("id,user_id,status")
    .eq("pickup_cycle_id", pickupCycleId)
    .in("status", ["requested", "confirmed"]);
  if (requestError) return NextResponse.json({ error: requestError.message, correlationId }, { status: 500 });

  const userIds = [...new Set((requests ?? []).map((requestItem) => requestItem.user_id))];
  if (userIds.length === 0) {
    return NextResponse.json({ ok: true, correlationId, queued: 0 });
  }

  const [{ data: users }, { data: preferences }] = await Promise.all([
    ctx.supabase.from("users").select("id,phone").in("id", userIds),
    ctx.supabase.from("notification_preferences").select("user_id,sms_enabled").in("user_id", userIds),
  ]);

  const smsPreference = new Map((preferences ?? []).map((item) => [item.user_id, item.sms_enabled]));
  const rows = (users ?? [])
    .map((user) => {
      const to = normalizeToE164US(user.phone);
      const smsEnabled = smsPreference.has(user.id) ? smsPreference.get(user.id) === true : true;
      if (!to || !smsEnabled) return null;

      return {
        user_id: user.id,
        channel: "sms",
        event_type:
          cadence === "72h"
            ? "pickup_reminder_72h"
            : cadence === "24h"
              ? "pickup_reminder_24h"
              : "pickup_reminder_day_of",
        status: "queued",
        correlation_id: correlationId,
        metadata: {
          to,
          body: buildReminderMessage(cycle.pickup_date, cadence),
          pickup_cycle_id: cycle.id,
          cadence,
        },
      };
    })
    .filter(Boolean);

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, correlationId, queued: 0 });
  }

  const { error } = await ctx.supabase.from("notification_events").insert(rows);
  if (error) return NextResponse.json({ error: error.message, correlationId }, { status: 500 });

  return NextResponse.json({ ok: true, correlationId, queued: rows.length });
}
