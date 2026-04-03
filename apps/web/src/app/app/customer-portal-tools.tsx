"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPickupStatus, formatReferralStatus } from "@/lib/constants/status";
import { formatNotificationEventType, formatNotificationStatus } from "@/lib/notification-labels";
import { Spinner } from "@/components/ui/spinner";

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
  const [currentCycle, setCurrentCycle] = useState<{ pickup_date: string; pickup_window_label?: string | null } | null>(null);
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
  const [saving, setSaving] = useState(false);

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
        statusLabel: formatPickupStatus(request.status),
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
          : section === "all"
            ? {
                eyebrow: "Account",
                title: "Your account at a glance.",
                detail: "Manage notifications, referrals, and review your pickup history.",
              }
            : null;

  async function savePrefs() {
    setSaving(true);
    try {
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
    } finally {
      setSaving(false);
    }
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
            <button onClick={savePrefs} disabled={saving} className="dc-btn-primary inline-flex items-center gap-2">
              {saving ? <><Spinner size="sm" color="current" /> Saving...</> : "Save preferences"}
            </button>
          </div>
        </section>
      ) : null}

      {section === "all" || section === "referrals" ? (
        <section className="dc-card overflow-hidden p-0">
          <div className="bg-[linear-gradient(135deg,#111827_0%,#1f2937_55%,#ff6a00_180%)] p-5 sm:p-6 text-white">
            <div className="flex items-center gap-2 mb-3">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[var(--dc-orange)]" aria-hidden>
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Referral Program</p>
            </div>
            <h3 className="text-xl font-bold">Give a free month, earn a free month</h3>
            <p className="mt-2 text-sm text-white/80 max-w-lg">
              Share your personal invite link with neighbors and friends. They get their first month free — and when they subscribe, you earn a $5 credit off your next month.
            </p>

            {/* How it works steps */}
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-white/10 p-3 backdrop-blur">
                <p className="text-xs font-bold text-white/50">Step 1</p>
                <p className="mt-1 text-sm font-semibold">Share your link</p>
                <p className="mt-0.5 text-xs text-white/60">Copy and send to anyone in your area</p>
              </div>
              <div className="rounded-lg bg-white/10 p-3 backdrop-blur">
                <p className="text-xs font-bold text-white/50">Step 2</p>
                <p className="mt-1 text-sm font-semibold">They subscribe</p>
                <p className="mt-0.5 text-xs text-white/60">Your neighbor signs up at $5/mo</p>
              </div>
              <div className="rounded-lg bg-white/10 p-3 backdrop-blur">
                <p className="text-xs font-bold text-white/50">Step 3</p>
                <p className="mt-1 text-sm font-semibold">Both homes earn $5</p>
                <p className="mt-0.5 text-xs text-white/60">Credit applied to your next billing cycle</p>
              </div>
            </div>

            {/* Code + share */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 backdrop-blur">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Your code</span>
                <span className="font-mono text-sm font-bold tracking-wide">{referralCode || "Generating..."}</span>
              </div>
              <button
                onClick={copyReferralLink}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] shadow-sm transition-all duration-150 hover:bg-white/90 active:scale-[0.97]"
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
            {referralLinkLabel ? (
              <p className="mt-2 text-xs text-white/50 font-mono">{referralLinkLabel}</p>
            ) : null}
          </div>

          {/* Stats grid */}
          <div className="grid gap-px bg-black/5 sm:grid-cols-3">
            <article className="bg-white p-4 text-center">
              <p className="text-2xl font-bold text-[var(--dc-gray-900)]">{referralStats.qualifiedCount + referralStats.creditedCount}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--dc-gray-400)]">Invited</p>
            </article>
            <article className="bg-white p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{referralStats.creditedCount}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--dc-gray-400)]">Credits earned</p>
            </article>
            <article className="bg-white p-4 text-center">
              <p className="text-2xl font-bold text-[var(--dc-orange)]">${referralValueDollars}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--dc-gray-400)]">Total value</p>
            </article>
          </div>

          {/* Credit runway */}
          <div className="border-t border-black/5 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--dc-gray-900)]">Annual referrer credits</p>
                <p className="mt-0.5 text-xs text-[var(--dc-gray-500)]">
                  {referralStats.annualReferrerCreditsRemaining > 0
                    ? `You can earn ${referralStats.annualReferrerCreditsRemaining} more referrer credit${referralStats.annualReferrerCreditsRemaining !== 1 ? "s" : ""} this year (max 3 per year).`
                    : "You've reached your 3 referrer credits for this year. Credits reset in January."}
                </p>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`h-3 w-3 rounded-full ${
                      i < (3 - referralStats.annualReferrerCreditsRemaining)
                        ? "bg-emerald-500"
                        : "border border-black/10 bg-[var(--dc-gray-100)]"
                    }`}
                  />
                ))}
              </div>
            </div>
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
                {currentCycle?.pickup_window_label ? (
                  <span className="mt-0.5 block text-sm font-normal text-[var(--dc-gray-500)]">
                    {currentCycle.pickup_window_label}
                  </span>
                ) : null}
              </p>
            </article>
            <article className="dc-stat">
              <p className="text-xs uppercase tracking-wide text-[var(--dc-gray-500)]">Your status</p>
              <p className="mt-2 text-xl font-bold text-[var(--dc-gray-900)]">{formatPickupStatus(currentCycleRequest?.status ?? latestRequest?.status ?? null)}</p>
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
          <h3 className="text-xl font-bold text-[var(--dc-gray-900)]">Referral Activity</h3>
          <p className="mt-1 text-sm text-[var(--dc-gray-500)]">
            Track who signed up through your link and where they are in the process.
          </p>
          <div className="mt-4 space-y-2 dc-stagger">
            {recentReferrals.length === 0 ? (
              <div className="dc-inner-panel text-center py-8">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--dc-gray-100)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6 text-[var(--dc-gray-400)]" aria-hidden>
                    <circle cx="18" cy="5" r="3" strokeWidth="1.5" />
                    <circle cx="6" cy="12" r="3" strokeWidth="1.5" />
                    <circle cx="18" cy="19" r="3" strokeWidth="1.5" />
                    <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="mt-4 text-sm font-bold text-[var(--dc-gray-900)]">No referrals yet</p>
                <p className="mt-1.5 max-w-xs mx-auto text-xs text-[var(--dc-gray-500)]">
                  Share your link to earn $5 for every friend who signs up
                </p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={async () => {
                      const url = referralLink || (referralCode ? `https://donatecrate.com/signup?ref=${referralCode}` : "");
                      if (!url) return;
                      await navigator.clipboard.writeText(url);
                      setCopied(true);
                      setMessage("Referral link copied.");
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--dc-orange)]/30 bg-[var(--dc-orange)]/8 px-4 py-2 text-sm font-semibold text-[var(--dc-orange)] transition-all duration-150 hover:bg-[var(--dc-orange)]/15 active:scale-[0.97]"
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
                          <path d="M3 11V3a1 1 0 0 1 1-1h8" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        Copy my referral link
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              recentReferrals.map((item) => {
                const statusColor =
                  item.status === "credited"
                    ? "dc-badge-success"
                    : item.status === "qualified"
                      ? "dc-badge-warning"
                      : "dc-badge-neutral";
                const statusLabel =
                  item.status === "credited"
                    ? "Credited"
                    : item.status === "qualified"
                      ? "Subscribed"
                      : item.status === "pending"
                        ? "Signed up"
                        : item.status.replaceAll("_", " ");
                return (
                  <div key={item.id} className="dc-inner-panel flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--dc-gray-100)] text-xs font-bold text-[var(--dc-gray-500)]">
                        {item.referredEmail ? item.referredEmail.charAt(0).toUpperCase() : "?"}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--dc-gray-900)]">{item.referredEmail || "Pending signup"}</p>
                        <p className="text-xs text-[var(--dc-gray-500)]">{safeDateLabel(item.createdAt)}</p>
                      </div>
                    </div>
                    <span className={`dc-badge ${statusColor}`}>
                      {statusLabel}
                    </span>
                  </div>
                );
              })
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
