import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { CustomerActions } from "./customer-actions";
import { CustomerPortalTools } from "./customer-portal-tools";
import { PaymentWall } from "./payment-wall";

type CustomerPageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

export default async function CustomerDashboardPage({ searchParams }: CustomerPageProps) {
  const params = (await searchParams) ?? {};
  const activeTab = ["overview", "pickups", "referrals", "settings"].includes(params.tab || "")
    ? (params.tab as "overview" | "pickups" | "referrals" | "settings")
    : "overview";
  const supabase = await createClient();
  const cookieStore = await cookies();
  const testBypass = cookieStore.get("dc_test_bypass")?.value === "1";
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
      .select("id,pickup_date")
      .gte("pickup_date", today)
      .order("pickup_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const { data: currentCycleRequest } = latestCycle
    ? await supabase
        .from("pickup_requests")
        .select("status,updated_at")
        .eq("user_id", profile.id)
        .eq("pickup_cycle_id", latestCycle.id)
        .maybeSingle()
    : { data: null };

  const customerCards = [
    {
      title: "Next Pickup",
      value: latestCycle?.pickup_date ?? "TBD",
      detail: "Window assigned closer to route day",
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
  ];
  const hasActiveBilling =
    subscription?.status === "active" ||
    subscription?.status === "trialing" ||
    subscription?.status === "paused";
  const portalUnlocked = hasActiveBilling || testBypass;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--dc-gray-700)]">Customer Dashboard</p>
          <h1 className="text-4xl font-bold">DonateCrate Account</h1>
          <p className="mt-1 text-sm text-[var(--dc-gray-700)]">{profile?.email ?? user.email}</p>
        </div>
        <a href="#cycle-actions" className="rounded-full bg-[var(--dc-orange)] px-5 py-2 text-sm font-semibold text-white">
          Pickup Actions
        </a>
      </header>

      <section className="rounded-2xl border border-black/10 bg-white p-5">
        <h2 className="text-xl font-bold">How Your Portal Works</h2>
        <p className="mt-2 text-sm text-[var(--dc-gray-700)]">
          Each month, mark whether your orange bag is ready. We route pickups by neighborhood density, send updates by
          email/SMS based on your preferences, and track referrals so you can earn free months.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {customerCards.map((card) => (
          <article key={card.title} className="rounded-2xl border border-black/10 bg-white p-5">
            <p className="text-sm text-[var(--dc-gray-700)]">{card.title}</p>
            <p className="mt-2 text-2xl font-bold">{card.value}</p>
            <p className="mt-1 text-sm text-[var(--dc-gray-700)]">{card.detail}</p>
          </article>
        ))}
      </section>

      {!portalUnlocked ? (
        <PaymentWall />
      ) : (
        <>
          {activeTab === "overview" ? (
            <section className="rounded-3xl border border-black/10 bg-white p-6">
              <h2 className="text-2xl font-bold">Welcome Back</h2>
              <p className="mt-2 text-sm text-[var(--dc-gray-700)]">
                Use the sidebar tabs to manage your monthly pickup, referral rewards, and notification settings.
              </p>
            </section>
          ) : null}

          {activeTab === "pickups" ? (
            <section id="cycle-actions" className="rounded-3xl border border-black/10 bg-white p-6">
              <h2 className="text-2xl font-bold">Cycle Actions</h2>
              <div className="mt-4">
                <CustomerActions
                  nextPickupDate={latestCycle?.pickup_date ?? null}
                  currentStatus={currentCycleRequest?.status ?? "requested"}
                />
              </div>
            </section>
          ) : null}

          {activeTab === "referrals" ? <CustomerPortalTools section="referrals" /> : null}
          {activeTab === "settings" ? <CustomerPortalTools section="settings" /> : null}
        </>
      )}
    </main>
  );
}
