"use client";

import { useEffect, useState } from "react";

type ReferralData = {
  code: string;
  shareUrl: string;
  stats: {
    invitedCount: number;
    creditedCount: number;
    totalCreditCents: number;
    annualReferrerCreditsRemaining: number;
  };
};

export function ReferralSnippet({ creditedReferrals }: { creditedReferrals: number }) {
  const [data, setData] = useState<ReferralData | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/referrals/me")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load referral data");
        return r.json();
      })
      .then((json) => {
        setData({
          code: json.affiliate?.code ?? "",
          shareUrl: json.shareUrl ?? "",
          stats: {
            invitedCount: json.referralStats?.invitedCount ?? 0,
            creditedCount: json.referralStats?.creditedCount ?? creditedReferrals,
            totalCreditCents: json.referralStats?.totalCreditCents ?? 0,
            annualReferrerCreditsRemaining: json.referralStats?.annualReferrerCreditsRemaining ?? 3,
          },
        });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [creditedReferrals]);

  async function share() {
    if (!data?.shareUrl) return;

    // Try native share first (mobile)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Join DonateCrate",
          text: "Sign up for DonateCrate and we both get a free month! Monthly donation pickup for just $5/mo.",
          url: data.shareUrl,
        });
        return;
      } catch {
        // User cancelled or not supported — fall through to clipboard
      }
    }

    await navigator.clipboard.writeText(data.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (loading) {
    return (
      <section className="dc-card overflow-hidden !p-0">
        <div className="p-5">
          <div className="dc-skeleton h-4 w-32 mb-2" />
          <div className="dc-skeleton h-6 w-64 mb-3" />
          <div className="dc-skeleton h-10 w-48" />
        </div>
      </section>
    );
  }

  if (error || !data?.code) {
    return (
      <section className="dc-card overflow-hidden !p-0">
        <div className="bg-[linear-gradient(135deg,#111827_0%,#1f2937_55%,#ff6a00_180%)] p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">Referral Program</p>
          <p className="mt-1 text-lg font-bold">Earn free months for you and a neighbor</p>
          <p className="mt-2 text-sm text-white/70">
            Your referral code is being set up. Check back soon or visit your Account tab.
          </p>
        </div>
      </section>
    );
  }

  const earnedDollars = (data.stats.totalCreditCents / 100).toFixed(0);
  const hasEarnings = data.stats.totalCreditCents > 0;
  const creditsRemaining = data.stats.annualReferrerCreditsRemaining;

  return (
    <section className="dc-card overflow-hidden !p-0">
      {/* Header with value proposition */}
      <div className="bg-[linear-gradient(135deg,#111827_0%,#1f2937_55%,#ff6a00_180%)] p-5 text-white sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[var(--dc-orange)]" aria-hidden>
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Referral Program</p>
            </div>
            <p className="mt-2 text-lg font-bold leading-snug sm:text-xl">
              Give a free month, get a free month
            </p>
            <p className="mt-1.5 text-sm text-white/75">
              Share your link with a neighbor. When they subscribe, you both earn a $5 credit — that&apos;s a free month each.
            </p>
          </div>
          {hasEarnings ? (
            <div className="shrink-0 text-right">
              <p className="text-2xl font-bold">${earnedDollars}</p>
              <p className="text-xs text-white/60">earned</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Code + share action */}
      <div className="border-b border-black/5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-black/10 bg-[var(--dc-gray-50)] px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--dc-gray-400)]">Code</span>
            <span className="font-mono text-sm font-bold tracking-wide text-[var(--dc-gray-900)]">{data.code}</span>
          </div>
          <button
            onClick={share}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--dc-orange)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#e55f00] active:scale-[0.97]"
          >
            {copied ? (
              <>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden>
                  <path d="M3.5 8.5l3 3 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Link copied!
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden>
                  <path d="M4 12a2 2 0 1 1 0-4 2 2 0 0 1 0 4ZM12 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4ZM12 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4ZM5.7 10.7l4.6 1.6M5.7 9.3l4.6-1.6" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Share invite link
              </>
            )}
          </button>
        </div>
      </div>

      {/* Quick stats row */}
      <div className="flex items-center divide-x divide-black/5 text-center">
        <div className="flex-1 px-3 py-3">
          <p className="text-lg font-bold text-[var(--dc-gray-900)]">{data.stats.invitedCount}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--dc-gray-400)]">Invited</p>
        </div>
        <div className="flex-1 px-3 py-3">
          <p className="text-lg font-bold text-[var(--dc-gray-900)]">{data.stats.creditedCount}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--dc-gray-400)]">Credited</p>
        </div>
        <div className="flex-1 px-3 py-3">
          <p className="text-lg font-bold text-[var(--dc-gray-900)]">{creditsRemaining}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--dc-gray-400)]">Left this year</p>
        </div>
        <a
          href="/app?tab=account"
          className="flex-1 px-3 py-3 text-sm font-semibold text-[var(--dc-orange)] transition-colors hover:text-[#e55f00] hover:bg-[rgba(255,106,0,0.04)]"
        >
          View all &rarr;
        </a>
      </div>
    </section>
  );
}
