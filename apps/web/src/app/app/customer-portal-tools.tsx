"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCycleStatus } from "@/lib/customer-cycle";
import { formatNotificationEventType, formatNotificationStatus } from "@/lib/notification-labels";

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
  const [notificationEvents, setNotificationEvents] = useState<
    Array<{
      id: string;
      channel: string;
      event_type: string;
      status: string;
      created_at: string;
      last_attempt_at: string | null;
      last_error: string | null;
    }>
  >([]);
  const [recentPickupRequests, setRecentPickupRequests] = useState<
    Array<{ id: string; status: string; updated_at: string; pickup_cycles?: { pickup_date: string } | { pickup_date: string }[] | null }>
  >([]);
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
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  function safeDateLabel(value: string | null | undefined, fallback = "Not scheduled") {
    if (!value) return fallback;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toLocaleDateString();
  }

  function safeDateTimeLabel(value: string | null | undefined, fallback = "Not set") {
    if (!value) return fallback;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toLocaleString();
  }

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const [overviewRes, referralRes] = await Promise.all([fetch("/api/customer/overview"), fetch("/api/referrals/me")]);
      const overview = await overviewRes.json();
      const referral = await referralRes.json();
      if (!overviewRes.ok) throw new Error(overview.error || "Could not load account overview.");
      if (!referralRes.ok) throw new Error(referral.error || "Could not load referral activity.");
      if (overview.preferences) setPrefs(overview.preferences);
      if (overview.latestRequest) setLatestRequest(overview.latestRequest);
      if (overview.currentCycle) setCurrentCycle(overview.currentCycle);
      if (overview.currentCycleRequest) setCurrentCycleRequest(overview.currentCycleRequest);
      if (overview.notificationEvents) setNotificationEvents(overview.notificationEvents);
      if (overview.recentPickupRequests) setRecentPickupRequests(overview.recentPickupRequests);
      if (referral.affiliate?.code) setReferralCode(referral.affiliate.code);
      if (referral.shareUrl) setReferralLink(referral.shareUrl);
      if (referral.referralStats) setReferralStats(referral.referralStats);
      if (referral.recentReferrals) setRecentReferrals(referral.recentReferrals);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load account details.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const reminderChannelSummary = useMemo(() => {
    if (prefs.email_enabled && prefs.sms_enabled) return "Email and text reminders are on.";
    if (prefs.email_enabled) return "Email reminders are on.";
    if (prefs.sms_enabled) return "Text reminders are on.";
    return "All reminders are off.";
  }, [prefs.email_enabled, prefs.sms_enabled]);

  const activityFeed = useMemo(() => {
    const pickupEvents = recentPickupRequests.map((request) => {
      const cycle = Array.isArray(request.pickup_cycles) ? request.pickup_cycles[0] : request.pickup_cycles;
      return {
        id: `pickup-${request.id}`,
        createdAt: request.updated_at,
        title: "Pickup status updated",
        tone: "pickup" as const,
        statusLabel: formatCycleStatus(request.status),
        detail: cycle?.pickup_date ? `For ${safeDateLabel(cycle.pickup_date)}` : "Saved to your account",
        error: null,
      };
    });

    const notificationFeed = notificationEvents.map((event) => ({
      id: `notification-${event.id}`,
      createdAt: event.created_at,
      title: formatNotificationEventType(event.event_type),
      tone: "notification" as const,
      statusLabel: `${formatNotificationStatus(event.status)} via ${event.channel}`,
      detail: event.last_attempt_at
        ? `Last delivery attempt ${safeDateTimeLabel(event.last_attempt_at)}`
        : "Logged to your account",
      error: event.last_error,
    }));

    return [...pickupEvents, ...notificationFeed]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 12);
  }, [notificationEvents, recentPickupRequests]);

  const referralValueDollars = (referralStats.totalCreditCents / 100).toFixed(2);
  const referralLinkLabel = useMemo(() => {
    if (!referralLink) return "";
    try {
      const parsed = new URL(referralLink);
      return `${parsed.hostname}${parsed.pathname}${parsed.search}`;
    } catch {
      return referralLink;
    }
  }, [referralLink]);
  const activeSectionMeta =
    section === "referrals"
      ? {
          eyebrow: "Referrals",
          title: "Share one link. Earn free months.",
          detail: "Copy your invite link, then track which households convert into credits.",
        }
      : section === "settings"
        ? {
            eyebrow: "Settings",
            title: "Choose how DonateCrate keeps you in the loop.",
            detail: "Most households keep billing updates by email and pickup reminders by text.",
          }
        : section === "pickups"
          ? {
              eyebrow: "Pickup Details",
              title: "Stay aligned with this month's pickup.",
              detail: "Use this screen to understand the current cycle and watch account updates as pickup day gets closer.",
            }
          : null;

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
    setCopied(true);
    setMessage("Referral link copied.");
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="lg:col-span-2 dc-card p-6">
          <div className="dc-skeleton h-4 w-20 mb-3" />
          <div className="dc-skeleton h-7 w-64 mb-2" />
          <div className="dc-skeleton h-4 w-96" />
        </div>
        <div className="dc-card p-6">
          <div className="dc-skeleton h-6 w-40 mb-4" />
          <div className="space-y-3">
            <div className="dc-skeleton h-20 w-full" />
            <div className="dc-skeleton h-20 w-full" />
          </div>
        </div>
        <div className="dc-card p-6">
          <div className="dc-skeleton h-6 w-48 mb-4" />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="dc-skeleton h-20" />
            <div className="dc-skeleton h-20" />
            <div className="dc-skeleton h-20" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="dc-toast dc-toast-error">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0" aria-hidden>
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        {loadError}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {activeSectionMeta ? (
        <section className="lg:col-span-2 dc-card p-5 sm:p-6">
          <p className="dc-eyebrow">{activeSectionMeta.eyebrow}</p>
          <h2 className="mt-2 text-2xl font-bold text-[var(--dc-gray-900)]">{activeSectionMeta.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--dc-gray-600)]">{activeSectionMeta.detail}</p>
        </section>
      ) : null}

      {section === "all" || section === "settings" ? (
        <section className="dc-card p-5">
          <h3 className="text-xl font-bold text-[var(--dc-gray-900)]">How we contact you</h3>
          <p className="mt-2 text-sm text-[var(--dc-gray-600)]">
            Turn reminders on for the channels you actually use. We only send account-related updates.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <article className="dc-inner-panel">
              <p className="dc-eyebrow !text-[var(--dc-gray-500)]">Right now</p>
              <p className="mt-2 text-sm font-semibold text-[var(--dc-gray-900)]">{reminderChannelSummary}</p>
              <p className="mt-1 text-xs text-[var(--dc-gray-500)]">
                Quiet hours: {prefs.quiet_hours_start && prefs.quiet_hours_end ? `${prefs.quiet_hours_start} to ${prefs.quiet_hours_end}` : "Not set"}
              </p>
            </article>
            <article className="dc-inner-panel">
              <p className="dc-eyebrow !text-[var(--dc-gray-500)]">What you can expect</p>
              <p className="mt-2 text-sm text-[var(--dc-gray-600)]">
                Email is best for billing and account notices. Text is best for the quick pickup reminder.
              </p>
            </article>
          </div>
          <div className="mt-4 space-y-2">
            <label className="flex items-start gap-3 dc-inner-panel cursor-pointer hover:border-black/12 transition-colors">
              <input
                type="checkbox"
                checked={prefs.email_enabled}
                onChange={(event) => setPrefs((prev) => ({ ...prev, email_enabled: event.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-[var(--dc-gray-300)] text-[var(--dc-orange)] focus:ring-[var(--dc-orange)]"
              />
              <span>
                <span className="block text-sm font-semibold text-[var(--dc-gray-900)]">Email reminders and billing alerts</span>
                <span className="mt-0.5 block text-xs text-[var(--dc-gray-500)]">Best for confirmations, billing updates, and account notices.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 dc-inner-panel cursor-pointer hover:border-black/12 transition-colors">
              <input
                type="checkbox"
                checked={prefs.sms_enabled}
                onChange={(event) => setPrefs((prev) => ({ ...prev, sms_enabled: event.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-[var(--dc-gray-300)] text-[var(--dc-orange)] focus:ring-[var(--dc-orange)]"
              />
              <span>
                <span className="block text-sm font-semibold text-[var(--dc-gray-900)]">Text reminders for pickup day</span>
                <span className="mt-0.5 block text-xs text-[var(--dc-gray-500)]">Best for quick reminders when your bag should be out.</span>
              </span>
            </label>
          </div>
          <div className="mt-4">
            <button onClick={savePrefs} className="dc-btn-primary">
              Save preferences
            </button>
          </div>
        </section>
      ) : null}

      {section === "all" || section === "referrals" ? (
        <section className="dc-card overflow-hidden p-0">
          <div className="bg-[linear-gradient(120deg,#111_0%,#2a2a2a_45%,#ff6a00_130%)] p-5 text-white">
            <h3 className="text-xl font-bold">Free-Month Referrals</h3>
            <p className="mt-1 text-sm text-white/80">
              Invite neighbors and friends. When a new household activates, both homes earn a free month credit.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-[var(--radius-sm)] bg-white/15 px-3 py-2 font-mono text-sm tracking-wide backdrop-blur">
                {referralCode || "GENERATING"}
              </span>
              <button
                onClick={copyReferralLink}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-white/40 px-3 py-2 text-sm font-semibold transition-all duration-150 hover:bg-white hover:text-black"
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
                      <rect x="5" y="5" width="9" height="9" rx="1.5" strokeWidth="1.5" />
                      <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" strokeWidth="1.5" />
                    </svg>
                    Copy invite link
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-white/60">Share link: {referralLinkLabel}</p>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-3">
            <article className="dc-stat">
              <p className="text-xs uppercase tracking-wide text-[var(--dc-gray-500)]">Invites sent</p>
              <p className="mt-2 text-2xl font-bold text-[var(--dc-gray-900)]">{referralStats.invitedCount}</p>
            </article>
            <article className="dc-stat">
              <p className="text-xs uppercase tracking-wide text-[var(--dc-gray-500)]">Free months earned</p>
              <p className="mt-2 text-2xl font-bold text-[var(--dc-gray-900)]">{referralStats.creditedCount}</p>
            </article>
            <article className="dc-stat">
              <p className="text-xs uppercase tracking-wide text-[var(--dc-gray-500)]">Reward value</p>
              <p className="mt-2 text-2xl font-bold text-[var(--dc-gray-900)]">${referralValueDollars}</p>
            </article>
            <article className="dc-inner-panel sm:col-span-3">
              <p className="text-sm font-semibold text-[var(--dc-gray-900)]">Annual credit runway</p>
              <p className="mt-1 text-sm text-[var(--dc-gray-600)]">
                You have {referralStats.annualReferrerCreditsRemaining} of 3 referrer credits left this year.
              </p>
            </article>
          </div>
        </section>
      ) : null}

      {section === "all" || section === "pickups" ? (
        <section className="dc-card p-5 lg:col-span-2">
          <h3 className="text-xl font-bold text-[var(--dc-gray-900)]">Pickup Timeline</h3>
          <p className="mt-2 text-sm text-[var(--dc-gray-600)]">
            Active members are treated as ready by default unless they skip a month.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3 dc-stagger">
            <article className="dc-stat">
              <p className="text-xs uppercase tracking-wide text-[var(--dc-gray-500)]">Current cycle</p>
              <p className="mt-2 text-xl font-bold text-[var(--dc-gray-900)]">
                {safeDateLabel(currentCycle?.pickup_date)}
              </p>
            </article>
            <article className="dc-stat">
              <p className="text-xs uppercase tracking-wide text-[var(--dc-gray-500)]">Your status</p>
              <p className="mt-2 text-xl font-bold text-[var(--dc-gray-900)]">{formatCycleStatus(currentCycleRequest?.status ?? latestRequest?.status ?? null)}</p>
            </article>
            <article className="dc-stat">
              <p className="text-xs uppercase tracking-wide text-[var(--dc-gray-500)]">Last account update</p>
              <p className="mt-2 text-sm font-semibold text-[var(--dc-gray-900)]">
                {latestRequest ? safeDateTimeLabel(latestRequest.updated_at, "No update saved yet") : "No update saved yet"}
              </p>
            </article>
          </div>
        </section>
      ) : null}

      {section === "all" || section === "settings" || section === "pickups" ? (
        <section className="dc-card p-5 lg:col-span-2">
          <h3 className="text-xl font-bold text-[var(--dc-gray-900)]">Recent messages and account activity</h3>
          <p className="mt-2 text-sm text-[var(--dc-gray-600)]">
            Running history for reminders, billing notices, and pickup changes.
          </p>
          <div className="mt-4 space-y-2 dc-stagger">
            {activityFeed.length === 0 ? (
              <p className="text-sm text-[var(--dc-gray-500)]">No account events yet. Activity will appear here.</p>
            ) : (
              activityFeed.map((item) => (
                <article key={item.id} className="dc-inner-panel flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${item.tone === "pickup" ? "bg-[var(--dc-orange)]" : "bg-blue-400"}`} />
                    <div>
                      <p className="text-sm font-semibold text-[var(--dc-gray-900)]">{item.title}</p>
                      <p className="mt-0.5 text-xs text-[var(--dc-gray-500)]">
                        {item.detail} \u00b7 {safeDateTimeLabel(item.createdAt)}
                      </p>
                      {item.error ? <p className="mt-0.5 text-xs text-red-600">Delivery issue: {item.error}</p> : null}
                    </div>
                  </div>
                  <span className="dc-badge dc-badge-neutral">{item.statusLabel}</span>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}

      {section === "all" || section === "referrals" ? (
        <section className="dc-card p-5 lg:col-span-2">
          <h3 className="text-xl font-bold text-[var(--dc-gray-900)]">Recent Referral Activity</h3>
          <div className="mt-3 space-y-2 dc-stagger">
            {recentReferrals.length === 0 ? (
              <p className="text-sm text-[var(--dc-gray-500)]">No referrals yet. Share your invite link to unlock free-month credits.</p>
            ) : (
              recentReferrals.map((item) => (
                <div key={item.id} className="dc-inner-panel flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--dc-gray-900)]">{item.referredEmail || "Pending signup"}</p>
                    <p className="text-xs text-[var(--dc-gray-500)]">{safeDateLabel(item.createdAt)}</p>
                  </div>
                  <span className="dc-badge dc-badge-neutral">
                    {item.status.replaceAll("_", " ")}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {message ? (
        <div className="dc-toast dc-toast-success lg:col-span-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0" aria-hidden>
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          {message}
        </div>
      ) : null}
    </div>
  );
}
