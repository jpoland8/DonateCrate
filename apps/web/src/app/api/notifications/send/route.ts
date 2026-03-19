import { NextResponse } from "next/server";
import { z } from "zod";
import { createCorrelationId, getAuthenticatedContext } from "@/lib/api-auth";
import { processNotificationEvent } from "@/lib/notification-jobs";

const bodySchema = z.object({
  eventIds: z.array(z.string().uuid()).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export async function POST(request: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const correlationId = createCorrelationId("notify");
  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", correlationId }, { status: 400 });
  }

  const query = ctx.supabase
    .from("notification_events")
    .select("id,user_id,channel,event_type,status,provider_message_id,attempt_count,correlation_id,metadata")
    .in("status", ["queued", "failed"])
    .order("created_at", { ascending: true })
    .limit(parsed.data.limit ?? 25);

  const eventQuery =
    parsed.data.eventIds && parsed.data.eventIds.length > 0 ? query.in("id", parsed.data.eventIds) : query;
  const { data: events, error } = await eventQuery;

  if (error) return NextResponse.json({ error: error.message, correlationId }, { status: 500 });

  const results = [];
  for (const event of events ?? []) {
    const result = await processNotificationEvent({
      supabase: ctx.supabase,
      event: {
        ...event,
        channel: event.channel as "email" | "sms",
      },
    });
    results.push({ id: event.id, eventType: event.event_type, ...result });
  }

  return NextResponse.json({
    ok: true,
    correlationId,
    attempted: results.length,
    sent: results.filter((item) => item.status === "sent").length,
    failed: results.filter((item) => item.status === "failed").length,
    results,
  });
}
