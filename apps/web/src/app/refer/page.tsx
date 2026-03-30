import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { getOrCreateAffiliateCode } from "@/lib/referrals";
import { getSiteUrl } from "@/lib/urls";
import { ReferShareClient } from "./refer-share-client";

export const metadata: Metadata = {
  title: "Refer a Friend — DonateCrate",
  description:
    "Share your DonateCrate referral link and you both earn a $5 credit — a free month of donation pickup.",
};

async function getReferralData() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const affiliate = await getOrCreateAffiliateCode(supabase, profile.id);
  const siteUrl = getSiteUrl();

  const yearStart = new Date();
  yearStart.setMonth(0, 1);
  yearStart.setHours(0, 0, 0, 0);
  const nextYearStart = new Date(yearStart);
  nextYearStart.setFullYear(yearStart.getFullYear() + 1);

  const [{ data: referralRows }, { data: creditRows }, { count: referrerCreditsThisYear }] =
    await Promise.all([
      supabase
        .from("referrals")
        .select("id,status")
        .eq("referrer_user_id", profile.id),
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

  return {
    code: affiliate.code,
    shareUrl: `${siteUrl.replace(/\/$/, "")}/signup?ref=${affiliate.code}`,
    stats: {
      invitedCount: referralRows?.length ?? 0,
      creditedCount: referralRows?.filter((r) => r.status === "credited").length ?? 0,
      totalCreditCents:
        creditRows?.reduce(
          (sum: number, row: { amount_cents: number }) => sum + (row.amount_cents || 0),
          0
        ) ?? 0,
      annualReferrerCreditsRemaining: Math.max(0, 3 - (referrerCreditsThisYear ?? 0)),
    },
  };
}

const HOW_IT_WORKS_STEPS = [
  {
    step: "1",
    title: "Share your link",
    description: "Send your unique referral link to a friend or neighbor.",
  },
  {
    step: "2",
    title: "They sign up",
    description: "Your friend creates a DonateCrate account and subscribes.",
  },
  {
    step: "3",
    title: "You both earn $5",
    description: "Once their first pickup is complete, you each get a $5 credit — a free month.",
  },
];

export default async function ReferPage() {
  const data = await getReferralData();
  const siteUrl = getSiteUrl();
  const isLoggedIn = data !== null;

  return (
    <div className="min-h-screen bg-[#f7f3ef]">
      {/* Header */}
      <header className="border-b border-black/[0.06] bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <a href={siteUrl}>
            <Image
              src="/images/logo-provided-520.webp"
              alt="DonateCrate"
              width={150}
              height={38}
              className="h-7 w-auto"
            />
          </a>
          {isLoggedIn ? (
            <Link
              href="/app"
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[var(--dc-gray-700)] shadow-sm transition hover:border-[var(--dc-orange)] hover:text-[var(--dc-orange)]"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login?next=/refer"
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[var(--dc-gray-700)] shadow-sm transition hover:border-[var(--dc-orange)] hover:text-[var(--dc-orange)]"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      {/* Hero */}
      <div className="bg-[linear-gradient(135deg,#111827_0%,#1f2937_55%,#ff6a00_180%)] py-14 text-white sm:py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/25 bg-orange-400/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.26em] text-orange-300/90">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-[var(--dc-orange)]" aria-hidden>
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Referral Program
          </div>
          <h1 className="mt-5 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            Give a free month, get a free month
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/70 sm:text-lg">
            Share DonateCrate with a neighbor. When they subscribe and complete their first pickup,
            you both earn a $5 credit — that&apos;s a free month each.
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
        {isLoggedIn ? (
          <ReferShareClient
            code={data.code}
            shareUrl={data.shareUrl}
            stats={data.stats}
          />
        ) : (
          /* Logged-out view */
          <div className="space-y-6">
            <div className="rounded-2xl border border-black/[0.06] bg-white p-8 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--dc-orange)]/10">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7 text-[var(--dc-orange)]" aria-hidden>
                  <path d="M13 4.5a.5.5 0 01.8-.4l4.5 3.5a.5.5 0 010 .8l-4.5 3.5a.5.5 0 01-.8-.4V10H7a3 3 0 00-3 3v2a.5.5 0 01-1 0v-2a4 4 0 014-4h6V4.5z" />
                </svg>
              </div>
              <h2 className="mt-5 text-xl font-bold text-[var(--dc-gray-900)]">
                Sign in to get your referral code
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--dc-gray-500)]">
                Log in to your DonateCrate account to get a unique referral link you can share with friends
                and neighbors.
              </p>
              <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/login?next=/refer"
                  className="inline-flex items-center justify-center rounded-full bg-[var(--dc-orange)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#e55f00] active:scale-[0.97]"
                >
                  Sign in to get your link
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-[var(--dc-gray-700)] shadow-sm transition hover:border-[var(--dc-orange)] hover:text-[var(--dc-orange)]"
                >
                  Create an account
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* How it works — shown for everyone */}
        <div className="mt-10 rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-bold text-[var(--dc-gray-900)]">How it works</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            {HOW_IT_WORKS_STEPS.map((item) => (
              <div key={item.step} className="text-center sm:text-left">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[var(--dc-orange)]/10 text-sm font-bold text-[var(--dc-orange)] sm:mx-0">
                  {item.step}
                </div>
                <h3 className="mt-3 text-sm font-semibold text-[var(--dc-gray-900)]">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-[var(--dc-gray-500)]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Fine print */}
        <div className="mt-8 rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-bold text-[var(--dc-gray-900)]">Program details</h2>
          <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-[var(--dc-gray-500)]">
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--dc-orange)]/50" />
              Both the referrer and the new subscriber receive a $5 credit after the referred
              customer&apos;s first completed pickup.
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--dc-orange)]/50" />
              Referrers can earn up to 3 referral credits per calendar year.
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--dc-orange)]/50" />
              Credits are applied automatically to your next billing cycle.
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--dc-orange)]/50" />
              The referred person must be a new DonateCrate subscriber.
            </li>
          </ul>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-black/[0.06] px-6 py-5 text-center">
        <a
          href={siteUrl}
          className="text-xs text-[var(--dc-gray-400)] transition hover:text-[var(--dc-gray-700)]"
        >
          &larr; Back to DonateCrate.com
        </a>
      </div>
    </div>
  );
}
