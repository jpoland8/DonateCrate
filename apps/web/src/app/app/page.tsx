import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { formatCycleStatus, getNextReminderLabel } from "@/lib/customer-cycle";
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

  const customerCards = [
    {
      title: "Next Pickup",
      value: latestCycle?.pickup_date ?? "TBD",
      detail: "Window assigned closer to route day",
    },
    {
      title: "Cycle Response",
      value: formatCycleStatus(currentCycleRequest?.status ?? null),
      detail: latestCycle?.request_cutoff_at
        ? `Reply by ${new Date(latestCycle.request_cutoff_at).toLocaleString()}`
        : "No pickup deadline published yet",
    },
    {
      title: "Plan Status",
      value: subscription?.status ?? "not_started",
      detail: "Launch plan $5/month",
    },
    {
      title: "Referral Credits",
      value: String(creditedReferrals ?? 0),
      detail: "Qualified friend referrals",
    },
    {
      title: "Reminder Status",
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
      <header className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">Customer Dashboard</p>
            <h1 className="text-3xl font-bold sm:text-4xl">DonateCrate Account</h1>
            <p className="mt-1 text-sm text-[var(--dc-gray-700)]">{profile?.email ?? user.email}</p>
          </div>
          <a href="#cycle-actions" className="rounded-full bg-[var(--dc-orange)] px-5 py-2 text-sm font-semibold text-white">
            Pickup Actions
          </a>
        </div>
        <div>
          <p className="mt-4 max-w-3xl text-sm text-[var(--dc-gray-700)]">
            Keep your monthly textile donation routine simple: confirm your pickup, manage alerts, and track free-month
            rewards from referrals.
          </p>
        </div>
        {checkoutStatus === "success" ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Billing is active. Your plan is ready, and you can now manage this month&apos;s pickup below.
          </div>
        ) : null}
        {checkoutStatus === "canceled" ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Stripe checkout was canceled before activation. Restart billing when you&apos;re ready.
          </div>
        ) : null}
      </header>

      {activeTab === "overview" || activeTab === "pickups" ? (
        <>
          {!profileComplete ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
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

          <section className="rounded-2xl border border-black/10 bg-white p-4 sm:p-5">
            <h2 className="text-xl font-bold">How Your Portal Works</h2>
            <p className="mt-2 text-sm text-[var(--dc-gray-700)]">
              Each month, mark whether your orange bag is ready. We route pickups by neighborhood density, send updates by
              email/SMS based on your preferences, and track referrals so you can earn free months.
            </p>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {customerCards.map((card) => (
              <article key={card.title} className="rounded-2xl border border-black/10 bg-white p-4 sm:p-5">
                <p className="text-sm text-[var(--dc-gray-700)]">{card.title}</p>
                <p className="mt-2 text-2xl font-bold">{card.value}</p>
                <p className="mt-1 text-sm text-[var(--dc-gray-700)]">{card.detail}</p>
              </article>
            ))}
          </section>
        </>
      ) : null}

      {activeTab === "overview" ? (
        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <article className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
            <h2 className="text-2xl font-bold">Welcome Back</h2>
            <p className="mt-2 text-sm text-[var(--dc-gray-700)]">
              Use the sidebar tabs to manage your monthly pickup, referral rewards, and notification settings.
            </p>
            <div className="mt-4 rounded-2xl bg-[var(--dc-gray-100)] p-4 text-sm text-[var(--dc-gray-700)]">
              <p className="font-semibold text-black">This month&apos;s status</p>
              <p className="mt-1">{formatCycleStatus(currentCycleRequest?.status ?? null)}</p>
              {currentCycleRequest?.updated_at ? (
                <p className="mt-1">Last action saved {new Date(currentCycleRequest.updated_at).toLocaleString()}.</p>
              ) : (
                <p className="mt-1">You have not responded to this cycle yet.</p>
              )}
            </div>
          </article>
          <article className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
            <h2 className="text-2xl font-bold">What Happens Next</h2>
            <div className="mt-4 space-y-3 text-sm text-[var(--dc-gray-700)]">
              <p>1. Confirm pickup or skip before the cycle cutoff.</p>
              <p>2. Watch for reminder messages as pickup day gets closer.</p>
              <p>3. Set your bag out on route day and track follow-up in this portal.</p>
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "pickups" ? (
        <section id="cycle-actions" className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
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
