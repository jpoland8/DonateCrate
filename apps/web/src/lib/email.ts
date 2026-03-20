import nodemailer from "nodemailer";

type EmailRecipient = {
  email: string | null;
  fullName?: string | null;
};

type NotificationEmailParams = {
  eventType: string;
  recipient: EmailRecipient;
  metadata?: Record<string, unknown> | null;
};

type EmailContent = {
  subject: string;
  text: string;
  html: string;
};

type DeliveryHealth =
  | { ready: false; status: "not_configured" | "error"; detail: string }
  | { ready: true; status: "verified"; detail: string };

let transporterCache: nodemailer.Transporter | null = null;

function getRequiredEnv(name: string) {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : null;
}

function parseSmtpPort(value: string | null) {
  if (!value) return 587;
  const port = Number(value);
  return Number.isFinite(port) && port > 0 ? port : 587;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || getAppUrl();
}

function getGreetingName(fullName?: string | null) {
  return fullName?.trim()?.split(" ")[0] || "there";
}

function buildEmailShell(params: { title: string; intro: string; body: string[]; ctaLabel: string; ctaHref: string; footer: string }) {
  const paragraphs = params.body.map((line) => `<p style="margin:0 0 14px;color:#4a5565;font-size:16px;line-height:1.6;">${escapeHtml(line)}</p>`).join("");
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f1eb;padding:24px;font-family:Inter,Arial,sans-serif;">
    <div style="margin:0 auto;max-width:640px;overflow:hidden;border:1px solid rgba(17,24,39,.08);border-radius:28px;background:#ffffff;box-shadow:0 20px 60px rgba(17,24,39,.08);">
      <div style="background:linear-gradient(135deg,#181f30 0%,#3b2a25 60%,#ff6a00 130%);padding:28px 32px;color:#ffffff;">
        <div style="font-size:12px;font-weight:700;letter-spacing:.28em;text-transform:uppercase;opacity:.82;">DonateCrate</div>
        <h1 style="margin:14px 0 0;font-size:34px;line-height:1.05;">${escapeHtml(params.title)}</h1>
        <p style="margin:14px 0 0;max-width:440px;color:rgba(255,255,255,.82);font-size:16px;line-height:1.6;">${escapeHtml(params.intro)}</p>
      </div>
      <div style="padding:32px;">
        ${paragraphs}
        <div style="margin:24px 0 18px;">
          <a href="${escapeHtml(params.ctaHref)}" style="display:inline-block;border-radius:999px;background:#ff6a00;padding:14px 20px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">${escapeHtml(params.ctaLabel)}</a>
        </div>
        <p style="margin:18px 0 0;color:#718096;font-size:13px;line-height:1.6;">${escapeHtml(params.footer)}</p>
      </div>
    </div>
  </body>
</html>`;
}

export function getSmtpConfigError() {
  const host = getRequiredEnv("SMTP_HOST");
  const username = getRequiredEnv("SMTP_USERNAME");
  const password = getRequiredEnv("SMTP_PASSWORD");
  const fromEmail = getRequiredEnv("SMTP_FROM_EMAIL");

  if (!host) return "SMTP host is not configured";
  if (!username || !password) return "SMTP username and password are required";
  if (!fromEmail) return "SMTP from email is not configured";
  return null;
}

function getTransporter() {
  if (transporterCache) return transporterCache;

  const configError = getSmtpConfigError();
  if (configError) {
    throw new Error(configError);
  }

  transporterCache = nodemailer.createTransport({
    host: getRequiredEnv("SMTP_HOST")!,
    port: parseSmtpPort(getRequiredEnv("SMTP_PORT")),
    secure: getRequiredEnv("SMTP_SECURE") === "true" || parseSmtpPort(getRequiredEnv("SMTP_PORT")) === 465,
    auth: {
      user: getRequiredEnv("SMTP_USERNAME")!,
      pass: getRequiredEnv("SMTP_PASSWORD")!,
    },
  });

  return transporterCache;
}

export async function getSmtpDeliveryHealth(): Promise<DeliveryHealth> {
  const configError = getSmtpConfigError();
  if (configError) {
    return { ready: false, status: "not_configured", detail: configError };
  }

  try {
    await getTransporter().verify();
    return { ready: true, status: "verified", detail: "SMTP relay authenticated successfully." };
  } catch (error) {
    return {
      ready: false,
      status: "error",
      detail: error instanceof Error ? error.message : "SMTP verification failed",
    };
  }
}

export async function sendSmtpEmail(params: { to: string; subject: string; text: string; html: string }) {
  const configError = getSmtpConfigError();
  if (configError) {
    throw new Error(configError);
  }

  const fromName = getRequiredEnv("SMTP_FROM_NAME") || "DonateCrate";
  const fromEmail = getRequiredEnv("SMTP_FROM_EMAIL")!;
  const replyTo = getRequiredEnv("SMTP_REPLY_TO") || fromEmail;

  const result = await getTransporter().sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: params.to,
    replyTo,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });

  return {
    messageId: typeof result.messageId === "string" ? result.messageId : null,
  };
}

export function buildNotificationEmailContent(params: NotificationEmailParams): EmailContent {
  const metadata = (params.metadata ?? {}) as Record<string, unknown>;
  const customSubject = typeof metadata.subject === "string" ? metadata.subject : null;
  const customText = typeof metadata.text === "string" ? metadata.text : null;
  const customHtml = typeof metadata.html === "string" ? metadata.html : null;

  if (customSubject && customText && customHtml) {
    return {
      subject: customSubject,
      text: customText,
      html: customHtml,
    };
  }

  const appUrl = getAppUrl();
  const siteUrl = getSiteUrl();
  const greetingName = getGreetingName(params.recipient.fullName);
  const cadence = typeof metadata.cadence === "string" ? metadata.cadence : null;
  const pickupDateRaw = typeof metadata.pickup_date === "string" ? metadata.pickup_date : null;
  const pickupDate = pickupDateRaw
    ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(pickupDateRaw))
    : null;
  const invoiceUrl = typeof metadata.invoice_url === "string" ? metadata.invoice_url : null;

  if (params.eventType.startsWith("pickup_reminder")) {
    const subject =
      cadence === "72h"
        ? "Your DonateCrate pickup is coming up"
        : cadence === "24h"
          ? "Your DonateCrate pickup is tomorrow"
          : "Pickup day is here";
    const intro =
      cadence === "72h"
        ? "Your next monthly pickup is getting close."
        : cadence === "24h"
          ? "Your bag should be ready by tomorrow."
          : "Today is pickup day for your DonateCrate bag.";
    const lines = [
      `Hi ${greetingName},`,
      pickupDate
        ? `We are scheduled to stop by on ${pickupDate}. Keep your orange bag ready and place it out before route time.`
        : "Keep your orange bag ready and place it out before route time.",
      "If anything has changed, open your account to confirm or skip this month before the route is finalized.",
    ];
    return {
      subject,
      text: `${lines.join("\n\n")}\n\nManage your account: ${appUrl}`,
      html: buildEmailShell({
        title: subject,
        intro,
        body: lines,
        ctaLabel: "Open my account",
        ctaHref: `${appUrl}/app`,
        footer: "You are receiving this because reminder email is enabled on your DonateCrate account.",
      }),
    };
  }

  if (params.eventType === "billing_payment_failed") {
    const lines = [
      `Hi ${greetingName},`,
      "We could not process your latest DonateCrate payment.",
      "Please review your payment method so your monthly pickup plan and reminders continue without interruption.",
    ];
    return {
      subject: "Action needed: update your DonateCrate billing",
      text: `${lines.join("\n\n")}\n\nReview billing: ${invoiceUrl || `${appUrl}/app/billing`}\n\nLearn more: ${siteUrl}`,
      html: buildEmailShell({
        title: "Update your billing details",
        intro: "Your latest DonateCrate payment did not go through.",
        body: lines,
        ctaLabel: "Review billing",
        ctaHref: invoiceUrl || `${appUrl}/app/billing`,
        footer: "If you already updated your card, you can ignore this email and we will retry automatically.",
      }),
    };
  }

  const lines = [
    `Hi ${greetingName},`,
    "There is a new update on your DonateCrate account.",
    "Open your account to review the latest activity and next steps.",
  ];
  return {
    subject: "An update from DonateCrate",
    text: `${lines.join("\n\n")}\n\nOpen your account: ${appUrl}/app`,
    html: buildEmailShell({
      title: "There is a new update on your account",
      intro: "Open your account to review the latest activity and next steps.",
      body: lines,
      ctaLabel: "Open my account",
      ctaHref: `${appUrl}/app`,
      footer: "This email was sent by DonateCrate.",
    }),
  };
}
