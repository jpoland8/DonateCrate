import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { getSmtpConfigError, getSmtpDeliveryHealth } from "@/lib/email";
import { getTwilioConfigError, getTwilioDeliveryHealth } from "@/lib/twilio";

export async function GET() {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [twilio, smtp] = await Promise.all([getTwilioDeliveryHealth(), getSmtpDeliveryHealth()]);

  return NextResponse.json({
    channels: {
      sms: {
        ...twilio,
        configured: !getTwilioConfigError(),
        fromNumber: process.env.TWILIO_FROM_NUMBER || null,
        messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || null,
      },
      email: {
        ...smtp,
        configured: !getSmtpConfigError(),
        fromEmail: process.env.SMTP_FROM_EMAIL || null,
        fromName: process.env.SMTP_FROM_NAME || "DonateCrate",
        host: process.env.SMTP_HOST || null,
      },
    },
  });
}
