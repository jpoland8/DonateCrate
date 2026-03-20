import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { formatCycleStatus, getCustomerNextStep, getCycleUrgency, getNextReminderLabel } from "@/lib/customer-cycle";
import { CustomerActions } from "./customer-actions";
import { CustomerPortalTools } from "./customer-portal-tools";
import { PaymentWall } from "./payment-wall";

type CustomerPageProps = {
  searchParams?: Promise<{ tab?: string; checkout?: string; onboarding?: string }>;
};

export default async function CustomerDashboardPage({ searchParams }: CustomerPageProps) {
  const params = (await searchParams) ?? {};
  const activeTab = ["overview", "pickups", "referrals", "settings"].includes(params.tab || "")
    ? (params.tab as "overview" | "pickups" | "referrals" | "settings")
    : "overview";
  const checkoutStatus = params.checkout === "success" || params.checkout === "canceled" ? params.checkout : null;
  const onboardingCreated = params.onboarding === "created";
  const supabase = await createClient();
  const cookieStore = await cookies();
  const testBypassEnabled = process.env.ENABLE_TEST_BYPASS === "true";
  const testBypass = testBypassEnabled && cookieStore.get("dc_test_bypass")?.value === "1";
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/app");
  }

  const profile = await getCurrentProfile();
  if (!profile?.full_name || profile.full_name.trim().length < 2) {
    redirect("/app/onboarding");
  }
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: subscription }, { count: creditedReferrals }, { data: latestCycle }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("status,current_period_end")
      .eq("user_id", profile?.id ?? "")
      .maybeSingle(),
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_user_id", profile?.id ?? "")
      .eq("status", "credited"),
    supabase
      .from("pickup_cycles")
      .select("id,pickup_date,request_cutoff_at")
      .gte("pickup_date", today)
      .order("pickup_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const [{ data: currentCycleRequest }, { data: notificationPrefs }, { data: address }] = await Promise.all([
    latestCycle
      ? supabase
          .from("pickup_requests")
          .select("status,updated_at")
          .eq("user_id", profile.id)
          .eq("pickup_cycle_id", latestCycle.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("notification_preferences")
      .select("email_enabled,sms_enabled")
      .eq("user_id", profile.id)
      .maybeSingle(),
    supabase
      .from("addresses")
      .select("address_line1,city,state,postal_code")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const profileComplete = Boolean(
    profile.full_name?.trim() &&
      profile.phone?.trim() &&
      address?.address_line1?.trim() &&
      address?.city?.trim() &&
      address?.state?.trim() &&
      address?.postal_code?.trim(),
  );
  const nextReminderLabel = getNextReminderLabel(latestCycle?.pickup_date, notificationPrefs, new Date());
  const cycleUrgency = getCycleUrgency(latestCycle?.pickup_date, latestCycle?.request_cutoff_at, new Date());
  const nextStep = getCustomerNextStep({
    profileComplete,
    pickupDate: latestCycle?.pickup_date,
    requestCutoffAt: latestCycle?.request_cutoff_at,
    status: currentCycleRequest?.status,
  });

  const customerCards = [
    {
      title: "This Month",
      value: formatCycleStatus(currentCycleRequest?.status ?? null),
      detail: latestCycle?.request_cutoff_at
        ? `Reply by ${new Date(latestCycle.request_cutoff_at).toLocaleString()}`
        : "No pickup deadline published yet",
    },
    {
      title: "Next Pickup",
      value: latestCycle?.pickup_date ?? "TBD",
      detail: cycleUrgency.label,
    },
    {
      title: "Reminders",
      value: notificationPrefs?.sms_enabled || notificationPrefs?.email_enabled ? "On" : "Off",
      detail: nextReminderLabel,
    },
  ];
  const hasActiveBilling =
    subscription?.status === "active" ||
    subscription?.status === "trialing" ||
    subscription?.status === "paused";
  const portalUnlocked = hasActiveBilling || testBypass;

  if (!portalUnlocked) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-6">
        <header className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">Customer Dashboard</p>
          <h1 className="mt-2 text-3xl font-bold">Activate Your DonateCrate Plan</h1>
          <p className="mt-2 text-sm text-[var(--dc-gray-700)]">
            Your account is created. Complete billing to unlock pickups, referrals, and account settings.
          </p>
        </header>
        <PaymentWall checkoutStatus={checkoutStatus} onboardingCreated={onboardingCreated} />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8">
      <header className="overflow-hidden rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.78)] shadow-[0_22px_60px_rgba(17,24,39,0.08)] backdrop-blur">
        <div className="bg-[linear-gradient(135deg,#111827_0%,#1f2937_55%,#ff6a00_180%)] p-5 text-white sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Customer Dashboard</p>
              <h1 className="text-3xl font-bold sm:text-4xl">Your Monthly Pickup Home Base</h1>
              <p className="mt-2 max-w-3xl text-sm text-white/80">
                Review this month’s status, keep your profile current, and stay ahead of reminders without hunting through messages.
              </p>
            </div>
            <a href={nextStep.href} className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black">
              {nextStep.cta}
            </a>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <article className="rounded-[1.75rem] border border-white/15 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/65">Next Step</p>
              <h2 className="mt-2 text-2xl font-bold">{nextStep.title}</h2>
              <p className="mt-2 text-sm text-white/80">{nextStep.detail}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/70">
                <span className="rounded-full border border-white/20 px-3 py-1">
                  {latestCycle?.pickup_date ? `Pickup ${new Date(latestCycle.pickup_date).toLocaleDateString()}` : "Pickup date pending"}
                </span>
                <span className="rounded-full border border-white/20 px-3 py-1">{nextReminderLabel}</span>
              </div>
            </article>
            <article className="rounded-[1.75rem] border border-white/15 bg-black/20 p-5 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/65">Quick Facts</p>
              <div className="mt-3 space-y-2 text-sm text-white/80">
                <p>Profile: {profileComplete ? "Ready" : "Needs updates"}</p>
                <p>Plan: {subscription?.status ?? "not_started"}</p>
                <p>Referral credits: {creditedReferrals ?? 0}</p>
              </div>
            </article>
          </div>
        </div>
        <div className="border-t border-black/5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-black">{cycleUrgency.label}</p>
              <p className="mt-1 max-w-3xl text-sm text-[var(--dc-gray-700)]">{cycleUrgency.detail}</p>
            </div>
            <a href="#cycle-actions" className="rounded-full bg-[var(--dc-orange)] px-5 py-2 text-sm font-semibold text-white">
              Review pickup
            </a>
          </div>
        </div>
        {checkoutStatus === "success" ? (
          <div className="mx-5 mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 sm:mx-6 sm:mb-6">
            Billing is active. Your plan is ready, and you can now manage this month&apos;s pickup below.
          </div>
        ) : null}
        {checkoutStatus === "canceled" ? (
          <div className="mx-5 mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:mx-6 sm:mb-6">
            Stripe checkout was canceled before activation. Restart billing when you&apos;re ready.
          </div>
        ) : null}
      </header>

      {activeTab === "overview" || activeTab === "pickups" ? (
        <>
          {!profileComplete ? (
            <section className="rounded-[1.75rem] border border-amber-200 bg-[linear-gradient(135deg,#fff7ed_0%,#fffbeb_100%)] p-4 shadow-sm sm:p-5">
              <h2 className="text-xl font-bold text-amber-950">Finish Your Pickup Profile</h2>
              <p className="mt-2 text-sm text-amber-900">
                Add your phone number and full address so route planning and pickup reminders stay accurate.
              </p>
              <a
                href="/app/profile"
                className="mt-3 inline-block rounded-full bg-amber-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Complete Profile
              </a>
            </section>
          ) : null}

          <section className="grid gap-4 md:grid-cols-3">
            {customerCards.map((card) => (
              <article
                key={card.title}
                className="rounded-[1.6rem] border border-white/70 bg-[rgba(255,255,255,0.82)] p-4 shadow-[0_16px_35px_rgba(17,24,39,0.05)] backdrop-blur sm:p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dc-gray-700)]">{card.title}</p>
                <p className="mt-3 text-2xl font-bold text-[var(--dc-gray-900)]">{card.value}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--dc-gray-700)]">{card.detail}</p>
              </article>
            ))}
          </section>
        </>
      ) : null}

      {activeTab === "overview" ? (
        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-[1.9rem] border border-white/70 bg-[rgba(255,255,255,0.82)] p-5 shadow-[0_18px_45px_rgba(17,24,39,0.06)] backdrop-blur sm:p-6">
            <h2 className="text-2xl font-bold">What to Do</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-[1.4rem] bg-[linear-gradient(180deg,#f7f7f6_0%,#efebe6_100%)] p-4">
                <p className="text-sm font-semibold text-black">1. Confirm whether your bag is ready</p>
                <p className="mt-1 text-sm text-[var(--dc-gray-700)]">If you want a pickup this month, keep your stop active before the cutoff.</p>
              </div>
              <div className="rounded-[1.4rem] bg-[linear-gradient(180deg,#f7f7f6_0%,#efebe6_100%)] p-4">
                <p className="text-sm font-semibold text-black">2. Make sure your address and phone are current</p>
                <p className="mt-1 text-sm text-[var(--dc-gray-700)]">That keeps routing and reminder messages accurate.</p>
              </div>
            </div>
          </article>
          <article className="rounded-[1.9rem] border border-white/70 bg-[rgba(255,255,255,0.82)] p-5 shadow-[0_18px_45px_rgba(17,24,39,0.06)] backdrop-blur sm:p-6">
            <h2 className="text-2xl font-bold">Need to change something?</h2>
            <div className="mt-4 space-y-3 text-sm text-[var(--dc-gray-700)]">
              <p><span className="font-semibold text-black">Profile:</span> {profileComplete ? "Ready for routing" : "Needs updates"}</p>
              <p><span className="font-semibold text-black">Reminders:</span> {notificationPrefs?.sms_enabled || notificationPrefs?.email_enabled ? "On" : "Off"}</p>
              <p><span className="font-semibold text-black">Billing:</span> {subscription?.status ?? "not_started"}</p>
            </div>
            <a href="/app/profile" className="mt-4 inline-block rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-black">
              Review profile
            </a>
          </article>
        </section>
      ) : null}

      {activeTab === "pickups" ? (
        <section
          id="cycle-actions"
          className="rounded-[1.9rem] border border-white/70 bg-[rgba(255,255,255,0.82)] p-5 shadow-[0_18px_45px_rgba(17,24,39,0.06)] backdrop-blur sm:p-6"
        >
          <h2 className="text-2xl font-bold">Cycle Actions</h2>
          <div className="mt-4">
            <CustomerActions
              nextPickupDate={latestCycle?.pickup_date ?? null}
              currentStatus={currentCycleRequest?.status ?? null}
              requestCutoffAt={latestCycle?.request_cutoff_at ?? null}
              lastUpdatedAt={currentCycleRequest?.updated_at ?? null}
              profileComplete={profileComplete}
            />
          </div>
        </section>
      ) : null}

      {activeTab === "referrals" ? <CustomerPortalTools section="referrals" /> : null}
      {activeTab === "settings" ? <CustomerPortalTools section="settings" /> : null}
    </main>
  );
}
