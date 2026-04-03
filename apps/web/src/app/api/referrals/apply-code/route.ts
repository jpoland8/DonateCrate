import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { normalizeCode } from "@/lib/referrals";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  referralCode: z.string().min(4),
});

export async function POST(request: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const code = normalizeCode(parsed.data.referralCode);
  if (code.length < 4) return NextResponse.json({ error: "Invalid referral code" }, { status: 400 });

  const { supabase, profile } = ctx;

  // Block users who have ever had an active subscription (first-time only)
  const { count: subCount } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .in("status", ["active", "canceled", "past_due"]);

  if ((subCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "Referral codes can only be applied before your first subscription." },
      { status: 409 },
    );
  }

  // Check if a referral is already applied to this account
  const { data: existingReferral } = await supabase
    .from("referrals")
    .select("id")
    .eq("referred_user_id", profile.id)
    .maybeSingle();

  if (existingReferral) {
    return NextResponse.json(
      { error: "A referral code is already applied to your account." },
      { status: 409 },
    );
  }

  // Build all visually-ambiguous variants to try.
  // Old codes used toString(36) which produces both letter O and digit 0.
  const rawCode = parsed.data.referralCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const withLetterVariants = code.replace(/0/g, "O").replace(/1/g, "I");
  const allVariants = Array.from(new Set([code, rawCode, withLetterVariants])).filter((c) => c.length >= 4);

  // Use admin client (service role — bypasses RLS) with .or() to find any matching variant
  const adminSupabase = createSupabaseAdminClient();
  const orFilter = allVariants.map((v) => `code.eq.${v}`).join(",");

  const { data: affiliateData, error: lookupError } = await adminSupabase
    .from("affiliate_codes")
    .select("user_id, code")
    .or(orFilter)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    console.error("[apply-code] lookup error:", lookupError);
    return NextResponse.json({ error: "Could not look up referral code. Please try again." }, { status: 500 });
  }

  if (!affiliateData) {
    console.error("[apply-code] not found — variants tried:", allVariants);
    return NextResponse.json({ error: "Referral code not found.", _debug: { allVariants } }, { status: 404 });
  }

  if (affiliateData.user_id === profile.id) {
    return NextResponse.json({ error: "You cannot use your own referral code." }, { status: 409 });
  }

  const { error: referralError } = await adminSupabase.from("referrals").insert({
    referrer_user_id: affiliateData.user_id,
    referred_user_id: profile.id,
    referral_code: code,
    status: "qualified",
    created_at: new Date().toISOString(),
  });

  if (referralError) {
    return NextResponse.json({ error: referralError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Referral code applied! Your first month will be free when you subscribe.",
  });
}
