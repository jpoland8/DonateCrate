import type { SupabaseClient } from "@supabase/supabase-js";

// Characters that are visually unambiguous — no O/0, I/1/L confusion
const SAFE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function normalizeCode(input: string) {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    // Normalize visually ambiguous characters so lookup is forgiving
    .replace(/O/g, "0") // letter O → digit 0
    .replace(/[IL]/g, "1"); // letter I or L → digit 1
}

function randomCode() {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
  }
  return `DC${suffix}`;
}

export async function getOrCreateAffiliateCode(supabase: SupabaseClient, userId: string) {
  const { data: existing } = await supabase
    .from("affiliate_codes")
    .select("id,code")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomCode();
    const { data, error } = await supabase
      .from("affiliate_codes")
      .insert({ user_id: userId, code })
      .select("id,code")
      .single();

    if (!error && data) return data;
  }

  throw new Error("Could not generate a unique affiliate code");
}

export async function creditQualifiedReferralIfEligible(params: {
  supabase: SupabaseClient;
  referredUserId: string;
}) {
  const { supabase, referredUserId } = params;
  const { data: referral } = await supabase
    .from("referrals")
    .select("id,referrer_user_id,status")
    .eq("referred_user_id", referredUserId)
    .eq("status", "qualified")
    .maybeSingle();

  if (!referral) return { credited: false };

  const { error: updateError } = await supabase
    .from("referrals")
    .update({ status: "credited" })
    .eq("id", referral.id)
    .eq("status", "qualified");

  if (updateError) throw updateError;

  const yearStart = new Date();
  yearStart.setMonth(0, 1);
  yearStart.setHours(0, 0, 0, 0);
  const nextYearStart = new Date(yearStart);
  nextYearStart.setFullYear(yearStart.getFullYear() + 1);

  const { count: referrerCreditsThisYear } = await supabase
    .from("credits_ledger")
    .select("id", { count: "exact", head: true })
    .eq("user_id", referral.referrer_user_id)
    .eq("source", "referral_bonus_referrer")
    .gte("created_at", yearStart.toISOString())
    .lt("created_at", nextYearStart.toISOString());

  const now = new Date().toISOString();
  const entries = [
    {
      user_id: referredUserId,
      source: "referral_bonus_referred",
      amount_cents: 500,
      currency: "usd",
      note: "Welcome referral reward",
      created_at: now,
    },
  ];

  if ((referrerCreditsThisYear ?? 0) < 3) {
    entries.push({
      user_id: referral.referrer_user_id,
      source: "referral_bonus_referrer",
      amount_cents: 500,
      currency: "usd",
      note: `Referral reward for activated friend (${referredUserId})`,
      created_at: now,
    });
  }

  await supabase.from("credits_ledger").insert(entries);

  return { credited: true, referrerUserId: referral.referrer_user_id };
}

export { normalizeCode };
