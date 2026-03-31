import { NextResponse } from "next/server";
import { createCorrelationId } from "@/lib/api-auth";
import { processNotificationEvent } from "@/lib/notification-jobs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendTwilioSms, normalizeToE164US } from "@/lib/twilio";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token =
    url.searchParams.get("token") ||
    request.headers.get("authorization")?.replace("Bearer ", "");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || token !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const correlationId = createCorrelationId("cron_process");
  const supabase = createSupabaseAdminClient();

  const { data: events, error } = await supabase
    .from("notification_events")
    .select("id,user_id,channel,event_type,status,provider_message_id,attempt_count,correlation_id,metadata")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message, correlationId }, { status: 500 });
  }

  if (!events || events.length === 0) {
    // Still process scheduled reminders even if no queued events
    const scheduledResults = await processScheduledReminders(supabase);
    return NextResponse.json({ ok: true, correlationId, processed: 0, sent: 0, failed: 0, scheduled: scheduledResults });
  }

  const results = [];
  for (const event of events) {
    const result = await processNotificationEvent({
      supabase,
      event: {
        ...event,
        channel: event.channel as "email" | "sms",
      },
    });
    results.push({ id: event.id, eventType: event.event_type, ...result });
  }

  // --- Process scheduled reminders whose time has arrived ---
  const scheduledResults = await processScheduledReminders(supabase);

  return NextResponse.json({
    ok: true,
    correlationId,
    processed: results.length,
    sent: results.filter((item) => item.status === "sent").length,
    failed: results.filter((item) => item.status === "failed").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    results,
    scheduled: scheduledResults,
  });
}

async function processScheduledReminders(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const now = new Date().toISOString();

  const { data: scheduledEvents, error } = await supabase
    .from("notification_events")
    .select("id,metadata")
    .eq("status", "scheduled")
    .eq("event_type", "admin_scheduled_sms")
    .lte("metadata->>scheduled_for", now)
    .order("created_at", { ascending: true })
    .limit(20);

  if (error || !scheduledEvents || scheduledEvents.length === 0) {
    return { processed: 0 };
  }

  const summaries = [];

  for (const event of scheduledEvents) {
    const meta = event.metadata as {
      message: string;
      targetType: "zone" | "all";
      zoneId?: string | null;
      includeStaff?: boolean;
      scheduled_for: string;
      created_by: string;
    };

    // Resolve recipients based on targetType
    let userQuery = supabase
      .from("users")
      .select("id,phone,role")
      .not("phone", "is", null);

    if (meta.targetType === "zone" && meta.zoneId) {
      // Get users who have an active subscription in this zone
      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("user_id")
        .eq("zone_id", meta.zoneId)
        .eq("status", "active");

      const zoneUserIds = (subscriptions ?? []).map((s) => s.user_id);
      if (zoneUserIds.length === 0) {
        await supabase
          .from("notification_events")
          .update({
            status: "sent",
            metadata: { ...meta, sent_count: 0, failed_count: 0, processed_at: new Date().toISOString() },
          })
          .eq("id", event.id);
        summaries.push({ id: event.id, sent: 0, failed: 0 });
        continue;
      }

      userQuery = userQuery.in("id", zoneUserIds);
    } else {
      // "all" — get users with active subscriptions
      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("user_id")
        .eq("status", "active");

      const activeUserIds = [...new Set((subscriptions ?? []).map((s) => s.user_id))];
      if (activeUserIds.length === 0) {
        await supabase
          .from("notification_events")
          .update({
            status: "sent",
            metadata: { ...meta, sent_count: 0, failed_count: 0, processed_at: new Date().toISOString() },
          })
          .eq("id", event.id);
        summaries.push({ id: event.id, sent: 0, failed: 0 });
        continue;
      }

      userQuery = userQuery.in("id", activeUserIds);
    }

    if (!meta.includeStaff) {
      userQuery = userQuery.eq("role", "customer");
    }

    const { data: users } = await userQuery;

    // Filter to users with SMS enabled
    const userIds = (users ?? []).map((u) => u.id);
    const { data: prefs } = userIds.length > 0
      ? await supabase
          .from("notification_preferences")
          .select("user_id,sms_enabled")
          .in("user_id", userIds)
      : { data: [] };

    const prefsMap = new Map((prefs ?? []).map((p) => [p.user_id, p]));

    // Send SMS to each eligible recipient
    let sentCount = 0;
    let failedCount = 0;
    const deliveryRows: Array<Record<string, unknown>> = [];

    for (const user of users ?? []) {
      const pref = prefsMap.get(user.id);
      const smsEnabled = pref ? pref.sms_enabled === true : true;
      if (!smsEnabled) continue;

      const to = normalizeToE164US(user.phone);
      if (!to) continue;

      let deliveryStatus = "sent";
      let deliveryError: string | null = null;
      let sid: string | null = null;

      try {
        const result = await sendTwilioSms({ to, body: meta.message });
        sid = result.sid;
        sentCount++;
      } catch (err) {
        deliveryStatus = "failed";
        deliveryError = err instanceof Error ? err.message : "Send failed";
        failedCount++;
      }

      deliveryRows.push({
        user_id: user.id,
        channel: "sms",
        event_type: "admin_scheduled_sms_delivery",
        status: deliveryStatus,
        provider_message_id: sid,
        last_error: deliveryError,
        metadata: {
          to,
          body: meta.message,
          parent_event_id: event.id,
        },
      });
    }

    // Insert delivery log rows
    if (deliveryRows.length > 0) {
      await supabase.from("notification_events").insert(deliveryRows);
    }

    // Update parent event to sent
    await supabase
      .from("notification_events")
      .update({
        status: "sent",
        metadata: {
          ...meta,
          sent_count: sentCount,
          failed_count: failedCount,
          processed_at: new Date().toISOString(),
        },
      })
      .eq("id", event.id);

    summaries.push({ id: event.id, sent: sentCount, failed: failedCount });
  }

  return { processed: summaries.length, details: summaries };
}
