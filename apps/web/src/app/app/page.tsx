import { redirect } from "next/navigation";
import Stripe from "stripe";
import { getDefaultHomePath, hasOperationsConsoleAccess } from "@/lib/access";
import { getCurrentPartnerRole } from "@/lib/partner-access";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatCycleStatus, getCustomerNextStep, getCycleUrgency, getNextReminderLabel } from "@/lib/customer-cycle";
import { ensureDefaultPickupRequestForUser } from "@/lib/pickup-defaults";
import { CustomerActions } from "./customer-actions";
import { CustomerPortalTools } from "./customer-portal-tools";
import { PaymentWall } from "./payment-wall";
import { SubscribedTracker } from "./subscribed-tracker";

type CustomerPageProps = {
  searchParams?: Promise<{ tab?: string; checkout?: string; onboarding?: string; session_id?: string }>;
};

type CustomerTab = "home" | "pickup" | "rewards" | "account";

function getCustomerTab(tab: string | undefined): CustomerTab {
  if (tab === "overview") return "home";
  if (tab === "pickups") return "pickup";
  if (tab === "referrals") return "rewards";
  if (tab === "settings") return "account";
  return ["home", "pickup", "rewards", "account"].includes(tab || "") ? (tab as CustomerTab) : "home";
}

async function syncCheckoutSuccessIfNeeded(params: { profileId: string; sessionId?: string; checkoutStatus?: "success" | "canceled" | null }) {
  const { profileId, sessionId, checkoutStatus } = params;
  if (checkoutStatus !== "success" || !sessionId) return;

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey || stripeSecretKey === "placeholder") return;

  const stripe = new Stripe(stripeSecretKey, {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 1,
    timeout: 20000,
  });
  const supabaseAdmin = createSupabaseAdminClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  const appUserId = session.metadata?.app_user_id;
  if (!appUserId || appUserId !== profileId) return;

  const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;
  const stripeSubscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
  if (!stripeCustomerId || !stripeSubscriptionId) return;

  const expandedSubscription =
    session.subscription && typeof session.subscription !== "string"
      ? (session.subscription as Stripe.Subscription & {
          current_period_start?: number;
          current_period_end?: number;
        })
      : null;
  const currentPeriodStart =
    typeof expandedSubscription?.current_period_start === "number"
      ? new Date(expandedSubscription.current_period_start * 1000).toISOString()
      : null;
  const currentPeriodEnd =
    typeof expandedSubscription?.current_period_end === "number"
      ? new Date(expandedSubscription.current_period_end * 1000).toISOString()
      : null;

  const { data: existingSubscription } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("user_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    user_id: profileId,
    pricing_plan_id: session.metadata?.pricing_plan_id ?? null,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    status: "active",
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    updated_at: new Date().toISOString(),
  };

  if (existingSubscription?.id) {
    await supabaseAdmin.from("subscriptions").update(payload).eq("id", existingSubscription.id);
  } else {
    await supabaseAdmin.from("subscriptions").insert(payload);
  }
}

