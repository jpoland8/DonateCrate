import { NextResponse } from "next/server";
import { z } from "zod";
import { createCorrelationId, getAuthenticatedContext } from "@/lib/api-auth";
import { sendBrandedEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/urls";

const bodySchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).optional(),
});

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const correlationId = createCorrelationId("email_samples");
  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", correlationId }, { status: 400 });
  }

  const recipient = {
    email: parsed.data.email.trim().toLowerCase(),
    fullName: parsed.data.fullName ?? ctx.profile.full_name ?? "DonateCrate Member",
  };

  const _sampleDateObj = new Date();
  _sampleDateObj.setDate(_sampleDateObj.getDate() + 5);
  const pickupDate = _sampleDateObj.toISOString();
  const resetLink = `${getAppUrl()}/reset-password`;
  const magicLink = `${getAppUrl()}/auth/callback?next=${encodeURIComponent("/app")}`;
  const pickupWindowLabel = "9:00 am – 1:00 pm";
  const sampleEvents = [
    { eventType: "account_welcome", metadata: { next_step: "Complete billing to activate your monthly pickup plan." } },
    { eventType: "account_welcome", metadata: { waitlisted: "true" } },
    { eventType: "auth_magic_link", metadata: { magic_link: magicLink } },
    { eventType: "auth_password_reset", metadata: { reset_link: resetLink } },
    {
      eventType: "billing_plan_active",
      metadata: {
        plan_name: "DonateCrate monthly pickup plan",
        status_label: "Active",
        dashboard_path: "/app",
      },
    },
    {
      eventType: "billing_payment_failed",
      metadata: {
        invoice_url: `${getAppUrl()}/app/settings`,
        plan_name: "DonateCrate monthly pickup plan",
      },
    },
    {
      eventType: "billing_subscription_canceled",
      metadata: {
        plan_name: "DonateCrate monthly pickup plan",
        status_label: "Canceled",
      },
    },
    { eventType: "pickup_reminder_72h", metadata: { cadence: "72h", pickup_date: pickupDate, pickup_window_label: pickupWindowLabel } },
    { eventType: "pickup_reminder_24h", metadata: { cadence: "24h", pickup_date: pickupDate, pickup_window_label: pickupWindowLabel } },
    { eventType: "pickup_reminder_day_of", metadata: { cadence: "day_of", pickup_date: pickupDate, pickup_window_label: pickupWindowLabel } },
    { eventType: "pickup_missed", metadata: { pickup_date: pickupDate } },
  ] as const;

  const results = [];
  for (const sample of sampleEvents) {
    try {
      const provider = await sendBrandedEmail({
        eventType: sample.eventType,
        recipient,
        metadata: sample.metadata,
      });
      results.push({
        eventType: sample.eventType,
        status: "sent",
        messageId: provider.messageId,
      });
    } catch (error) {
      results.push({
        eventType: sample.eventType,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown email error",
      });
    }
    await wait(300);
  }

  return NextResponse.json({
    ok: true,
    correlationId,
    sent: results.filter((item) => item.status === "sent").length,
    failed: results.filter((item) => item.status === "failed").length,
    results,
  });
}
