import { NextResponse } from "next/server";
import { getDefaultHomePath } from "@/lib/access";
import { getSafeAppPath } from "@/lib/redirects";
import { normalizeCode } from "@/lib/referrals";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";
  const refParam = searchParams.get("ref");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const supabaseAdmin = createSupabaseAdminClient();

  // Check whether a profile already exists for this auth user
  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("id, role")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();

  if (!profile) {
    // New Google sign-up — create a minimal profile and send to onboarding
    const fullName =
      (data.user.user_metadata?.full_name as string | undefined) ||
      (data.user.user_metadata?.name as string | undefined) ||
      "";
    const email = (data.user.email ?? "").toLowerCase();

    const { data: newProfile } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          auth_user_id: data.user.id,
          email,
          full_name: fullName,
          role: "customer",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "auth_user_id" },
      )
      .select("id")
      .single();

    if (newProfile?.id) {
      await supabaseAdmin
        .from("notification_preferences")
        .upsert({ user_id: newProfile.id, email_enabled: true, sms_enabled: true }, { onConflict: "user_id" });

      // Apply referral code if provided
      if (refParam) {
        const normalizedRef = normalizeCode(refParam);
        if (normalizedRef.length >= 4) {
          const { data: affiliate } = await supabaseAdmin
            .from("affiliate_codes")
            .select("user_id")
            .eq("code", normalizedRef)
            .maybeSingle();

          if (affiliate && affiliate.user_id !== newProfile.id) {
            await supabaseAdmin.from("referrals").upsert(
              {
                referrer_user_id: affiliate.user_id,
                referred_user_id: newProfile.id,
                referral_code: normalizedRef,
                status: "qualified",
                created_at: new Date().toISOString(),
              },
              { onConflict: "referred_user_id" },
            );
          }
        }
      }
    }

    // Onboarding will collect phone + address and send the welcome email
    return NextResponse.redirect(`${origin}/app/onboarding`);
  }

  // Existing user — redirect to the right portal
  const { data: memberships } = await supabaseAdmin
    .from("partner_memberships")
    .select("role")
    .eq("user_id", profile.id)
    .eq("active", true);

  const hasPartner = Boolean((memberships ?? []).length);
  const roleHome = getDefaultHomePath(profile.role, { hasActivePartnerMembership: hasPartner });
  const safeNext = getSafeAppPath(next, roleHome);
  const destination = next !== "/app" ? safeNext : roleHome;

  return NextResponse.redirect(`${origin}${destination}`);
}
