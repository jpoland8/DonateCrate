import { redirect } from "next/navigation";
import Stripe from "stripe";
import { getDefaultHomePath, hasOperationsConsoleAccess } from "@/lib/access";
import { getCurrentPartnerRole } from "@/lib/partner-access";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCustomerNextStep, getCycleUrgency, getNextReminderLabel } from "@/lib/customer-cycle";
import { ensureDefaultPickupRequestForUser } from "@/lib/pickup-defaults";
import { CustomerActions } from "./customer-actions";
import { CustomerPortalTools } from "./customer-portal-tools";
import { ReferralSnippet } from "./referral-snippet";
import { PaymentWall } from "./payment-wall";
import { SubscribedTracker } from "./subscribed-tracker";

type CustomerPageProps = {
  searchParams?: Promise<{ tab?: string; checkout?: string; onboarding?: string; session_id?: string }>;
};

type CustomerTab = "home" | "account";

function getCustomerTab(tab: string | undefined): CustomerTab {
  if (tab === "settings" || tab === "account") return "account";
  return "home";
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

  // Check zone eligibility for waitlisted state
  const { data: addressRow } = await supabase
    .from("addresses")
    .select("postal_code")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let isWaitlisted = false;
  if (addressRow?.postal_code) {
    try {
      const { checkEligibility } = await import("@/lib/eligibility");
      const eligibility = await checkEligibility({ postalCode: addressRow.postal_code });
      isWaitlisted = eligibility.status !== "active";
    } catch { /* non-fatal */ }
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

  const hasActiveBilling =
    subscription?.status === "active" ||
    subscription?.status === "paused";
  const portalUnlocked = hasActiveBilling;

  if (!portalUnlocked) {
    // Waitlisted — zone not active yet, no billing needed
    if (isWaitlisted) {
      return (
        <main className="mx-auto w-full max-w-3xl space-y-5">
          {/* Hero */}
          <header className="relative overflow-hidden rounded-3xl shadow-xl">
            <div className="bg-[linear-gradient(135deg,#111827_0%,#1f2937_60%,#7c2d12_100%)] p-7 text-white sm:p-10">
              {/* Decorative background glow */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-20"
                style={{ background: "radial-gradient(circle, #ea580c 0%, transparent 70%)" }}
              />
              <div className="relative">
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-3xl shadow-inner ring-1 ring-white/20">
                  📬
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Waitlist</p>
                <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl">
                  You&apos;re on the list,<br />
                  <span className="text-orange-300">{profile.full_name?.split(" ")[0]}</span>!
                </h1>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-white/75">
                  DonateCrate hasn&apos;t launched in your area yet — but you&apos;re first in line. We&apos;ll send you an email the moment service opens near you.
                </p>
              </div>
            </div>
          </header>

          {/* What happens next */}
          <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--dc-gray-400)]">What happens next</h2>
            <ol className="mt-4 space-y-4">
              <li className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--dc-orange)]/10 text-xs font-bold text-[var(--dc-orange)]">1</div>
                <div>
                  <p className="text-sm font-semibold text-[var(--dc-gray-900)]">We watch for zone activation</p>
                  <p className="mt-0.5 text-xs text-[var(--dc-gray-500)]">Our team monitors demand in your neighborhood and activates new zones as interest grows.</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--dc-orange)]/10 text-xs font-bold text-[var(--dc-orange)]">2</div>
                <div>
                  <p className="text-sm font-semibold text-[var(--dc-gray-900)]">You get an email the moment it opens</p>
                  <p className="mt-0.5 text-xs text-[var(--dc-gray-500)]">You&apos;ll be among the first to know — no need to check back manually.</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--dc-orange)]/10 text-xs font-bold text-[var(--dc-orange)]">3</div>
                <div>
                  <p className="text-sm font-semibold text-[var(--dc-gray-900)]">Complete billing and get your first pickup</p>
                  <p className="mt-0.5 text-xs text-[var(--dc-gray-500)]">One quick step to activate your plan, then we handle the rest.</p>
                </div>
              </li>
            </ol>
          </section>

          {/* Action cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <a
              href="/app/settings"
              className="group flex items-start gap-4 rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--dc-orange)]/10 text-[var(--dc-orange)] transition-colors group-hover:bg-[var(--dc-orange)]/20">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 1 1 9.9 9.9A7 7 0 0 1 5.05 4.05zm1.414 8.486A5 5 0 1 0 13.536 5.464 5 5 0 0 0 6.464 12.536z" clipRule="evenodd"/>
                  <path d="M10 7a1 1 0 0 1 1 1v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0v-2H7a1 1 0 1 1 0-2h2V8a1 1 0 0 1 1-1z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--dc-gray-900)]">Update your address</p>
                <p className="mt-0.5 text-xs text-[var(--dc-gray-500)]">Keep your address current so we can alert you the moment your zone activates.</p>
                <span className="mt-2 inline-block text-xs font-semibold text-[var(--dc-orange)]">Go to settings →</span>
              </div>
            </a>
            <a
              href="/refer"
              className="group flex items-start gap-4 rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition-colors group-hover:bg-emerald-100">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM17 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 0 0-1.5-4.33A5 5 0 0 1 19 16v1h-6.07zM6 11a5 5 0 0 1 5 5v1H1v-1a5 5 0 0 1 5-5z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--dc-gray-900)]">Refer a neighbor</p>
                <p className="mt-0.5 text-xs text-[var(--dc-gray-500)]">More neighbors on the list means your zone activates sooner. Share your link.</p>
                <span className="mt-2 inline-block text-xs font-semibold text-emerald-700">Get referral link →</span>
              </div>
            </a>
          </div>

          {/* Footer note */}
          <p className="text-center text-xs text-[var(--dc-gray-400)]">
            Moved recently?{" "}
            <a href="/app/settings" className="font-semibold text-[var(--dc-orange)] hover:underline">
              Update your address
            </a>
            {" "}and we&apos;ll check if service is available in your new area.
          </p>
        </main>
      );
    }

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
    <main className="mx-auto w-full max-w-5xl space-y-6">
      <SubscribedTracker enabled={checkoutStatus === "success"} />

      {/* Checkout feedback banners */}
      {checkoutStatus === "success" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Billing is active. Your plan is ready — manage this month&apos;s pickup below.
        </div>
      ) : null}
      {checkoutStatus === "canceled" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Stripe checkout was canceled. Restart billing when you&apos;re ready.
        </div>
      ) : null}

      {activeTab === "home" ? (
        <>
          {/* Hero card */}
          <header className="overflow-hidden rounded-[var(--radius-xl)] shadow-xl">
            <div className="relative bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_50%,#431407_100%)] p-5 text-white sm:p-7">
              {/* Depth overlay — radial glow top-right */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-25"
                style={{ background: "radial-gradient(circle, #ea580c 0%, transparent 65%)" }}
              />
              {/* Brand anchor dot */}
              <div className="relative mb-5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--dc-orange)] shadow-lg ring-2 ring-white/20">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-white">
                  <path d="M3 3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H3zM3 9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3zM2 15a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2z"/>
                </svg>
              </div>
              <div className="relative flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">This Month</p>
                  <h1 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{nextStep.title}</h1>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">{nextStep.detail}</p>
                </div>
                <a
                  href={nextStep.href}
                  className="shrink-0 rounded-full bg-[var(--dc-orange)] px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-opacity hover:opacity-90"
                >
                  {nextStep.cta}
                </a>
              </div>
              {/* Badges row */}
              <div className="relative mt-5 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-[var(--dc-orange)] px-3 py-1 font-semibold text-white shadow">
                  {safePickupBadge}
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/80">
                  {nextReminderLabel}
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/80">
                  {profileComplete ? "Profile complete ✓" : "Profile needs updates"}
                </span>
              </div>
            </div>
            {/* Cycle urgency bar — tinted background */}
            <div className="border-t border-black/5 bg-[var(--dc-gray-50)] p-4 sm:p-5">
              <p className="text-sm font-semibold text-black">{cycleUrgency.label}</p>
              <p className="mt-1 text-sm text-[var(--dc-gray-600)]">{cycleUrgency.detail}</p>
            </div>
          </header>

          {/* Profile incomplete warning */}
          {!profileComplete ? (
            <section className="rounded-2xl border border-amber-200 bg-[linear-gradient(135deg,#fff7ed_0%,#fffbeb_100%)] p-4 shadow-sm sm:p-5">
              <h2 className="text-lg font-bold text-amber-950">Finish Your Pickup Profile</h2>
              <p className="mt-1 text-sm text-amber-900">
                Add your phone number and full address so route planning and reminders stay accurate.
              </p>
              <a href="/app/settings" className="mt-3 inline-block rounded-full bg-amber-900 px-4 py-2 text-sm font-semibold text-white">
                Complete Profile
              </a>
            </section>
          ) : null}

          {/* Pickup actions — the core of the customer experience */}
          <section id="cycle-actions">
            <CustomerActions
              nextPickupDate={latestCycle?.pickup_date ?? null}
              currentStatus={currentCycleRequest?.status ?? null}
              lastUpdatedAt={currentCycleRequest?.updated_at ?? null}
              profileComplete={profileComplete}
            />
          </section>

          {/* Referral card — interactive with copy link */}
          <ReferralSnippet creditedReferrals={creditedReferrals ?? 0} />

          {/* Settings link */}
          <section className="rounded-2xl border border-black/5 bg-white/60 p-4 text-center">
            <p className="text-sm text-[var(--dc-gray-500)]">
              <a href="/app/settings" className="font-semibold text-[var(--dc-orange)] hover:underline">Account Settings</a>
              {" "}· Change address, billing, notifications{" "}·{" "}
              <a href="mailto:support@donatecrate.com" className="font-semibold text-[var(--dc-orange)] hover:underline">
                Contact support
              </a>
            </p>
          </section>
        </>
      ) : null}

      {activeTab === "account" ? <CustomerPortalTools section="all" /> : null}
    </main>
  );
}
