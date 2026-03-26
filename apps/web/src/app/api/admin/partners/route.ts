import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { resolvePartnerLogoUrl } from "@/lib/partner-logo-storage";

const createPartnerSchema = z.object({
  code: z.string().min(3),
  name: z.string().min(3),
  legalName: z.string().optional(),
  supportEmail: z.string().email().optional().or(z.literal("")),
  supportPhone: z.string().optional(),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  aboutParagraph: z.string().optional(),
  receiptMode: z.enum(["partner_issued", "platform_on_behalf", "manual"]).default("partner_issued"),
  payoutModel: z.enum(["inventory_only", "revenue_share", "hybrid"]).default("inventory_only"),
  platformShareBps: z.number().int().min(0).max(10000).default(10000),
  partnerShareBps: z.number().int().min(0).max(10000).default(0),
  notes: z.string().optional(),
  branding: z
    .object({
      displayName: z.string().optional(),
      primaryColor: z.string().optional(),
      secondaryColor: z.string().optional(),
      accentColor: z.string().optional(),
      logoUrl: z.string().optional(),
      websiteUrl: z.string().url().optional().or(z.literal("")),
      receiptFooter: z.string().optional(),
    })
    .optional(),
});

const updatePartnerSchema = z.object({
  partnerId: z.string().uuid(),
  name: z.string().min(3).optional(),
  legalName: z.string().optional(),
  supportEmail: z.string().email().optional().or(z.literal("")),
  supportPhone: z.string().optional(),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  aboutParagraph: z.string().optional(),
  active: z.boolean().optional(),
  receiptMode: z.enum(["partner_issued", "platform_on_behalf", "manual"]).optional(),
  payoutModel: z.enum(["inventory_only", "revenue_share", "hybrid"]).optional(),
  platformShareBps: z.number().int().min(0).max(10000).optional(),
  partnerShareBps: z.number().int().min(0).max(10000).optional(),
  notes: z.string().optional(),
  branding: z
    .object({
      displayName: z.string().optional(),
      primaryColor: z.string().optional(),
      secondaryColor: z.string().optional(),
      accentColor: z.string().optional(),
      logoUrl: z.string().optional(),
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

export async function GET() {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await ctx.supabase
    .from("nonprofit_partners")
    .select(`
      id,
      code,
      name,
      legal_name,
      support_email,
      support_phone,
      address_line1,
      city,
      state,
      postal_code,
      about_paragraph,
      active,
      receipt_mode,
      payout_model,
      platform_share_bps,
      partner_share_bps,
      notes,
      created_at,
      partner_branding (
        display_name,
        logo_url,
        primary_color,
        secondary_color,
        accent_color,
        website_url,
        receipt_footer
      )
    `)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const partnerIds = (data ?? []).map((partner) => partner.id);
  const [{ data: memberships }, { data: zones }] = await Promise.all([
    partnerIds.length > 0
      ? ctx.supabase
          .from("partner_memberships")
          .select("id,partner_id,role,active,user_id,users!inner(id,email,full_name,phone)")
          .in("partner_id", partnerIds)
      : Promise.resolve({ data: [] }),
    partnerIds.length > 0
      ? ctx.supabase
          .from("service_zones")
          .select("partner_id,id,name,code,operation_model")
          .in("partner_id", partnerIds)
      : Promise.resolve({ data: [] }),
  ]);

  const membersByPartner = new Map<string, Array<{
    id: string;
    user_id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    role: string;
    active: boolean;
  }>>();
  for (const membership of memberships ?? []) {
    const usersRaw = Array.isArray(membership.users) ? membership.users[0] : membership.users;
    const current = membersByPartner.get(membership.partner_id) ?? [];
    current.push({
      id: membership.id,
      user_id: usersRaw?.id ?? "",
      email: usersRaw?.email ?? "Unknown",
      full_name: usersRaw?.full_name ?? null,
      phone: usersRaw?.phone ?? null,
      role: membership.role,
      active: membership.active ?? true,
    });
    membersByPartner.set(membership.partner_id, current);
  }

  const zonesByPartner = new Map<string, Array<{ id: string; name: string; code: string; operation_model: string }>>();
  for (const zone of zones ?? []) {
    if (!zone.partner_id) continue;
    const current = zonesByPartner.get(zone.partner_id) ?? [];
    current.push({
      id: zone.id,
      name: zone.name,
      code: zone.code,
      operation_model: zone.operation_model,
    });
    zonesByPartner.set(zone.partner_id, current);
  }

  return NextResponse.json({
    partners: (data ?? []).map((partner) => {
      const branding = Array.isArray(partner.partner_branding) ? partner.partner_branding[0] : partner.partner_branding;
      return {
        id: partner.id,
        code: partner.code,
        name: partner.name,
        legal_name: partner.legal_name,
        support_email: partner.support_email,
        support_phone: partner.support_phone,
        address_line1: partner.address_line1,
        city: partner.city,
        state: partner.state,
        postal_code: partner.postal_code,
        about_paragraph: partner.about_paragraph,
        active: partner.active,
        receipt_mode: partner.receipt_mode,
        payout_model: partner.payout_model,
        platform_share_bps: partner.platform_share_bps,
        partner_share_bps: partner.partner_share_bps,
        notes: partner.notes,
        created_at: partner.created_at,
        branding: branding
          ? {
              display_name: branding.display_name ?? null,
              logo_url: branding.logo_url ?? null,
              primary_color: branding.primary_color ?? null,
              secondary_color: branding.secondary_color ?? null,
              accent_color: branding.accent_color ?? null,
              website_url: branding.website_url ?? null,
              receipt_footer: branding.receipt_footer ?? null,
            }
          : null,
        members: membersByPartner.get(partner.id) ?? [],
        zones: zonesByPartner.get(partner.id) ?? [],
      };
    }),
  });
}

export async function POST(request: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = createPartnerSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const input = parsed.data;
  if (input.platformShareBps + input.partnerShareBps > 10000) {
    return NextResponse.json({ error: "Platform share and partner share cannot exceed 100%" }, { status: 400 });
  }

  const { data: partner, error } = await ctx.supabase
    .from("nonprofit_partners")
    .insert({
      code: input.code.toLowerCase(),
      name: input.name,
      legal_name: normalizeNullableText(input.legalName),
      support_email: normalizeNullableText(input.supportEmail),
      support_phone: normalizeNullableText(input.supportPhone),
      address_line1: normalizeNullableText(input.addressLine1),
      city: normalizeNullableText(input.city),
      state: normalizeNullableText(input.state),
      postal_code: normalizeNullableText(input.postalCode),
      about_paragraph: normalizeNullableText(input.aboutParagraph),
      receipt_mode: input.receiptMode,
      payout_model: input.payoutModel,
      platform_share_bps: input.platformShareBps,
      partner_share_bps: input.partnerShareBps,
      notes: normalizeNullableText(input.notes),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !partner) return NextResponse.json({ error: error?.message ?? "Could not create partner" }, { status: 500 });

  if (input.branding) {
    let resolvedLogoUrl: string | null | undefined;
    try {
      resolvedLogoUrl = await resolvePartnerLogoUrl(partner.id, input.branding.logoUrl);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Could not upload logo" }, { status: 400 });
    }

    const brandingPayload = {
      partner_id: partner.id,
      display_name: normalizeNullableText(input.branding.displayName),
      primary_color: normalizeNullableText(input.branding.primaryColor),
      secondary_color: normalizeNullableText(input.branding.secondaryColor),
      accent_color: normalizeNullableText(input.branding.accentColor),
      logo_url: resolvedLogoUrl === undefined ? undefined : normalizeNullableText(resolvedLogoUrl ?? ""),
      website_url: normalizeNullableText(input.branding.websiteUrl),
      receipt_footer: normalizeNullableText(input.branding.receiptFooter),
      updated_at: new Date().toISOString(),
    };
    await ctx.supabase.from("partner_branding").upsert(brandingPayload, { onConflict: "partner_id" });
  }

  return NextResponse.json({ ok: true, partnerId: partner.id });
}

export async function PATCH(request: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = updatePartnerSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const input = parsed.data;
  const nextPlatformShare = input.platformShareBps;
  const nextPartnerShare = input.partnerShareBps;
  if (
    typeof nextPlatformShare === "number" &&
    typeof nextPartnerShare === "number" &&
    nextPlatformShare + nextPartnerShare > 10000
  ) {
    return NextResponse.json({ error: "Platform share and partner share cannot exceed 100%" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof input.name === "string") patch.name = input.name;
  if (input.legalName !== undefined) patch.legal_name = normalizeNullableText(input.legalName);
  if (input.supportEmail !== undefined) patch.support_email = normalizeNullableText(input.supportEmail);
  if (input.supportPhone !== undefined) patch.support_phone = normalizeNullableText(input.supportPhone);
  if (input.addressLine1 !== undefined) patch.address_line1 = normalizeNullableText(input.addressLine1);
  if (input.city !== undefined) patch.city = normalizeNullableText(input.city);
  if (input.state !== undefined) patch.state = normalizeNullableText(input.state);
  if (input.postalCode !== undefined) patch.postal_code = normalizeNullableText(input.postalCode);
  if (input.aboutParagraph !== undefined) patch.about_paragraph = normalizeNullableText(input.aboutParagraph);
  if (typeof input.active === "boolean") patch.active = input.active;
  if (typeof input.receiptMode === "string") patch.receipt_mode = input.receiptMode;
  if (typeof input.payoutModel === "string") patch.payout_model = input.payoutModel;
  if (typeof input.platformShareBps === "number") patch.platform_share_bps = input.platformShareBps;
  if (typeof input.partnerShareBps === "number") patch.partner_share_bps = input.partnerShareBps;
  if (input.notes !== undefined) patch.notes = normalizeNullableText(input.notes);

  const { error } = await ctx.supabase.from("nonprofit_partners").update(patch).eq("id", input.partnerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (input.branding) {
    let resolvedLogoUrl: string | null | undefined;
    try {
      resolvedLogoUrl = await resolvePartnerLogoUrl(input.partnerId, input.branding.logoUrl);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Could not upload logo" }, { status: 400 });
    }

    const brandingPayload = {
      partner_id: input.partnerId,
      display_name: normalizeNullableText(input.branding.displayName),
      primary_color: normalizeNullableText(input.branding.primaryColor),
      secondary_color: normalizeNullableText(input.branding.secondaryColor),
      accent_color: normalizeNullableText(input.branding.accentColor),
      logo_url: resolvedLogoUrl === undefined ? undefined : normalizeNullableText(resolvedLogoUrl ?? ""),
      website_url: normalizeNullableText(input.branding.websiteUrl),
      receipt_footer: normalizeNullableText(input.branding.receiptFooter),
      updated_at: new Date().toISOString(),
    };
    const { error: brandingError } = await ctx.supabase
      .from("partner_branding")
      .upsert(brandingPayload, { onConflict: "partner_id" });
    if (brandingError) return NextResponse.json({ error: brandingError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
