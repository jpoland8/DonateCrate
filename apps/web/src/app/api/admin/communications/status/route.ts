import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { getEmailConfigError, getEmailDeliveryHealth } from "@/lib/email";
import { getTwilioConfigError, getTwilioDeliveryHealth } from "@/lib/twilio";

export async function GET() {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [twilio, email] = await Promise.all([getTwilioDeliveryHealth(), getEmailDeliveryHealth()]);

  return NextResponse.json({
    channels: {
      sms: {
        ...twilio,
        configured: !getTwilioConfigError(),
        fromNumber: process.env.TWILIO_FROM_NUMBER || null,
        messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || null,
      },
      email: {
        ...email,
        configured: !getEmailConfigError(),
        fromEmail: process.env.EMAIL_FROM || null,
        fromName: "DonateCrate",
        host: "api.resend.com",
      },
    },
  });
}
