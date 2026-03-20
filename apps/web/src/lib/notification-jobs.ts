import type { SupabaseClient } from "@supabase/supabase-js";
import { buildNotificationEmailContent, sendEmail } from "@/lib/email";
import { getNotificationRetryState } from "@/lib/notification-health";
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
  const retryState = getNotificationRetryState(event);
  if (!retryState.canRetry && event.status === "failed") {
    await supabase
      .from("notification_events")
      .update({
        last_error: retryState.detail,
      })
      .eq("id", event.id);

    return { ok: false, status: "skipped" as const, error: retryState.detail };
  }

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

    const { data: user } = event.user_id
      ? await supabase.from("users").select("email,full_name").eq("id", event.user_id).maybeSingle()
      : { data: null };
    const to = user?.email ?? (typeof metadata.to === "string" ? metadata.to : null);

    if (!to) {
      throw new Error("Email notification is missing recipient email");
    }

    const email = buildNotificationEmailContent({
      eventType: event.event_type,
      recipient: {
        email: to,
        fullName: user?.full_name ?? (typeof metadata.full_name === "string" ? metadata.full_name : null),
      },
      metadata,
    });

    const provider = await sendEmail({
      to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    await supabase
      .from("notification_events")
      .update({
        status: "sent",
        provider_message_id: provider.messageId,
        attempt_count: attemptCount,
        last_attempt_at: attemptTime,
        last_error: null,
      })
      .eq("id", event.id);

    return { ok: true, status: "sent" as const, providerMessageId: provider.messageId };
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
