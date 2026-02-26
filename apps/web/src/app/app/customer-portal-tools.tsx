"use client";

import { useEffect, useState } from "react";

type Prefs = {
  email_enabled: boolean;
  sms_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
};

export function CustomerPortalTools({ section = "all" }: { section?: "all" | "referrals" | "settings" | "pickups" }) {
  const [prefs, setPrefs] = useState<Prefs>({
    email_enabled: true,
    sms_enabled: true,
    quiet_hours_start: null,
    quiet_hours_end: null,
  });
  const [latestRequest, setLatestRequest] = useState<{ status: string; updated_at: string } | null>(null);
  const [currentCycle, setCurrentCycle] = useState<{ pickup_date: string } | null>(null);
  const [currentCycleRequest, setCurrentCycleRequest] = useState<{ status: string; updated_at: string } | null>(null);
  const [referralCode, setReferralCode] = useState("");
  const [referralLink, setReferralLink] = useState("");
  const [referralStats, setReferralStats] = useState({
    invitedCount: 0,
    qualifiedCount: 0,
    creditedCount: 0,
    totalCreditCents: 0,
    annualReferrerCreditsUsed: 0,
    annualReferrerCreditsRemaining: 3,
  });
  const [recentReferrals, setRecentReferrals] = useState<
    Array<{ id: string; status: string; createdAt: string; referredEmail: string | null }>
  >([]);
  const [message, setMessage] = useState("");

  async function load() {
    const [overviewRes, referralRes] = await Promise.all([
      fetch("/api/customer/overview"),
      fetch("/api/referrals/me"),
    ]);
    const overview = await overviewRes.json();
    const referral = await referralRes.json();
    if (overview.preferences) setPrefs(overview.preferences);
    if (overview.latestRequest) setLatestRequest(overview.latestRequest);
    if (overview.currentCycle) setCurrentCycle(overview.currentCycle);
    if (overview.currentCycleRequest) setCurrentCycleRequest(overview.currentCycleRequest);
    if (referral.affiliate?.code) setReferralCode(referral.affiliate.code);
    if (referral.shareUrl) setReferralLink(referral.shareUrl);
    if (referral.referralStats) setReferralStats(referral.referralStats);
    if (referral.recentReferrals) setRecentReferrals(referral.recentReferrals);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function savePrefs() {
    const response = await fetch("/api/notifications/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emailEnabled: prefs.email_enabled,
        smsEnabled: prefs.sms_enabled,
        quietHoursStart: prefs.quiet_hours_start || undefined,
        quietHoursEnd: prefs.quiet_hours_end || undefined,
      }),
    });
    const json = await response.json();
    if (!response.ok) {
      setMessage(json.error || "Could not save preferences");
      return;
    }
    setMessage("Preferences saved.");
  }

  async function copyReferralLink() {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setMessage("Referral link copied.");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {section === "all" || section === "settings" ? (
      <section className="rounded-2xl border border-black/10 bg-white p-5">
        <h3 className="text-xl font-bold">Notification Preferences</h3>
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={prefs.email_enabled}
              onChange={(event) => setPrefs((prev) => ({ ...prev, email_enabled: event.target.checked }))}
            />
            Email notifications
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={prefs.sms_enabled}
              onChange={(event) => setPrefs((prev) => ({ ...prev, sms_enabled: event.target.checked }))}
            />
            SMS notifications
          </label>
          <button
            onClick={savePrefs}
            className="rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold text-white"
          >
            Save Preferences
          </button>
        </div>
      </section>
      ) : null}

      {section === "all" || section === "referrals" ? (
      <section className="overflow-hidden rounded-2xl border border-black/10 bg-white p-0 shadow-sm">
        <div className="bg-[linear-gradient(120deg,#111_0%,#2a2a2a_45%,#ff6a00_130%)] p-5 text-white">
          <h3 className="text-xl font-bold">Affiliate Rewards</h3>
          <p className="mt-1 text-sm text-white/80">Share your code. When your friend activates, both get a free month credit.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-white/15 px-3 py-2 font-mono text-sm tracking-wide">
              {referralCode || "GENERATING"}
            </span>
            <button
              onClick={copyReferralLink}
              className="rounded-lg border border-white/50 px-3 py-2 text-sm font-semibold hover:bg-white hover:text-black"
            >
              Copy Invite Link
            </button>
          </div>
          <p className="mt-2 break-all text-xs text-white/70">{referralLink}</p>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <article className="rounded-xl border border-black/10 p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--dc-gray-700)]">Invites</p>
            <p className="mt-1 text-2xl font-bold">{referralStats.invitedCount}</p>
          </article>
          <article className="rounded-xl border border-black/10 p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--dc-gray-700)]">Credited</p>
            <p className="mt-1 text-2xl font-bold">{referralStats.creditedCount}</p>
          </article>
          <article className="rounded-xl border border-black/10 p-3 sm:col-span-2">
            <p className="text-xs uppercase tracking-wide text-[var(--dc-gray-700)]">Total Reward Value</p>
            <p className="mt-1 text-2xl font-bold">${(referralStats.totalCreditCents / 100).toFixed(2)}</p>
          </article>
          <article className="rounded-xl border border-black/10 p-3 sm:col-span-2">
            <p className="text-xs uppercase tracking-wide text-[var(--dc-gray-700)]">Referrer Free Months Left (This Year)</p>
            <p className="mt-1 text-2xl font-bold">{referralStats.annualReferrerCreditsRemaining} / 3</p>
          </article>
          <article className="rounded-xl border border-black/10 p-3 sm:col-span-2">
            <p className="text-xs uppercase tracking-wide text-[var(--dc-gray-700)]">Code Usage Rule</p>
            <p className="mt-1 text-sm text-[var(--dc-gray-700)]">
              Referral codes are for new signups only. Existing account holders can share invite links, but cannot apply a new referral code.
            </p>
          </article>
        </div>
      </section>
      ) : null}

      {section === "all" || section === "pickups" ? (
      <section className="rounded-2xl border border-black/10 bg-white p-5 lg:col-span-2">
        <h3 className="text-xl font-bold">Pickup Status</h3>
        <p className="mt-2 text-sm text-[var(--dc-gray-700)]">
          Default policy: each active customer is assumed ready every month unless marked as skipped.
          Skipping only avoids a stop visit and does not pause billing.
        </p>
        {currentCycle ? (
          <p className="mt-2 text-sm text-[var(--dc-gray-700)]">
            Current cycle: {new Date(currentCycle.pickup_date).toLocaleDateString()}
            {" | "}
            Status: {currentCycleRequest?.status ?? "requested"}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-[var(--dc-gray-700)]">
          {latestRequest
            ? `${latestRequest.status} (${new Date(latestRequest.updated_at).toLocaleString()})`
            : "No request submitted yet."}
        </p>
      </section>
      ) : null}

      {section === "all" || section === "referrals" ? (
      <section className="rounded-2xl border border-black/10 bg-white p-5 lg:col-span-2">
        <h3 className="text-xl font-bold">Recent Referral Activity</h3>
        <div className="mt-3 space-y-2">
          {recentReferrals.length === 0 ? (
            <p className="text-sm text-[var(--dc-gray-700)]">No referrals yet. Share your code to unlock free-month credits.</p>
          ) : (
            recentReferrals.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between rounded-lg border border-black/10 p-3">
                <p className="text-sm">{item.referredEmail || "Pending signup"}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dc-gray-700)]">
                  {item.status}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
      ) : null}

      {message ? <p className="text-sm text-[var(--dc-gray-700)] lg:col-span-2">{message}</p> : null}
    </div>
  );
}
