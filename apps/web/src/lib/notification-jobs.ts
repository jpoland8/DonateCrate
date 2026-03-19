import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTwilioSms } from "@/lib/twilio";

type NotificationEventRow = {
  id: string;
  user_id: string | null;
  channel: "email" | "sms";
  event_type: string;
  status: string;
  provider_message_id: string | null;
  attempt_count?: number | null;
  correlation_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function processNotificationEvent(params: {
  supabase: SupabaseClient;
  event: NotificationEventRow;
}) {
  const { supabase, event } = params;
  const attemptCount = (event.attempt_count ?? 0) + 1;
  const attemptTime = new Date().toISOString();
  const metadata = (event.metadata ?? {}) as Record<string, unknown>;

  try {
    if (event.channel === "sms") {
      const to = typeof metadata.to === "string" ? metadata.to : null;
      const body = typeof metadata.body === "string" ? metadata.body : null;
      if (!to || !body) {
        throw new Error("SMS notification is missing destination or body");
      }

      const provider = await sendTwilioSms({ to, body });
      await supabase
        .from("notification_events")
        .update({
          status: "sent",
          provider_message_id: provider.sid,
          attempt_count: attemptCount,
          last_attempt_at: attemptTime,
          last_error: null,
        })
        .eq("id", event.id);

      return { ok: true, status: "sent" as const, providerMessageId: provider.sid };
    }

    throw new Error("Email delivery provider is not configured yet");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown notification send error";
    await supabase
      .from("notification_events")
      .update({
        status: "failed",
        attempt_count: attemptCount,
        last_attempt_at: attemptTime,
        last_error: message,
      })
      .eq("id", event.id);

    return { ok: false, status: "failed" as const, error: message };
  }
}
