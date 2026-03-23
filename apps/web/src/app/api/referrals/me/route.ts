import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { getOrCreateAffiliateCode } from "@/lib/referrals";
import { getSiteUrl } from "@/lib/urls";

export async function GET() {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, profile } = ctx;
  const affiliate = await getOrCreateAffiliateCode(supabase, profile.id);
  const yearStart = new Date();
  yearStart.setMonth(0, 1);
  yearStart.setHours(0, 0, 0, 0);
  const nextYearStart = new Date(yearStart);
  nextYearStart.setFullYear(yearStart.getFullYear() + 1);

  const [{ data: referralRows }, { data: creditRows }, { count: referrerCreditsThisYear }] = await Promise.all([
    supabase
      .from("referrals")
      .select("id,status,created_at,referred_user_id")
      .eq("referrer_user_id", profile.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("credits_ledger")
      .select("amount_cents")
      .eq("user_id", profile.id)
      .in("source", ["referral_bonus_referrer", "referral_bonus_referred"]),
    supabase
      .from("credits_ledger")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("source", "referral_bonus_referrer")
      .gte("created_at", yearStart.toISOString())
      .lt("created_at", nextYearStart.toISOString()),
  ]);

  const referralStats = {
    invitedCount: referralRows?.length ?? 0,
    qualifiedCount: referralRows?.filter((row) => row.status === "qualified").length ?? 0,
    creditedCount: referralRows?.filter((row) => row.status === "credited").length ?? 0,
    totalCreditCents:
      creditRows?.reduce((sum: number, row: { amount_cents: number }) => sum + (row.amount_cents || 0), 0) ?? 0,
    annualReferrerCreditsUsed: referrerCreditsThisYear ?? 0,
    annualReferrerCreditsRemaining: Math.max(0, 3 - (referrerCreditsThisYear ?? 0)),
  };

  const referredUserIds = (referralRows ?? [])
    .map((row) => row.referred_user_id)
    .filter((id): id is string => Boolean(id));

  const { data: referredProfiles } =
    referredUserIds.length > 0
      ? await supabase.from("users").select("id,email").in("id", referredUserIds)
      : { data: [] as Array<{ id: string; email: string }> };

  const emailByUserId = new Map((referredProfiles ?? []).map((row) => [row.id, row.email]));

  const recentReferrals = (referralRows ?? []).slice(0, 8).map((row) => ({
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    referredEmail: row.referred_user_id ? (emailByUserId.get(row.referred_user_id) ?? null) : null,
  }));

  const siteUrl = getSiteUrl();

  return NextResponse.json({
    affiliate,
    referralStats,
    recentReferrals,
    shareUrl: `${siteUrl.replace(/\/$/, "")}/signup?ref=${affiliate.code}`,
  });
}
