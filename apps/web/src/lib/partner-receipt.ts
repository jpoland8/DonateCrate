import { getSiteUrl } from "@/lib/urls";

export type PartnerReceiptBrandingInput = {
  partnerName: string;
  displayName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  websiteUrl?: string | null;
  receiptFooter?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
};

export type PartnerReceiptRenderInput = {
  branding: PartnerReceiptBrandingInput;
  recipientName?: string | null;
  donationDate?: string | null;
  receiptId?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function normalizeHexColor(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
}

export function getPartnerReceiptPresentation(input: PartnerReceiptBrandingInput) {
  const displayName = input.displayName?.trim() || input.partnerName;
  const rawLogoUrl = input.logoUrl?.trim() || `${getSiteUrl()}/images/logo-provided.png`;
  const emailSafeLogoUrl = /\.svg(\?|#|$)/i.test(rawLogoUrl) || rawLogoUrl.startsWith("data:image/svg+xml")
    ? null
    : rawLogoUrl;
  const wordmark = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "DC";
  return {
    displayName,
    logoUrl: rawLogoUrl,
    emailSafeLogoUrl,
    wordmark,
    primaryColor: normalizeHexColor(input.primaryColor, "#0f766e"),
    secondaryColor: normalizeHexColor(input.secondaryColor, "#f5f3ef"),
    accentColor: normalizeHexColor(input.accentColor, "#f59e0b"),
    websiteUrl: input.websiteUrl?.trim() || "",
    supportEmail: input.supportEmail?.trim() || "giving@donatecrate.com",
    supportPhone: input.supportPhone?.trim() || "",
    receiptFooter:
      input.receiptFooter?.trim() ||
      `Thank you for supporting ${displayName} through DonateCrate. This email serves as your acknowledgment of donated goods received.`,
  };
}

function formatDonationDate(value: string | null | undefined) {
  if (!value) {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date());
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function buildPartnerReceiptEmailContent(input: PartnerReceiptRenderInput) {
  const presentation = getPartnerReceiptPresentation(input.branding);
  const receiptId = input.receiptId || `DC-${Date.now()}`;
  const donationDate = formatDonationDate(input.donationDate);
  const donorName = input.recipientName?.trim() || "Supporter";
  const detailRows = [
    { label: "Receipt ID", value: receiptId },
    { label: "Donation date", value: donationDate },
    { label: "Donor", value: donorName },
  ];
  const contactLine = [presentation.supportEmail, presentation.supportPhone].filter(Boolean).join(" • ");

  const html = `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      @media only screen and (max-width: 640px) {
        .receipt-shell {
          border-radius: 0 !important;
        }
        .receipt-header,
        .receipt-body {
          padding: 20px !important;
        }
        .receipt-logo-cell,
        .receipt-copy-cell {
          display: block !important;
          width: 100% !important;
          padding: 0 !important;
        }
        .receipt-logo {
          max-width: 112px !important;
          max-height: 112px !important;
          margin-bottom: 16px !important;
        }
        .receipt-title {
          font-size: 30px !important;
        }
        .receipt-heading {
          font-size: 34px !important;
        }
        .receipt-card {
          padding: 20px !important;
        }
        .receipt-meta-value,
        .receipt-paragraph,
        .receipt-summary,
        .receipt-footer {
          font-size: 15px !important;
          line-height: 1.65 !important;
        }
      }
    </style>
  </head>
  <body style="margin:0;background:${escapeHtml(presentation.secondaryColor)};padding:24px;font-family:Georgia,ui-serif,serif;">
    <div class="receipt-shell" style="margin:0 auto;max-width:720px;overflow:hidden;border:1px solid rgba(17,24,39,.08);border-radius:28px;background:#ffffff;box-shadow:0 24px 70px rgba(17,24,39,.08);">
      <div class="receipt-header" style="padding:28px 32px;border-bottom:1px solid rgba(17,24,39,.08);background:${escapeHtml(presentation.primaryColor)};">
        <table role="presentation" style="width:100%;border-collapse:collapse;">
          <tr>
            <td class="receipt-logo-cell" style="vertical-align:middle;width:160px;">
              ${
                presentation.emailSafeLogoUrl
                  ? `<img class="receipt-logo" src="${escapeHtml(presentation.emailSafeLogoUrl)}" alt="${escapeHtml(presentation.displayName)} logo" style="display:block;max-width:140px;max-height:140px;width:auto;height:auto;object-fit:contain;" />`
                  : `<div class="receipt-logo" style="display:inline-flex;align-items:center;justify-content:center;width:112px;height:112px;border-radius:24px;background:rgba(255,255,255,.14);color:#ffffff;font-size:38px;font-weight:700;letter-spacing:.08em;">${escapeHtml(
                      presentation.wordmark,
                    )}</div>`
              }
            </td>
            <td class="receipt-copy-cell" style="vertical-align:middle;padding-left:20px;">
              <div style="color:rgba(255,255,255,.76);font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">Donation Receipt</div>
              <h1 class="receipt-title" style="margin:10px 0 0;color:#ffffff;font-size:40px;line-height:1.05;">${escapeHtml(presentation.displayName)}</h1>
              <p class="receipt-paragraph" style="margin:10px 0 0;color:rgba(255,255,255,.82);font-size:17px;line-height:1.5;">Branded for your nonprofit and delivered by DonateCrate</p>
            </td>
          </tr>
        </table>
      </div>
      <div class="receipt-body" style="padding:28px;background:#ffffff;">
        <div class="receipt-card" style="border:1px solid rgba(17,24,39,.08);border-radius:20px;background:#f6f6f6;padding:18px 20px;">
          <div style="color:${escapeHtml(presentation.accentColor)};font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">Sent from</div>
          <div class="receipt-meta-value" style="margin-top:10px;color:#181f30;font-size:17px;line-height:1.5;">${escapeHtml(presentation.displayName)} &lt;giving@donatecrate.com&gt;</div>
        </div>
        <div class="receipt-card" style="margin-top:18px;border:1px solid rgba(17,24,39,.08);border-radius:24px;background:#ffffff;padding:28px;box-shadow:0 14px 32px rgba(17,24,39,.08);">
          <div style="color:#181f30;font-size:15px;font-weight:700;">Subject</div>
          <div class="receipt-meta-value" style="margin-top:8px;color:#2b3347;font-size:18px;line-height:1.45;">Your donation receipt from ${escapeHtml(presentation.displayName)}</div>
          <div style="margin-top:22px;height:6px;border-radius:999px;background:${escapeHtml(presentation.accentColor)};"></div>
          <h2 class="receipt-heading" style="margin:28px 0 0;color:#181f30;font-size:46px;line-height:1.08;">Thank you for supporting ${escapeHtml(presentation.displayName)}.</h2>
          <p class="receipt-paragraph" style="margin:20px 0 0;color:#4a5565;font-size:18px;line-height:1.7;">
            We received your donated items and prepared this receipt for your records. Please keep this email for tax documentation and year-end reporting.
          </p>
          <div style="margin-top:22px;">
            ${detailRows
              .map(
                (row) =>
                  `<div style="margin:0 0 14px;">
                    <div style="color:#8a6a4b;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;">${escapeHtml(row.label)}</div>
                    <div class="receipt-meta-value" style="margin-top:4px;color:#181f30;font-size:17px;font-weight:700;line-height:1.4;">${escapeHtml(row.value)}</div>
                  </div>`,
              )
              .join("")}
          </div>
          <p class="receipt-paragraph" style="margin:8px 0 0;color:#4a5565;font-size:18px;line-height:1.7;">
            This email includes your donation receipt. Please keep it for tax documentation and year-end reporting. Item valuation should be completed by the donor or tax preparer based on the donated goods.
          </p>
          <div class="receipt-card" style="margin-top:24px;border:1px solid rgba(17,24,39,.08);border-radius:20px;background:#fcfaf7;padding:20px 22px;">
            <div style="color:#8a6a4b;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;">Receipt summary</div>
            <div class="receipt-summary" style="margin-top:12px;color:#181f30;font-size:16px;line-height:1.8;">
              <div>Organization: ${escapeHtml(presentation.displayName)}</div>
              <div>Received through: DonateCrate pickup service</div>
              <div>Donation type: Household goods and soft goods</div>
              <div>Tax-deductible value: To be determined by donor records</div>
            </div>
          </div>
          <div class="receipt-footer" style="margin-top:24px;border:1px solid rgba(17,24,39,.08);border-radius:20px;background:#f6f6f6;padding:18px 20px;color:#4a5565;font-size:16px;line-height:1.7;">
            ${escapeHtml(presentation.receiptFooter)}
          </div>
          ${contactLine ? `<p style="margin:18px 0 0;color:#677381;font-size:13px;line-height:1.6;">Questions? Contact ${escapeHtml(contactLine)}.</p>` : ""}
          ${presentation.websiteUrl ? `<p style="margin:8px 0 0;color:#677381;font-size:13px;line-height:1.6;">Learn more at <a href="${escapeHtml(presentation.websiteUrl)}" style="color:${escapeHtml(presentation.primaryColor)};">${escapeHtml(presentation.websiteUrl)}</a>.</p>` : ""}
        </div>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    `Thank you for supporting ${presentation.displayName}.`,
    "",
    "We received your donated items and prepared this receipt for your records.",
    `Receipt ID: ${receiptId}`,
    `Donation date: ${donationDate}`,
    `Donor: ${donorName}`,
    `Organization: ${presentation.displayName}`,
    "Received through: DonateCrate pickup service",
    "Donation type: Household goods and soft goods",
    "Tax-deductible value: To be determined by donor records",
    "",
    "This email serves as your donation receipt for recordkeeping purposes.",
    "",
    presentation.receiptFooter,
    contactLine ? `Questions? Contact ${contactLine}.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: `Your donation receipt from ${presentation.displayName}`,
    text,
    html,
  };
}