export default async function CustomerDashboardPage({ searchParams }: CustomerPageProps) {
  const params = (await searchParams) ?? {};
  const activeTab = getCustomerTab(params.tab);
  const checkoutStatus = params.checkout === "success" || params.checkout === "canceled" ? params.checkout : null;
  const onboardingCreated = params.onboarding === "created";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/app");
  }

  const profile = await getCurrentProfile();
  if (profile) {
    const { partnerRole } = await getCurrentPartnerRole({
      supabase,
      userId: profile.id,
    });
    if (hasOperationsConsoleAccess(profile.role) || partnerRole) {
      redirect(getDefaultHomePath(profile.role, { hasActivePartnerMembership: Boolean(partnerRole) }));
    }
  }
  if (!profile?.full_name || profile.full_name.trim().length < 2) {
    redirect("/app/onboarding");
  }

  await syncCheckoutSuccessIfNeeded({
    profileId: profile.id,
    sessionId: params.session_id,
    checkoutStatus,
  });

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
      .select("id,pickup_date")
      .gte("pickup_date", today)
      .order("pickup_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profile?.id) {
    await ensureDefaultPickupRequestForUser({
      supabase,
      userId: profile.id,
      today,
    });
  }

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
  const cycleUrgency = getCycleUrgency(latestCycle?.pickup_date, new Date());
  const safePickupBadge = (() => {
    if (!latestCycle?.pickup_date) return "Pickup date pending";
    const parsed = new Date(latestCycle.pickup_date);
    return Number.isNaN(parsed.getTime()) ? "Pickup date pending" : `Pickup ${parsed.toLocaleDateString()}`;
  })();
  const nextStep = getCustomerNextStep({
    profileComplete,
    pickupDate: latestCycle?.pickup_date,
    status: currentCycleRequest?.status,
  });

  const customerCards = [
    {
      title: "This Month",
      value: formatCycleStatus(currentCycleRequest?.status ?? null),
      detail: cycleUrgency.label,
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
    subscription?.status === "paused";
  const portalUnlocked = hasActiveBilling;

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
      <SubscribedTracker enabled={checkoutStatus === "success"} />
      <header className="dc-card overflow-hidden !rounded-[var(--radius-xl)] !p-0">
        <div className="bg-[linear-gradient(135deg,#111827_0%,#1f2937_55%,#ff6a00_180%)] p-5 text-white sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Customer Dashboard</p>
              <h1 className="text-3xl font-bold sm:text-4xl">Your Monthly Pickup Home Base</h1>
              <p className="mt-2 max-w-3xl text-sm text-white/80">
                Review this month’s status, keep your profile current, and stay ahead of reminders without hunting through messages.
              </p>
            </div>
            <a href={nextStep.href} className="dc-btn-secondary !bg-white">
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
                  {safePickupBadge}
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
            <a href="#cycle-actions" className="dc-btn-primary">
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

      {activeTab === "home" || activeTab === "pickup" ? (
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

          <section className="grid gap-4 md:grid-cols-3 dc-stagger">
            {customerCards.map((card) => (
              <article key={card.title} className="dc-card p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dc-gray-500)]">{card.title}</p>
                <p className="mt-3 text-2xl font-bold text-[var(--dc-gray-900)]">{card.value}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--dc-gray-600)]">{card.detail}</p>
              </article>
            ))}
          </section>
        </>
      ) : null}

      {activeTab === "home" ? (
        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="dc-card p-5 sm:p-6">
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
          <article className="dc-card p-5 sm:p-6">
            <h2 className="text-2xl font-bold">Need to change something?</h2>
            <div className="mt-4 space-y-3 text-sm text-[var(--dc-gray-700)]">
              <p><span className="font-semibold text-black">Profile:</span> {profileComplete ? "Ready for routing" : "Needs updates"}</p>
              <p><span className="font-semibold text-black">Reminders:</span> {notificationPrefs?.sms_enabled || notificationPrefs?.email_enabled ? "On" : "Off"}</p>
              <p><span className="font-semibold text-black">Billing:</span> {subscription?.status ?? "not_started"}</p>
            </div>
            <a href="/app/profile" className="mt-4 dc-btn-secondary inline-flex">
              Review profile
            </a>
          </article>
        </section>
      ) : null}

      {activeTab === "pickup" ? (
        <section
          id="cycle-actions"
          className="dc-card p-5 sm:p-6"
        >
          <div className="mb-5 rounded-[1.4rem] border border-black/10 bg-[linear-gradient(180deg,#f7f7f6_0%,#efebe6_100%)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dc-orange)]">Pickup</p>
            <h2 className="mt-2 text-2xl font-bold text-[var(--dc-gray-900)]">Handle this month&apos;s pickup in one place</h2>
            <p className="mt-2 text-sm text-[var(--dc-gray-700)]">
              Check your route status, skip this month, or manage your billing — all in one place.
            </p>
          </div>
          <div className="mt-4">
            <CustomerActions
              nextPickupDate={latestCycle?.pickup_date ?? null}
              currentStatus={currentCycleRequest?.status ?? null}
              lastUpdatedAt={currentCycleRequest?.updated_at ?? null}
              profileComplete={profileComplete}
            />
          </div>
        </section>
      ) : null}

      {activeTab === "rewards" ? <CustomerPortalTools section="referrals" /> : null}
      {activeTab === "account" ? <CustomerPortalTools section="settings" /> : null}
    </main>
  );
}
