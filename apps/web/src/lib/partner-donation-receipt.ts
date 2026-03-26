import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPartnerReceiptEmailContent } from "@/lib/partner-receipt";
import { createAndProcessNotificationEmail } from "@/lib/notification-jobs";
import { resolvePartnerLogoUrl } from "@/lib/partner-logo-storage";

export async function sendPartnerDonationReceipt(params: {
  supabase: SupabaseClient;
  pickupRequestId: string;
  partnerId: string;
  donationDate?: string | null;
}) {
  const [{ data: pickupRequest }, { data: partner }, { data: branding }] = await Promise.all([
    params.supabase
      .from("pickup_requests")
      .select("id,user_id,users!inner(email,full_name)")
      .eq("id", params.pickupRequestId)
      .maybeSingle(),
    params.supabase
      .from("nonprofit_partners")
      .select("id,name,support_email,support_phone")
      .eq("id", params.partnerId)
      .maybeSingle(),
    params.supabase
      .from("partner_branding")
      .select("display_name,logo_url,primary_color,secondary_color,accent_color,website_url,receipt_footer")
      .eq("partner_id", params.partnerId)
      .maybeSingle(),
  ]);

  const user = pickupRequest
    ? Array.isArray(pickupRequest.users)
      ? pickupRequest.users[0]
      : pickupRequest.users
    : null;

  if (!pickupRequest?.user_id || !user?.email || !partner?.name) {
    return { ok: false as const, reason: "missing_recipient_or_partner" };
  }

  let resolvedLogoUrl = branding?.logo_url ?? null;
  if (resolvedLogoUrl?.startsWith("data:image/")) {
    try {
      const uploadedLogoUrl = await resolvePartnerLogoUrl(params.partnerId, resolvedLogoUrl);
      if (uploadedLogoUrl && uploadedLogoUrl !== resolvedLogoUrl) {
        resolvedLogoUrl = uploadedLogoUrl;
        await params.supabase
          .from("partner_branding")
          .update({
            logo_url: uploadedLogoUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("partner_id", params.partnerId);
      }
    } catch {
      resolvedLogoUrl = null;
    }
  }

  const content = buildPartnerReceiptEmailContent({
    branding: {
      partnerName: partner.name,
      displayName: branding?.display_name ?? null,
      logoUrl: resolvedLogoUrl,
      primaryColor: branding?.primary_color ?? null,
      secondaryColor: branding?.secondary_color ?? null,
      accentColor: branding?.accent_color ?? null,
      websiteUrl: branding?.website_url ?? null,
      receiptFooter: branding?.receipt_footer ?? null,
      supportEmail: partner.support_email ?? null,
      supportPhone: partner.support_phone ?? null,
    },
    recipientName: user.full_name ?? user.email,
    donationDate: params.donationDate ?? null,
    receiptId: `DC-${pickupRequest.id.slice(0, 8).toUpperCase()}`,
  });

  return createAndProcessNotificationEmail({
    supabase: params.supabase,
    userId: pickupRequest.user_id,
    eventType: "partner_donation_receipt",
    metadata: {
      pickup_request_id: params.pickupRequestId,
      partner_id: params.partnerId,
      pickup_date: params.donationDate ?? null,
      to: user.email,
      full_name: user.full_name ?? null,
      subject: content.subject,
      text: content.text,
      html: content.html,
    },
  });
}
