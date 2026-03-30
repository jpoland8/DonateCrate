"use client";

import { useState } from "react";

type ReferShareProps = {
  code: string;
  shareUrl: string;
  stats: {
    invitedCount: number;
    creditedCount: number;
    totalCreditCents: number;
    annualReferrerCreditsRemaining: number;
  };
};

export function ReferShareClient({ code, shareUrl, stats }: ReferShareProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: select an input — handled by the visible URL display
    }
  }

  async function nativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Join DonateCrate",
          text: "Sign up for DonateCrate and we both get a free month! Monthly donation pickup for just $5/mo.",
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled — do nothing
      }
    }
  }

  function shareTwitter() {
    const text = encodeURIComponent(
      "Sign up for @DonateCrate and we both get a free month! Monthly donation pickup for just $5/mo."
    );
    const url = encodeURIComponent(shareUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank", "noopener");
  }

  function shareFacebook() {
    const url = encodeURIComponent(shareUrl);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank", "noopener");
  }

  function shareSms() {
    const body = encodeURIComponent(
      `Check out DonateCrate! Sign up and we both get a free month of donation pickup: ${shareUrl}`
    );
    // iOS uses &body=, Android uses ?body=. Using ? as a more universal approach.
    window.open(`sms:?body=${body}`, "_self");
  }

  const earnedDollars = (stats.totalCreditCents / 100).toFixed(0);
  const hasEarnings = stats.totalCreditCents > 0;

  return (
    <div className="space-y-6">
      {/* Code display card */}
      <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dc-gray-400)]">
          Your referral code
        </p>
        <p className="mt-2 font-mono text-3xl font-bold tracking-wider text-[var(--dc-gray-900)]">
          {code}
        </p>
      </div>

      {/* Shareable link + copy */}
      <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-[var(--dc-gray-700)]">Your shareable link</p>
        <div className="mt-3 flex items-stretch gap-2">
          <div className="flex flex-1 items-center overflow-hidden rounded-xl border border-black/10 bg-[var(--dc-gray-50)] px-4 py-3">
            <span className="truncate font-mono text-sm text-[var(--dc-gray-600)]">{shareUrl}</span>
          </div>
          <button
            onClick={copyLink}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--dc-orange)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#e55f00] active:scale-[0.97]"
          >
            {copied ? (
              <>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden>
                  <path d="M3.5 8.5l3 3 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden>
                  <rect x="5.5" y="5.5" width="7" height="8" rx="1.5" strokeWidth="1.5" />
                  <path d="M3.5 10.5v-7a1.5 1.5 0 011.5-1.5h5" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Copy link
              </>
            )}
          </button>
        </div>
      </div>

      {/* Share buttons */}
      <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-[var(--dc-gray-700)]">Share with friends</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Native share (mobile) */}
          <button
            onClick={nativeShare}
            className="flex flex-col items-center gap-2 rounded-xl border border-black/[0.06] bg-[var(--dc-gray-50)] px-4 py-4 text-sm font-medium text-[var(--dc-gray-700)] transition hover:border-[var(--dc-orange)]/30 hover:bg-[var(--dc-orange)]/5 hover:text-[var(--dc-orange)]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
              <path d="M13 4.5a.5.5 0 01.8-.4l4.5 3.5a.5.5 0 010 .8l-4.5 3.5a.5.5 0 01-.8-.4V10H7a3 3 0 00-3 3v2a.5.5 0 01-1 0v-2a4 4 0 014-4h6V4.5z" />
            </svg>
            Share
          </button>

          {/* Twitter / X */}
          <button
            onClick={shareTwitter}
            className="flex flex-col items-center gap-2 rounded-xl border border-black/[0.06] bg-[var(--dc-gray-50)] px-4 py-4 text-sm font-medium text-[var(--dc-gray-700)] transition hover:border-[var(--dc-orange)]/30 hover:bg-[var(--dc-orange)]/5 hover:text-[var(--dc-orange)]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
              <path d="M11.72 8.773L17.345 2h-1.332L11.128 7.88 7.168 2H2.2l5.9 8.59L2.2 18h1.332l5.16-5.998L12.832 18H17.8l-6.08-9.227zm-1.826 2.122l-.598-.856L4.01 3.04h2.049l3.838 5.49.598.856 4.994 7.143h-2.05l-4.073-5.634z" />
            </svg>
            X / Twitter
          </button>

          {/* Facebook */}
          <button
            onClick={shareFacebook}
            className="flex flex-col items-center gap-2 rounded-xl border border-black/[0.06] bg-[var(--dc-gray-50)] px-4 py-4 text-sm font-medium text-[var(--dc-gray-700)] transition hover:border-[var(--dc-orange)]/30 hover:bg-[var(--dc-orange)]/5 hover:text-[var(--dc-orange)]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
              <path d="M18 10a8 8 0 10-9.25 7.903v-5.59H6.719V10H8.75V8.206c0-2.006 1.194-3.112 3.022-3.112.875 0 1.79.156 1.79.156v1.969h-1.008c-.993 0-1.303.617-1.303 1.25V10h2.219l-.355 2.313H11.25v5.59A8.002 8.002 0 0018 10z" />
            </svg>
            Facebook
          </button>

          {/* SMS */}
          <button
            onClick={shareSms}
            className="flex flex-col items-center gap-2 rounded-xl border border-black/[0.06] bg-[var(--dc-gray-50)] px-4 py-4 text-sm font-medium text-[var(--dc-gray-700)] transition hover:border-[var(--dc-orange)]/30 hover:bg-[var(--dc-orange)]/5 hover:text-[var(--dc-orange)]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
              <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v7a2 2 0 01-2 2H6l-4 4V5z" />
            </svg>
            Text
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="rounded-2xl border border-black/[0.06] bg-white shadow-sm">
        <div className="grid grid-cols-3 divide-x divide-black/[0.06] text-center">
          <div className="px-4 py-5">
            <p className="text-2xl font-bold text-[var(--dc-gray-900)]">{stats.invitedCount}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[var(--dc-gray-400)]">Invited</p>
          </div>
          <div className="px-4 py-5">
            <p className="text-2xl font-bold text-[var(--dc-gray-900)]">{stats.creditedCount}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[var(--dc-gray-400)]">Credited</p>
          </div>
          <div className="px-4 py-5">
            <p className="text-2xl font-bold text-[var(--dc-orange)]">
              {hasEarnings ? `$${earnedDollars}` : "$0"}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[var(--dc-gray-400)]">Earned</p>
          </div>
        </div>
        {stats.annualReferrerCreditsRemaining > 0 ? (
          <div className="border-t border-black/[0.06] px-5 py-3 text-center">
            <p className="text-sm text-[var(--dc-gray-500)]">
              <span className="font-semibold text-[var(--dc-gray-700)]">{stats.annualReferrerCreditsRemaining}</span>{" "}
              referral credits remaining this year
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
