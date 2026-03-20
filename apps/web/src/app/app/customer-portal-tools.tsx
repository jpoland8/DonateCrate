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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

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
        detail: cycle?.pickup_date ? `For ${new Date(cycle.pickup_date).toLocaleDateString()}` : "Saved to your account",
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
        ? `Last delivery attempt ${new Date(event.last_attempt_at).toLocaleString()}`
        : "Logged to your account",
      error: event.last_error,
    }));

    return [...pickupEvents, ...notificationFeed]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 12);
  }, [notificationEvents, recentPickupRequests]);

  const referralValueDollars = (referralStats.totalCreditCents / 100).toFixed(2);
  const activeSectionMeta =
    section === "referrals"
      ? {
          eyebrow: "Referrals",
          title: "Share one link. Earn free months.",
          detail: "Keep this page simple: copy your invite link, then track which households convert into credits.",
        }
      : section === "settings"
        ? {
            eyebrow: "Settings",
            title: "Control reminders and review account activity.",
            detail: "Everything here is about how DonateCrate reaches you and what has happened on your account lately.",
          }
        : section === "pickups"
          ? {
              eyebrow: "Pickup Details",
              title: "Stay aligned with this month’s pickup.",
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
    setMessage("Referral link copied.");
  }

  if (loading) {
    return <div className="rounded-2xl border border-black/10 bg-white p-5 text-sm text-[var(--dc-gray-700)]">Loading account details...</div>;
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {loadError}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {activeSectionMeta ? (
        <section className="lg:col-span-2 rounded-[1.9rem] border border-white/70 bg-[rgba(255,255,255,0.8)] p-5 shadow-[0_18px_45px_rgba(17,24,39,0.06)] backdrop-blur sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">{activeSectionMeta.eyebrow}</p>
          <h2 className="mt-2 text-2xl font-bold text-[var(--dc-gray-900)]">{activeSectionMeta.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--dc-gray-700)]">{activeSectionMeta.detail}</p>
        </section>
      ) : null}

      {section === "all" || section === "settings" ? (
        <section className="rounded-[1.9rem] border border-white/70 bg-[rgba(255,255,255,0.82)] p-5 shadow-[0_18px_45px_rgba(17,24,39,0.06)] backdrop-blur">
          <h3 className="text-xl font-bold">Reminder Preferences</h3>
          <p className="mt-2 text-sm text-[var(--dc-gray-700)]">
            Choose how DonateCrate should reach you when your monthly cycle is approaching.
          </p>
          <div className="mt-4 rounded-[1.5rem] bg-[linear-gradient(180deg,#f7f7f6_0%,#efebe6_100%)] p-4">
            <p className="text-sm font-semibold text-black">{reminderChannelSummary}</p>
            <p className="mt-1 text-sm text-[var(--dc-gray-700)]">
              Quiet hours: {prefs.quiet_hours_start && prefs.quiet_hours_end ? `${prefs.quiet_hours_start} to ${prefs.quiet_hours_end}` : "Not set"}
            </p>
          </div>
          <div className="mt-4 grid gap-3">
            <label className="flex items-start gap-3 rounded-[1.3rem] border border-black/10 bg-white/70 p-4 text-sm shadow-sm">
              <input
                type="checkbox"
                checked={prefs.email_enabled}
                onChange={(event) => setPrefs((prev) => ({ ...prev, email_enabled: event.target.checked }))}
                className="mt-0.5"
              />
              <span>
                <span className="block font-semibold text-black">Email reminders and billing alerts</span>
                <span className="mt-1 block text-[var(--dc-gray-700)]">Best for confirmations, billing updates, and account notices.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-[1.3rem] border border-black/10 bg-white/70 p-4 text-sm shadow-sm">
              <input
                type="checkbox"
                checked={prefs.sms_enabled}
                onChange={(event) => setPrefs((prev) => ({ ...prev, sms_enabled: event.target.checked }))}
                className="mt-0.5"
              />
              <span>
                <span className="block font-semibold text-black">Text reminders for pickup day</span>
                <span className="mt-1 block text-[var(--dc-gray-700)]">Best for quick reminders when your bag should be out.</span>
              </span>
            </label>
          </div>
          <div className="mt-4">
            <button
              onClick={savePrefs}
              className="rounded-full bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold text-white"
            >
              Save preferences
            </button>
          </div>
        </section>
      ) : null}

      {section === "all" || section === "referrals" ? (
        <section className="overflow-hidden rounded-[1.9rem] border border-white/70 bg-[rgba(255,255,255,0.82)] p-0 shadow-[0_18px_45px_rgba(17,24,39,0.06)] backdrop-blur">
          <div className="bg-[linear-gradient(120deg,#111_0%,#2a2a2a_45%,#ff6a00_130%)] p-5 text-white">
            <h3 className="text-xl font-bold">Free-Month Referrals</h3>
            <p className="mt-1 text-sm text-white/80">
              Invite neighbors and friends. When a new household activates, both homes earn a free month credit.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-xl bg-white/15 px-3 py-2 font-mono text-sm tracking-wide">
                {referralCode || "GENERATING"}
              </span>
              <button
                onClick={copyReferralLink}
                className="rounded-xl border border-white/50 px-3 py-2 text-sm font-semibold hover:bg-white hover:text-black"
              >
                Copy invite link
              </button>
            </div>
            <p className="mt-2 break-all text-xs text-white/70">{referralLink}</p>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-3">
            <article className="rounded-[1.35rem] border border-black/10 bg-white/70 p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--dc-gray-700)]">Invites sent</p>
              <p className="mt-2 text-2xl font-bold">{referralStats.invitedCount}</p>
            </article>
            <article className="rounded-[1.35rem] border border-black/10 bg-white/70 p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--dc-gray-700)]">Free months earned</p>
              <p className="mt-2 text-2xl font-bold">{referralStats.creditedCount}</p>
            </article>
            <article className="rounded-[1.35rem] border border-black/10 bg-white/70 p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--dc-gray-700)]">Reward value</p>
              <p className="mt-2 text-2xl font-bold">${referralValueDollars}</p>
            </article>
            <article className="rounded-[1.35rem] border border-black/10 bg-[linear-gradient(180deg,#f7f7f6_0%,#efebe6_100%)] p-4 sm:col-span-3">
              <p className="text-sm font-semibold text-black">Annual credit runway</p>
              <p className="mt-1 text-sm text-[var(--dc-gray-700)]">
                You still have {referralStats.annualReferrerCreditsRemaining} of 3 referrer credits left this year.
              </p>
            </article>
          </div>
        </section>
      ) : null}

      {section === "all" || section === "pickups" ? (
        <section className="rounded-[1.9rem] border border-white/70 bg-[rgba(255,255,255,0.82)] p-5 shadow-[0_18px_45px_rgba(17,24,39,0.06)] backdrop-blur lg:col-span-2">
          <h3 className="text-xl font-bold">Pickup Timeline</h3>
          <p className="mt-2 text-sm text-[var(--dc-gray-700)]">
            Active members are treated as ready by default unless they skip a month. Use the pickup controls above to change this cycle.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <article className="rounded-[1.4rem] bg-[linear-gradient(180deg,#f7f7f6_0%,#efebe6_100%)] p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--dc-gray-700)]">Current cycle</p>
              <p className="mt-2 text-xl font-bold">
                {currentCycle ? new Date(currentCycle.pickup_date).toLocaleDateString() : "Not scheduled"}
              </p>
            </article>
            <article className="rounded-[1.4rem] bg-[linear-gradient(180deg,#f7f7f6_0%,#efebe6_100%)] p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--dc-gray-700)]">Your status</p>
              <p className="mt-2 text-xl font-bold">{formatCycleStatus(currentCycleRequest?.status ?? latestRequest?.status ?? null)}</p>
            </article>
            <article className="rounded-[1.4rem] bg-[linear-gradient(180deg,#f7f7f6_0%,#efebe6_100%)] p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--dc-gray-700)]">Last account update</p>
              <p className="mt-2 text-sm font-semibold text-black">
                {latestRequest ? new Date(latestRequest.updated_at).toLocaleString() : "No update saved yet"}
              </p>
            </article>
          </div>
        </section>
      ) : null}

      {section === "all" || section === "settings" || section === "pickups" ? (
        <section className="rounded-[1.9rem] border border-white/70 bg-[rgba(255,255,255,0.82)] p-5 shadow-[0_18px_45px_rgba(17,24,39,0.06)] backdrop-blur lg:col-span-2">
          <h3 className="text-xl font-bold">Recent Account Activity</h3>
          <p className="mt-2 text-sm text-[var(--dc-gray-700)]">
            Reminders, billing notices, and pickup changes appear here in one running timeline.
          </p>
          <div className="mt-4 space-y-2">
            {activityFeed.length === 0 ? (
              <p className="text-sm text-[var(--dc-gray-700)]">No account events yet. Reminder and billing activity will appear here.</p>
            ) : (
              activityFeed.map((item) => (
                <article key={item.id} className="rounded-[1.25rem] border border-black/10 bg-white/75 p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dc-gray-700)]">
                      {item.statusLabel}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-[var(--dc-gray-700)]">
                    {item.detail} | {new Date(item.createdAt).toLocaleString()}
                  </p>
                  {item.error ? <p className="mt-1 text-xs text-red-600">Delivery issue: {item.error}</p> : null}
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}

      {section === "all" || section === "referrals" ? (
        <section className="rounded-[1.9rem] border border-white/70 bg-[rgba(255,255,255,0.82)] p-5 shadow-[0_18px_45px_rgba(17,24,39,0.06)] backdrop-blur lg:col-span-2">
          <h3 className="text-xl font-bold">Recent Referral Activity</h3>
          <div className="mt-3 space-y-2">
            {recentReferrals.length === 0 ? (
              <p className="text-sm text-[var(--dc-gray-700)]">No referrals yet. Share your invite link to unlock free-month credits.</p>
            ) : (
              recentReferrals.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between rounded-[1.25rem] border border-black/10 bg-white/75 p-4 shadow-sm">
                  <div>
                    <p className="text-sm font-semibold">{item.referredEmail || "Pending signup"}</p>
                    <p className="text-xs text-[var(--dc-gray-700)]">{new Date(item.createdAt).toLocaleDateString()}</p>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dc-gray-700)]">
                    {item.status.replaceAll("_", " ")}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {message ? (
        <p className="rounded-[1.25rem] border border-black/10 bg-white/80 px-4 py-3 text-sm text-[var(--dc-gray-700)] shadow-sm lg:col-span-2">
          {message}
        </p>
      ) : null}
    </div>
  );
}
