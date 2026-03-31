import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { apiLimiter } from "@/lib/rate-limit";
import { resolvePartnerLogoUrl } from "@/lib/partner-logo-storage";
import { userCanAccessPartner } from "@/lib/partner-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  partnerId: z.string().uuid(),
  organization: z
    .object({
      supportEmail: z.string().email().optional().or(z.literal("")),
      supportPhone: z.string().optional(),
      addressLine1: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      aboutParagraph: z.string().optional(),
    })
    .optional(),
  branding: z
    .object({
      displayName: z.string().optional(),
      logoUrl: z.string().optional(),
      primaryColor: z.string().optional(),
      secondaryColor: z.string().optional(),
      accentColor: z.string().optional(),
      websiteUrl: z.string().url().optional().or(z.literal("")),
      receiptFooter: z.string().optional(),
    })
    .optional(),
});

function normalizeNullableText(value: string | undefined) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function PATCH(request: Request) {
  const limited = apiLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.partnerRole !== "partner_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const input = parsed.data;
  const supabaseAdmin = createSupabaseAdminClient();
  const canAccess = await userCanAccessPartner({
    supabase: ctx.supabase,
    userId: ctx.profile.id,
    partnerId: input.partnerId,
  });
  if (!canAccess) return NextResponse.json({ error: "This partner is not assigned to your account" }, { status: 403 });

  if (input.organization) {
    const { error: organizationError } = await supabaseAdmin
      .from("nonprofit_partners")
      .update({
        support_email: normalizeNullableText(input.organization.supportEmail),
        support_phone: normalizeNullableText(input.organization.supportPhone),
        address_line1: normalizeNullableText(input.organization.addressLine1),
        city: normalizeNullableText(input.organization.city),
        state: normalizeNullableText(input.organization.state),
        postal_code: normalizeNullableText(input.organization.postalCode),
        about_paragraph: normalizeNullableText(input.organization.aboutParagraph),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.partnerId);
    if (organizationError) return NextResponse.json({ error: organizationError.message }, { status: 500 });
  }

  if (input.branding) {
    let resolvedLogoUrl: string | null | undefined;
    try {
      resolvedLogoUrl = await resolvePartnerLogoUrl(input.partnerId, input.branding.logoUrl);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Could not upload logo" }, { status: 400 });
    }

    const { error: brandingError } = await supabaseAdmin
      .from("partner_branding")
      .upsert(
        {
          partner_id: input.partnerId,
          display_name: normalizeNullableText(input.branding.displayName),
          logo_url: resolvedLogoUrl === undefined ? undefined : normalizeNullableText(resolvedLogoUrl ?? ""),
          primary_color: normalizeNullableText(input.branding.primaryColor),
          secondary_color: normalizeNullableText(input.branding.secondaryColor),
          accent_color: normalizeNullableText(input.branding.accentColor),
          website_url: normalizeNullableText(input.branding.websiteUrl),
          receipt_footer: normalizeNullableText(input.branding.receiptFooter),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "partner_id" },
      );
    if (brandingError) return NextResponse.json({ error: brandingError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
