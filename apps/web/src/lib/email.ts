import { getAppUrl, getSiteUrl } from "@/lib/urls";

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

function getRequiredEnv(name: string) {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : null;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getGreetingName(fullName?: string | null) {
  return fullName?.trim()?.split(" ")[0] || "there";
}

function getEmailLogoUrl() {
  return `${getSiteUrl()}/images/logo-provided.png`;
}

function buildEmailShell(params: {
  title: string;
  intro: string;
  body: string[];
  ctaLabel: string;
  ctaHref: string;
  footer: string;
  eyebrow?: string;
  detailItems?: Array<{ label: string; value: string }>;
}) {
  const paragraphs = params.body.map((line) => `<p style="margin:0 0 14px;color:#4a5565;font-size:16px;line-height:1.6;">${escapeHtml(line)}</p>`).join("");
  const details =
    params.detailItems && params.detailItems.length > 0
      ? `<div style="margin:0 0 22px;border-radius:20px;background:#fff7f1;padding:18px 18px 4px;border:1px solid #f3ded0;">
        ${params.detailItems
          .map(
            (item) =>
              `<div style="margin:0 0 14px;">
                <div style="margin:0 0 4px;color:#9a7657;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">${escapeHtml(item.label)}</div>
                <div style="color:#181f30;font-size:16px;font-weight:700;line-height:1.4;">${escapeHtml(item.value)}</div>
              </div>`,
          )
          .join("")}
      </div>`
      : "";
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f3efe8;padding:24px;font-family:Inter,Arial,sans-serif;">
    <div style="margin:0 auto;max-width:640px;overflow:hidden;border:1px solid rgba(17,24,39,.08);border-radius:28px;background:#ffffff;box-shadow:0 24px 70px rgba(17,24,39,.08);">
      <div style="padding:24px 32px 16px;background:linear-gradient(180deg,#fffaf5 0%,#ffffff 100%);border-bottom:1px solid rgba(17,24,39,.06);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
          <div style="display:inline-flex;align-items:center;justify-content:center;padding:12px 16px;border-radius:18px;background:linear-gradient(135deg,#182033 0%,#2b3347 70%,#4c2f20 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.08);">
            <img src="${escapeHtml(getEmailLogoUrl())}" alt="DonateCrate" style="display:block;height:30px;width:auto;max-width:170px;" />
          </div>
          <div style="padding:8px 12px;border-radius:999px;background:#fff1e6;color:#b14b00;font-size:11px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;white-space:nowrap;border:1px solid #f4d6bd;">${escapeHtml(params.eyebrow || "DonateCrate")}</div>
        </div>
        <h1 style="margin:26px 0 0;color:#121926;font-size:34px;line-height:1.05;letter-spacing:-0.02em;">${escapeHtml(params.title)}</h1>
        <p style="margin:14px 0 0;max-width:480px;color:#4f5a68;font-size:16px;line-height:1.6;">${escapeHtml(params.intro)}</p>
      </div>
      <div style="padding:32px;">
        ${details}
        ${paragraphs}
        <div style="margin:24px 0 18px;">
          <a href="${escapeHtml(params.ctaHref)}" style="display:inline-block;border-radius:999px;background:#ff6a00;padding:14px 20px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;box-shadow:0 10px 24px rgba(255,106,0,.22);">${escapeHtml(params.ctaLabel)}</a>
        </div>
        <p style="margin:18px 0 0;color:#677381;font-size:13px;line-height:1.6;">${escapeHtml(params.footer)}</p>
        <p style="margin:10px 0 0;color:#8d97a4;font-size:12px;line-height:1.6;">DonateCrate helps households keep a simple monthly giving routine without a drop-off trip.</p>
      </div>
    </div>
  </body>
</html>`;
}

export function getEmailConfigError() {
  const apiKey = getRequiredEnv("RESEND_API_KEY");
  const from = getRequiredEnv("EMAIL_FROM");

  if (!apiKey) return "Resend API key is not configured";
  if (!from) return "Email from address is not configured";
  return null;
}

export async function getEmailDeliveryHealth(): Promise<DeliveryHealth> {
  const configError = getEmailConfigError();
  if (configError) {
    return { ready: false, status: "not_configured", detail: configError };
  }

  try {
    const response = await fetch("https://api.resend.com/domains", {
      headers: {
        Authorization: `Bearer ${getRequiredEnv("RESEND_API_KEY")!}`,
      },
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail =
        typeof json?.message === "string"
          ? json.message
          : typeof json?.error === "string"
            ? json.error
            : "Resend verification failed";
      return { ready: false, status: "error", detail };
    }
    return { ready: true, status: "verified", detail: "Resend API key authenticated successfully." };
  } catch (error) {
    return {
      ready: false,
      status: "error",
      detail: error instanceof Error ? error.message : "Resend verification failed",
    };
  }
}

export async function sendEmail(params: { to: string; subject: string; text: string; html: string }) {
  const configError = getEmailConfigError();
  if (configError) {
    throw new Error(configError);
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getRequiredEnv("RESEND_API_KEY")!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getRequiredEnv("EMAIL_FROM")!,
      reply_to: getRequiredEnv("EMAIL_REPLY_TO") || undefined,
      to: [params.to],
      subject: params.subject,
      text: params.text,
      html: params.html,
    }),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      typeof json?.message === "string"
        ? json.message
        : typeof json?.error === "string"
          ? json.error
          : "Resend email request failed";
    throw new Error(detail);
  }

  return {
    messageId: typeof json?.id === "string" ? json.id : null,
  };
}

export async function sendBrandedEmail(params: NotificationEmailParams & { recipient: { email: string; fullName?: string | null } }) {
  const email = buildNotificationEmailContent(params);
  return sendEmail({
    to: params.recipient.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
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
  const magicLink = typeof metadata.magic_link === "string" ? metadata.magic_link : null;
  const resetLink = typeof metadata.reset_link === "string" ? metadata.reset_link : null;
  const dashboardPath = typeof metadata.dashboard_path === "string" ? metadata.dashboard_path : "/app";
  const nextStep = typeof metadata.next_step === "string" ? metadata.next_step : null;
  const planName = typeof metadata.plan_name === "string" ? metadata.plan_name : "Monthly pickup plan";
  const statusLabel = typeof metadata.status_label === "string" ? metadata.status_label : null;
  const supportEmail = getRequiredEnv("EMAIL_REPLY_TO") || getRequiredEnv("EMAIL_FROM") || "hello@donatecrate.com";

  if (params.eventType === "account_welcome") {
    const lines = [
      `Hi ${greetingName},`,
      "Your DonateCrate account is ready.",
      "Finish billing to unlock pickup requests, reminders, and referral credits. After that, you can simply confirm each month when your bag is ready.",
    ];
    return {
      subject: "Welcome to DonateCrate",
      text: `${lines.join("\n\n")}\n\nOpen your account: ${appUrl}/app`,
      html: buildEmailShell({
        eyebrow: "Account Created",
        title: "Welcome to DonateCrate",
        intro: "Your account is open and your address has been verified for service.",
        body: lines,
        ctaLabel: "Open my account",
        ctaHref: `${appUrl}/app`,
        detailItems: nextStep ? [{ label: "Next step", value: nextStep }, { label: "Support", value: supportEmail }] : [{ label: "Support", value: supportEmail }],
        footer: "Questions are welcome. Reply to this email and the DonateCrate team will help.",
      }),
    };
  }

  if (params.eventType === "auth_magic_link" && magicLink) {
    const lines = [
      `Hi ${greetingName},`,
      "Use the secure link below to sign in to your DonateCrate account.",
      "For your security, this link should be used promptly and only by you.",
    ];
    return {
      subject: "Your DonateCrate sign-in link",
      text: `${lines.join("\n\n")}\n\nSign in: ${magicLink}`,
      html: buildEmailShell({
        eyebrow: "Secure Sign-In",
        title: "Use your sign-in link",
        intro: "This link signs you into your DonateCrate account without a password.",
        body: lines,
        ctaLabel: "Sign in securely",
        ctaHref: magicLink,
        footer: "If you did not request this email, you can safely ignore it.",
      }),
    };
  }

  if (params.eventType === "auth_password_reset" && resetLink) {
    const lines = [
      `Hi ${greetingName},`,
      "We received a request to reset your DonateCrate password.",
      "Use the secure button below to choose a new password and get back into your account.",
    ];
    return {
      subject: "Reset your DonateCrate password",
      text: `${lines.join("\n\n")}\n\nReset password: ${resetLink}`,
      html: buildEmailShell({
        eyebrow: "Password Reset",
        title: "Reset your password",
        intro: "Use the secure link below to set a new DonateCrate password.",
        body: lines,
        ctaLabel: "Reset password",
        ctaHref: resetLink,
        footer: "If you did not request a password reset, you can ignore this email and your password will stay the same.",
      }),
    };
  }

  if (params.eventType === "billing_plan_active") {
    const lines = [
      `Hi ${greetingName},`,
      "Your DonateCrate plan is now active.",
      "You can return to your account anytime to request the current pickup cycle, skip a month, or manage your reminders.",
    ];
    return {
      subject: "Your DonateCrate plan is active",
      text: `${lines.join("\n\n")}\n\nOpen your account: ${appUrl}${dashboardPath}`,
      html: buildEmailShell({
        eyebrow: "Billing Activated",
        title: "Your plan is active",
        intro: "Billing is complete and your account is ready for monthly pickup requests.",
        body: lines,
        ctaLabel: "Open my account",
        ctaHref: `${appUrl}${dashboardPath}`,
        detailItems: [
          { label: "Plan", value: planName },
          { label: "Status", value: statusLabel || "Active" },
        ],
        footer: "You will receive pickup reminders and account notices according to your communication settings.",
      }),
    };
  }

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
        eyebrow: cadence === "day_of" ? "Pickup Day" : "Pickup Reminder",
        title: subject,
        intro,
        body: lines,
        ctaLabel: "Open my account",
        ctaHref: `${appUrl}/app`,
        detailItems: pickupDate ? [{ label: "Scheduled pickup", value: pickupDate }] : undefined,
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
        eyebrow: "Billing Issue",
        title: "Update your billing details",
        intro: "Your latest DonateCrate payment did not go through.",
        body: lines,
        ctaLabel: "Review billing",
        ctaHref: invoiceUrl || `${appUrl}/app/billing`,
        detailItems: [{ label: "Plan", value: planName }, { label: "Status", value: "Payment needed" }],
        footer: "If you already updated your card, you can ignore this email and we will retry automatically.",
      }),
    };
  }

  if (params.eventType === "billing_subscription_canceled") {
    const lines = [
      `Hi ${greetingName},`,
      "Your DonateCrate plan has been canceled.",
      "You can still sign back in anytime if you want to restart monthly pickups later.",
    ];
    return {
      subject: "Your DonateCrate plan has ended",
      text: `${lines.join("\n\n")}\n\nVisit DonateCrate: ${siteUrl}`,
      html: buildEmailShell({
        eyebrow: "Billing Update",
        title: "Your plan has ended",
        intro: "Monthly billing has been stopped for your DonateCrate account.",
        body: lines,
        ctaLabel: "Visit DonateCrate",
        ctaHref: siteUrl,
        detailItems: [{ label: "Plan", value: planName }, { label: "Status", value: statusLabel || "Canceled" }],
        footer: "If this happened by mistake, you can sign in anytime and start billing again.",
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
      eyebrow: "Account Update",
      title: "There is a new update on your account",
      intro: "Open your account to review the latest activity and next steps.",
      body: lines,
      ctaLabel: "Open my account",
      ctaHref: `${appUrl}/app`,
      footer: "This email was sent by DonateCrate.",
    }),
  };
}
