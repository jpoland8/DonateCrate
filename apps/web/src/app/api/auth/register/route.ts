import { NextResponse } from "next/server";
import { z } from "zod";
import { sendBrandedEmail } from "@/lib/email";
import { checkEligibility } from "@/lib/eligibility";
import { geocodeAddress } from "@/lib/geocode";
import { fallbackCoordsForPostalCode } from "@/lib/geo";
import { authLimiter } from "@/lib/rate-limit";
import { normalizeCode } from "@/lib/referrals";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  phone: z.string().optional(),
  addressLine1: z.string().min(3),
  addressLine2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().length(2),
  postalCode: z.string().min(5).max(10),
  referralCode: z.string().optional(),
});

export async function POST(request: Request) {
  const limited = authLimiter.check(request);
  if (limited) return limited;

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const geocoded = await geocodeAddress(parsed.data);
  const eligibility = await checkEligibility({
    postalCode: parsed.data.postalCode,
    lat: geocoded?.lat,
    lng: geocoded?.lng,
  });
  const isWaitlisted = eligibility.status !== "active";

  const supabase = createSupabaseAdminClient();
  const normalizedReferralCode = parsed.data.referralCode ? normalizeCode(parsed.data.referralCode) : null;
  let referrerUserId: string | null = null;
  let referralWarning: string | null = null;

  if (normalizedReferralCode) {
    const { data: affiliate, error: affiliateError } = await supabase
      .from("affiliate_codes")
      .select("user_id,code")
      .eq("code", normalizedReferralCode)
      .maybeSingle();

    if (affiliateError) {
      return NextResponse.json({ error: affiliateError.message }, { status: 500 });
    }
    if (!affiliate) {
      referralWarning = "Referral code could not be matched, so signup will continue without a referral credit.";
    } else {
      referrerUserId = affiliate.user_id;
    }
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: parsed.data.email.toLowerCase(),
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.fullName,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      return NextResponse.json({ error: "Account already exists for this email" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const createdUserAuthId = data.user?.id;
  if (createdUserAuthId) {
    const normalizedState = parsed.data.state.toUpperCase();
    const normalizedPostalCode = parsed.data.postalCode.trim();

    const { data: profile } = await supabase
      .from("users")
      .upsert(
        {
          auth_user_id: createdUserAuthId,
          email: parsed.data.email.toLowerCase(),
          full_name: parsed.data.fullName,
          phone: parsed.data.phone ?? null,
          role: "customer",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "auth_user_id" },
      )
      .select("id")
      .single();

    if (!profile?.id) {
      return NextResponse.json({ error: "Could not initialize user profile" }, { status: 500 });
    }

    const { data: existingAddress } = await supabase
      .from("addresses")
      .select("id")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingAddress?.id) {
      const { error: addressUpdateError } = await supabase
        .from("addresses")
        .update({
          address_line1: parsed.data.addressLine1,
          address_line2: parsed.data.addressLine2 ?? null,
          city: parsed.data.city,
          state: normalizedState,
          postal_code: normalizedPostalCode,
        })
        .eq("id", existingAddress.id);

      if (addressUpdateError) {
        return NextResponse.json({ error: addressUpdateError.message }, { status: 500 });
      }
    } else {
      const { error: addressInsertError } = await supabase.from("addresses").insert({
        user_id: profile.id,
        address_line1: parsed.data.addressLine1,
        address_line2: parsed.data.addressLine2 ?? null,
        city: parsed.data.city,
        state: normalizedState,
        postal_code: normalizedPostalCode,
      });
      if (addressInsertError) {
        return NextResponse.json({ error: addressInsertError.message }, { status: 500 });
      }
    }

    const { error: prefsError } = await supabase.from("notification_preferences").upsert(
      {
        user_id: profile.id,
        email_enabled: true,
        sms_enabled: true,
      },
      { onConflict: "user_id" },
    );

    if (prefsError) {
      return NextResponse.json({ error: prefsError.message }, { status: 500 });
    }

    if (referrerUserId && referrerUserId !== profile.id) {
      const { error: referralError } = await supabase.from("referrals").upsert(
        {
          referrer_user_id: referrerUserId,
          referred_user_id: profile.id,
          referral_code: normalizedReferralCode,
          status: "qualified",
          created_at: new Date().toISOString(),
        },
        { onConflict: "referred_user_id" },
      );

      if (referralError) {
        return NextResponse.json({ error: referralError.message }, { status: 500 });
      }
    }

    // Auto-enroll in waitlist if zone is not active
    if (isWaitlisted && profile?.id) {
      try {
        const fallbackCoords = fallbackCoordsForPostalCode(parsed.data.postalCode);
        await supabase.from("waitlist_entries").upsert(
          {
            full_name: parsed.data.fullName,
            email: parsed.data.email.toLowerCase(),
            phone: parsed.data.phone ?? null,
            address_line1: parsed.data.addressLine1,
            address_line2: parsed.data.addressLine2 ?? null,
            city: parsed.data.city,
            state: parsed.data.state.toUpperCase(),
            postal_code: parsed.data.postalCode,
            referral_code: parsed.data.referralCode ?? null,
            lat: geocoded?.lat ?? fallbackCoords?.lat ?? null,
            lng: geocoded?.lng ?? fallbackCoords?.lng ?? null,
            status: "pending",
            has_account: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "email,postal_code" },
        );
      } catch { /* non-fatal */ }
    }

    try {
      await sendBrandedEmail({
        eventType: "account_welcome",
        recipient: {
          email: parsed.data.email.toLowerCase(),
          fullName: parsed.data.fullName,
        },
        metadata: isWaitlisted
          ? {
              next_step: "We'll notify you by email as soon as service opens in your area. No action needed — your spot is saved.",
              waitlisted: "true",
            }
          : {
              next_step: "Finish billing to unlock your first pickup request.",
            },
      });
    } catch (emailError) {
      console.error("Failed to send welcome email", emailError);
    }
  }

  return NextResponse.json({
    ok: true,
    userId: data.user?.id ?? null,
    warning: referralWarning,
    zoneStatus: eligibility.status,
    isWaitlisted,
  });
}
