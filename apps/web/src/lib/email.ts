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

type CobrandOptions = {
  partnerName: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  websiteUrl?: string | null;
  receiptFooter?: string | null;
};

function buildEmailShell(params: {
  title: string;
  intro: string;
  body: string[];
  ctaLabel: string;
  ctaHref: string;
  footer: string;
  eyebrow?: string;
  detailItems?: Array<{ label: string; value: string }>;
  cobrand?: CobrandOptions;
  accentVariant?: "orange" | "teal" | "red" | "neutral";
}) {
  const co = params.cobrand;
  const eyebrowColor = co?.primaryColor || "#b14b00";
  const eyebrowBg = co?.primaryColor ? `${co.primaryColor}18` : "#fff1e6";
  const eyebrowBorder = co?.primaryColor ? `${co.primaryColor}40` : "#f4d6bd";
  const accentGradient =
    params.accentVariant === "teal"
      ? "linear-gradient(90deg,#0f766e 0%,#14b8a6 100%)"
      : params.accentVariant === "red"
        ? "linear-gradient(90deg,#b91c1c 0%,#ef4444 100%)"
        : params.accentVariant === "neutral"
          ? "linear-gradient(90deg,#374151 0%,#6b7280 100%)"
          : "linear-gradient(90deg,#ff6a00 0%,#ff8a2e 100%)";

  const partnerLogoHtml = co?.logoUrl
    ? `<img src="${escapeHtml(co.logoUrl)}" alt="${escapeHtml(co.partnerName)}" style="display:block;height:28px;width:auto;max-width:100px;" />`
    : "";

  const logoAreaHtml = co
    ? `<div style="display:inline-flex;align-items:center;gap:12px;">
        <div style="display:inline-flex;align-items:center;justify-content:center;padding:12px 16px;border-radius:18px;background:linear-gradient(135deg,#182033 0%,#2b3347 70%,#4c2f20 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.08);">
          <img src="${escapeHtml(getEmailLogoUrl())}" alt="DonateCrate" style="display:block;height:30px;width:auto;max-width:170px;" />
        </div>
        <span style="color:#9a9fa8;font-size:18px;font-weight:300;">&times;</span>
        ${partnerLogoHtml ? `<div style="display:inline-flex;align-items:center;justify-content:center;padding:8px 12px;border-radius:14px;background:#f8f8f8;border:1px solid #e8e8e8;">${partnerLogoHtml}</div>` : `<span style="color:#2b3347;font-size:15px;font-weight:700;">${escapeHtml(co.partnerName)}</span>`}
      </div>`
    : `<div style="display:inline-flex;align-items:center;justify-content:center;padding:12px 16px;border-radius:18px;background:linear-gradient(135deg,#182033 0%,#2b3347 70%,#4c2f20 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.08);">
        <img src="${escapeHtml(getEmailLogoUrl())}" alt="DonateCrate" style="display:block;height:30px;width:auto;max-width:170px;" />
      </div>`;

  const partnerFooterHtml = co?.receiptFooter
    ? `<p style="margin:10px 0 0;color:#8d97a4;font-size:12px;line-height:1.6;">${escapeHtml(co.receiptFooter)}</p>`
    : "";

  const appUrl = getAppUrl();
  const siteUrl = getSiteUrl();
  const supportEmail = getRequiredEnv("EMAIL_REPLY_TO") || getRequiredEnv("EMAIL_FROM") || "hello@donatecrate.com";

  const paragraphs = params.body
    .map(
      (line) =>
        `<tr><td style="padding:0 0 16px;color:#3d4756;font-size:16px;line-height:1.65;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${escapeHtml(line)}</td></tr>`,
    )
    .join("");

  const detailRows =
    params.detailItems && params.detailItems.length > 0
      ? params.detailItems
          .map(
            (item) =>
              `<td style="padding:12px 16px;vertical-align:top;">
                <div style="margin:0 0 3px;color:#a0845e;font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${escapeHtml(item.label)}</div>
                <div style="color:#1a2233;font-size:15px;font-weight:600;line-height:1.35;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${escapeHtml(item.value)}</div>
              </td>`,
          )
          .join("")
      : "";
  const detailsHtml = detailRows
    ? `<tr><td style="padding:0 0 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:16px;background:linear-gradient(135deg,#fffaf5 0%,#fff5ed 100%);border:1px solid #f0dcc8;">
          <tr>${detailRows}</tr>
        </table>
      </td></tr>`
    : "";

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(params.title)}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
    table,td{mso-table-lspace:0;mso-table-rspace:0;}
    img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none;}
    @media only screen and (max-width:620px){
      .email-container{width:100% !important;max-width:100% !important;}
      .stack-column{display:block !important;width:100% !important;}
      .mobile-pad{padding-left:20px !important;padding-right:20px !important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f3efe8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Preheader (hidden preview text) -->
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
    ${escapeHtml(params.intro)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <!-- Outer wrapper -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f3efe8;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Email card -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="email-container" style="width:600px;max-width:600px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(17,24,39,.06),0 20px 60px rgba(17,24,39,.06);">

          <!-- Top accent bar -->
          <tr>
            <td style="height:5px;background:${accentGradient};line-height:5px;font-size:5px;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding:28px 36px 24px;background:linear-gradient(180deg,#fffbf7 0%,#ffffff 100%);border-bottom:1px solid #f0ebe3;" class="mobile-pad">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="vertical-align:middle;">
                    ${logoAreaHtml}
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:${escapeHtml(eyebrowBg)};color:${escapeHtml(eyebrowColor)};font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;white-space:nowrap;border:1px solid ${escapeHtml(eyebrowBorder)};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${escapeHtml(params.eyebrow || "DonateCrate")}</div>
                  </td>
                </tr>
              </table>

              <!-- Title -->
              <h1 style="margin:28px 0 0;padding:0;color:#0f1724;font-size:28px;font-weight:800;line-height:1.15;letter-spacing:-0.02em;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${escapeHtml(params.title)}</h1>
              <p style="margin:12px 0 0;padding:0;color:#566070;font-size:15px;line-height:1.6;max-width:460px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${escapeHtml(params.intro)}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px 8px;" class="mobile-pad">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${detailsHtml}
                ${paragraphs}
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding:8px 36px 16px;" class="mobile-pad">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-radius:999px;background:linear-gradient(135deg,#ff6a00 0%,#ff8a2e 100%);" align="center">
                    <!--[if mso]><i style="letter-spacing:28px;mso-font-width:-100%;mso-text-raise:14pt">&#8195;</i><![endif]-->
                    <a href="${escapeHtml(params.ctaHref)}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.01em;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;mso-padding-alt:0;">${escapeHtml(params.ctaLabel)}</a>
                    <!--[if mso]><i style="letter-spacing:28px;mso-font-width:-100%">&#8195;</i><![endif]-->
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:8px 36px 0;" class="mobile-pad">
              <div style="height:1px;background:linear-gradient(90deg,transparent 0%,#e8e3dc 20%,#e8e3dc 80%,transparent 100%);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px 28px;" class="mobile-pad">
              <p style="margin:0 0 8px;color:#8a919e;font-size:13px;line-height:1.6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${escapeHtml(params.footer)}</p>
              ${partnerFooterHtml}
              <p style="margin:12px 0 0;color:#b0b7c3;font-size:12px;line-height:1.6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">DonateCrate helps households keep a simple monthly giving routine without a drop-off trip.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
                <tr>
                  <td style="padding-right:16px;">
                    <a href="${escapeHtml(siteUrl)}" style="color:#a0845e;font-size:12px;font-weight:600;text-decoration:none;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Website</a>
                  </td>
                  <td style="padding-right:16px;">
                    <a href="${escapeHtml(appUrl)}/app" style="color:#a0845e;font-size:12px;font-weight:600;text-decoration:none;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">My Account</a>
                  </td>
                  <td>
                    <a href="mailto:${escapeHtml(supportEmail)}" style="color:#a0845e;font-size:12px;font-weight:600;text-decoration:none;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Support</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Email card -->

        <!-- Sub-footer -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="email-container" style="width:600px;max-width:600px;">
          <tr>
            <td align="center" style="padding:20px 16px 8px;">
              <p style="margin:0;color:#a8a19a;font-size:11px;line-height:1.5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
                &copy; ${new Date().getFullYear()} DonateCrate &middot; Curbside donation pickup for busy households
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

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
    const isWaitlisted = metadata.waitlisted === "true";
    if (isWaitlisted) {
      const lines = [
        `Hi ${greetingName},`,
        "Your DonateCrate account is all set. We've noted your address and added you to the waitlist for your area — you're already in line.",
        "When we launch routes near you, we'll send you an email right away so you can activate your pickup plan without any extra steps.",
        "In the meantime, share your referral link with neighbors. The more local interest we see, the sooner we expand.",
      ];
      return {
        subject: "You're on the DonateCrate waitlist",
        text: `${lines.join("\n\n")}\n\nOpen your account: ${appUrl}/app`,
        html: buildEmailShell({
          eyebrow: "On the Waitlist",
          title: "You're on the list.",
          intro: "Your account is ready. We'll reach out as soon as service comes to your area.",
          body: lines,
          ctaLabel: "View my account",
          ctaHref: `${appUrl}/app`,
          accentVariant: "teal",
          detailItems: [
            { label: "Status", value: "Waitlisted — spot saved" },
            { label: "Support", value: supportEmail },
          ],
          footer: "You'll get an email the moment service opens near you. No action needed until then.",
        }),
      };
    }
    const lines = [
      `Hi ${greetingName},`,
      "Your DonateCrate account is ready and your address is verified for service.",
      nextStep || "Complete your billing setup to unlock monthly pickup requests, pre-pickup reminders, and referral credits.",
      "Once billing is active, you're on the route by default every month. For your first pickup, set out any garbage bag with a note that says \"DonateCrate.\" After that, we'll leave you a reusable DonateCrate bag at your door and swap it out every pickup — no extra steps needed.",
    ];
    return {
      subject: "Welcome to DonateCrate",
      text: `${lines.join("\n\n")}\n\nOpen your account: ${appUrl}/app`,
      html: buildEmailShell({
        eyebrow: "Account Created",
        title: "Welcome to DonateCrate.",
        intro: "Your account is open. One step left to start your first pickup.",
        body: lines,
        ctaLabel: "Complete setup",
        ctaHref: `${appUrl}/app`,
        detailItems: [
          { label: "Next step", value: nextStep || "Add billing to activate" },
          { label: "Support", value: supportEmail },
        ],
        footer: "Have questions? Reply to this email — the DonateCrate team will help.",
      }),
    };
  }

  if (params.eventType === "auth_magic_link" && magicLink) {
    const lines = [
      `Hi ${greetingName},`,
      "Click the button below to sign in to your DonateCrate account instantly — no password needed.",
      "This link is single-use and expires shortly. If you didn't request it, you can safely ignore this email.",
    ];
    return {
      subject: "Your DonateCrate sign-in link",
      text: `${lines.join("\n\n")}\n\nSign in: ${magicLink}`,
      html: buildEmailShell({
        eyebrow: "Secure Sign-In",
        title: "Here's your sign-in link.",
        intro: "One click to get into your account — no password required.",
        body: lines,
        ctaLabel: "Sign in to DonateCrate",
        ctaHref: magicLink,
        accentVariant: "neutral",
        footer: "If you did not request this email, no action is needed — your account is safe.",
      }),
    };
  }

  if (params.eventType === "auth_password_reset" && resetLink) {
    const lines = [
      `Hi ${greetingName},`,
      "We received a request to reset the password on your DonateCrate account.",
      "Click the button below to create a new password. The link is time-sensitive, so use it soon.",
      "If you didn't request a reset, no action is needed — your password has not changed.",
    ];
    return {
      subject: "Reset your DonateCrate password",
      text: `${lines.join("\n\n")}\n\nReset password: ${resetLink}`,
      html: buildEmailShell({
        eyebrow: "Password Reset",
        title: "Reset your password.",
        intro: "Choose a new password to restore access to your account.",
        body: lines,
        ctaLabel: "Set new password",
        ctaHref: resetLink,
        accentVariant: "neutral",
        footer: "This link expires soon. If you didn't request a reset, your account is unchanged — no further action is needed.",
      }),
    };
  }

  if (params.eventType === "billing_plan_active") {
    const lines = [
      `Hi ${greetingName},`,
      "Your DonateCrate plan is now active — you're all set for monthly curbside pickup.",
      "You're on the route by default every month. When a pickup cycle opens, we'll send a reminder. Just have a bag of donations ready by the curb and we'll take care of the rest.",
      "You can skip any month, update your address, or manage notifications anytime from your account.",
    ];
    return {
      subject: "Your DonateCrate plan is active",
      text: `${lines.join("\n\n")}\n\nOpen your account: ${appUrl}${dashboardPath}`,
      html: buildEmailShell({
        eyebrow: "Plan Active",
        title: "You're all set.",
        intro: "Billing is confirmed. Monthly pickup is now active for your account.",
        body: lines,
        ctaLabel: "Open my account",
        ctaHref: `${appUrl}${dashboardPath}`,
        detailItems: [
          { label: "Plan", value: planName },
          { label: "Status", value: statusLabel || "Active" },
        ],
        footer: "You'll receive pickup reminders according to your notification preferences. Manage them anytime in Account Settings.",
      }),
    };
  }

  if (params.eventType.startsWith("pickup_reminder")) {
    const partnerRaw = typeof metadata.partner === "object" && metadata.partner !== null ? (metadata.partner as Record<string, unknown>) : null;
    const cobrand: CobrandOptions | undefined = partnerRaw && typeof partnerRaw.name === "string"
      ? {
          partnerName: partnerRaw.name as string,
          logoUrl: typeof partnerRaw.logoUrl === "string" ? partnerRaw.logoUrl : null,
          primaryColor: typeof partnerRaw.primaryColor === "string" ? partnerRaw.primaryColor : null,
          websiteUrl: typeof partnerRaw.websiteUrl === "string" ? partnerRaw.websiteUrl : null,
          receiptFooter: typeof partnerRaw.receiptFooter === "string" ? partnerRaw.receiptFooter : null,
        }
      : undefined;

    const pickupWindowLabel = typeof metadata.pickup_window_label === "string" && metadata.pickup_window_label.trim()
      ? metadata.pickup_window_label.trim()
      : null;

    const brandLabel = cobrand ? `DonateCrate \u00d7 ${cobrand.partnerName}` : "DonateCrate";
    // Use custom templates from metadata when available, otherwise fall back to defaults
    const customSubjectTemplate = typeof metadata.custom_subject === "string" ? metadata.custom_subject : null;
    const customIntroTemplate = typeof metadata.custom_intro === "string" ? metadata.custom_intro : null;
    const customBodyTemplate = typeof metadata.custom_body === "string" ? metadata.custom_body : null;
    const templateVars: Record<string, string> = { pickup_date: pickupDate || "your scheduled date" };
    const replaceVars = (tpl: string) => tpl.replaceAll("{{pickup_date}}", templateVars.pickup_date);

    const subject = customSubjectTemplate
      ? (cobrand ? `${brandLabel}: ${replaceVars(customSubjectTemplate)}` : replaceVars(customSubjectTemplate))
      : cadence === "72h"
        ? `Pickup in 3 days — ${brandLabel}`
        : cadence === "24h"
          ? `Your ${brandLabel} pickup is tomorrow`
          : `Pickup day — ${brandLabel}`;
    const intro = customIntroTemplate
      ? replaceVars(customIntroTemplate)
      : cadence === "72h"
        ? "Your next curbside pickup is just a few days away."
        : cadence === "24h"
          ? "Pickup is tomorrow — time to get your bag ready."
          : "Today is the day. Have your bag at the curb before the route begins.";
    const actionLine =
      cadence === "72h"
        ? "Start pulling together your donations now so you're ready when route day arrives."
        : cadence === "24h"
          ? "Place your orange DonateCrate bag at the curb before your pickup window begins."
          : "Make sure your bag is at the curb before the pickup window starts — we'll be there soon.";
    const bodyLine = customBodyTemplate
      ? replaceVars(customBodyTemplate)
      : pickupDate
        ? pickupWindowLabel
          ? `We're scheduled to stop by on ${pickupDate} between ${pickupWindowLabel}. ${actionLine}`
          : `We're scheduled to stop by on ${pickupDate}. ${actionLine}`
        : actionLine;
    const skippingLine = cadence === "day_of"
      ? "Need to skip? Log in to your account right away — route changes may no longer be possible once the driver departs."
      : "Need to skip this month? You can do that easily from your account before the route is locked in.";
    const lines = [
      `Hi ${greetingName},`,
      bodyLine,
      skippingLine,
    ];
    const detailItems: Array<{ label: string; value: string }> = [];
    if (pickupDate) detailItems.push({ label: "Pickup date", value: pickupDate });
    if (pickupWindowLabel) detailItems.push({ label: "Pickup window", value: pickupWindowLabel });
    const ctaLabel = cadence === "day_of" ? "View pickup details" : "Manage my pickup";
    return {
      subject,
      text: `${lines.join("\n\n")}\n\nManage your account: ${appUrl}/app`,
      html: buildEmailShell({
        eyebrow: cadence === "day_of" ? "Pickup Day" : cadence === "24h" ? "Tomorrow" : "Coming Up",
        title: subject,
        intro,
        body: lines,
        ctaLabel,
        ctaHref: `${appUrl}/app`,
        detailItems: detailItems.length > 0 ? detailItems : undefined,
        footer: "You're receiving this because pickup email reminders are enabled on your account. Manage preferences in Account Settings.",
        cobrand,
      }),
    };
  }

  if (params.eventType === "billing_payment_failed") {
    const lines = [
      `Hi ${greetingName},`,
      "We weren't able to process your latest DonateCrate payment.",
      "To keep your pickup schedule uninterrupted, please update your payment method at your earliest convenience. We'll retry automatically after you've made changes.",
      "If you believe this is a mistake or your card was recently updated, you can safely ignore this email.",
    ];
    return {
      subject: "Action needed: payment couldn't be processed",
      text: `${lines.join("\n\n")}\n\nUpdate billing: ${invoiceUrl || `${appUrl}/app/settings`}`,
      html: buildEmailShell({
        eyebrow: "Billing Alert",
        title: "Payment couldn't be processed.",
        intro: "Update your billing details to keep your monthly pickup plan active.",
        body: lines,
        ctaLabel: "Update payment method",
        ctaHref: invoiceUrl || `${appUrl}/app/settings`,
        accentVariant: "red",
        detailItems: [{ label: "Plan", value: planName }, { label: "Status", value: "Payment needed" }],
        footer: "We'll retry your payment automatically once your billing is updated. Questions? Reply to this email.",
      }),
    };
  }

  if (params.eventType === "billing_subscription_canceled") {
    const lines = [
      `Hi ${greetingName},`,
      "Your DonateCrate plan has been canceled. We'll miss having you on the route.",
      "Your account stays open — you can sign back in anytime to restart your plan, no new signup needed.",
      "If you'd like to share feedback about your experience or something we can do better, just reply to this email.",
    ];
    return {
      subject: "Your DonateCrate plan has ended",
      text: `${lines.join("\n\n")}\n\nRestart anytime: ${appUrl}/app`,
      html: buildEmailShell({
        eyebrow: "Plan Ended",
        title: "We'll miss you.",
        intro: "Your plan has been canceled. Your account stays open — come back anytime.",
        body: lines,
        ctaLabel: "Restart my plan",
        ctaHref: `${appUrl}/app`,
        accentVariant: "neutral",
        detailItems: [{ label: "Plan", value: planName }, { label: "Status", value: statusLabel || "Canceled" }],
        footer: "Thank you for being a DonateCrate member. Your donations made a real difference.",
      }),
    };
  }

  if (params.eventType === "pickup_missed") {
    const partnerRaw = typeof metadata.partner === "object" && metadata.partner !== null ? (metadata.partner as Record<string, unknown>) : null;
    const cobrand: CobrandOptions | undefined = partnerRaw && typeof partnerRaw.name === "string"
      ? {
          partnerName: partnerRaw.name as string,
          logoUrl: typeof partnerRaw.logoUrl === "string" ? partnerRaw.logoUrl : null,
          primaryColor: typeof partnerRaw.primaryColor === "string" ? partnerRaw.primaryColor : null,
          websiteUrl: typeof partnerRaw.websiteUrl === "string" ? partnerRaw.websiteUrl : null,
          receiptFooter: typeof partnerRaw.receiptFooter === "string" ? partnerRaw.receiptFooter : null,
        }
      : undefined;
    const brandLabel = cobrand ? `DonateCrate × ${cobrand.partnerName}` : "DonateCrate";
    const lines = [
      `Hi ${greetingName},`,
      pickupDate
        ? `We attempted your curbside pickup on ${pickupDate} but were unable to complete it.`
        : "We attempted your curbside pickup but were unable to complete it.",
      "If you still need a pickup, please reply to this email and our team will help you arrange one. We're sorry for the inconvenience.",
    ];
    return {
      subject: `We couldn't complete your ${brandLabel} pickup`,
      text: `${lines.join("\n\n")}\n\nReply to this email or open your account: ${appUrl}/app`,
      html: buildEmailShell({
        eyebrow: "Pickup Update",
        title: "We couldn't complete your pickup.",
        intro: "Our driver was unable to retrieve your bag during the scheduled window.",
        body: lines,
        ctaLabel: "Open my account",
        ctaHref: `${appUrl}/app`,
        accentVariant: "neutral",
        detailItems: pickupDate ? [{ label: "Attempted on", value: pickupDate }] : undefined,
        footer: "Simply reply to this email if you still need a pickup — our team will get back to you.",
        cobrand,
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
