import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { OnboardingForm } from "./profile-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/onboarding");

  const profile = await getCurrentProfile();

  const { data: address } = profile
    ? await supabase
        .from("addresses")
        .select("address_line1,address_line2,city,state,postal_code")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  // Skip onboarding if profile is already complete (name + address present)
  if (profile?.full_name && profile.full_name.trim().length > 1 && address?.address_line1) {
    redirect("/app");
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: nextCycle } = await supabase
    .from("pickup_cycles")
    .select("pickup_date")
    .gte("pickup_date", today)
    .order("pickup_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  const pickupLabel = nextCycle?.pickup_date
    ? new Date(nextCycle.pickup_date).toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,106,0,0.12)_0%,transparent_24%),linear-gradient(160deg,#f6f3ef_0%,#ebe6df_48%,#e6e0d8_100%)] px-4 py-8 sm:px-6 sm:py-12">
      <main className="mx-auto w-full max-w-3xl space-y-6">
        {/* Welcome header */}
        <header className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">Welcome to DonateCrate</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Let&apos;s get you set up</h1>
          <p className="mt-3 max-w-xl text-sm text-[var(--dc-gray-700)]">
            Fill in your details below and you&apos;ll be ready for your first pickup. This takes about 60 seconds.
          </p>
        </header>

        {/* How it works */}
        <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dc-gray-500)]">How it works</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <article className="rounded-2xl bg-[linear-gradient(180deg,#f7f7f6_0%,#efebe6_100%)] p-4">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--dc-orange)] text-sm font-bold text-white">1</span>
              <p className="mt-3 text-sm font-semibold text-black">Complete your profile</p>
              <p className="mt-1 text-xs text-[var(--dc-gray-600)]">
                Add your address and phone so we can plan your route and send reminders.
              </p>
            </article>
            <article className="rounded-2xl bg-[linear-gradient(180deg,#f7f7f6_0%,#efebe6_100%)] p-4">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--dc-orange)] text-sm font-bold text-white">2</span>
              <p className="mt-3 text-sm font-semibold text-black">Set out your orange bag</p>
              <p className="mt-1 text-xs text-[var(--dc-gray-600)]">
                On pickup day, leave your bag of donations at your front door by 9 AM.
              </p>
            </article>
            <article className="rounded-2xl bg-[linear-gradient(180deg,#f7f7f6_0%,#efebe6_100%)] p-4">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--dc-orange)] text-sm font-bold text-white">3</span>
              <p className="mt-3 text-sm font-semibold text-black">We handle the rest</p>
              <p className="mt-1 text-xs text-[var(--dc-gray-600)]">
                A driver picks up your bag, delivers to local partners, and you get a confirmation.
              </p>
            </article>
          </div>
          {pickupLabel ? (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Your first pickup is scheduled for <span className="font-bold">{pickupLabel}</span>. Complete your profile to be included.
            </p>
          ) : null}
        </section>

        {/* Profile form */}
        <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dc-orange)]">Your Details</p>
          <div className="mt-4">
            <OnboardingForm
              defaultEmail={profile?.email ?? user.email ?? ""}
              defaultFullName={profile?.full_name ?? ""}
              defaultPhone={profile?.phone ?? ""}
              defaultAddressLine1={address?.address_line1 ?? ""}
              defaultAddressLine2={address?.address_line2 ?? ""}
              defaultCity={address?.city ?? ""}
              defaultState={address?.state ?? ""}
              defaultPostalCode={address?.postal_code ?? ""}
              submitLabel="Complete Setup"
              returnPath="/app?onboarding=created"
            />
          </div>
        </section>

        {/* Support footer */}
        <p className="text-center text-sm text-[var(--dc-gray-500)]">
          Questions?{" "}
          <a href="mailto:support@donatecrate.com" className="font-semibold text-[var(--dc-orange)] hover:underline">
            Contact support
          </a>
        </p>
      </main>
    </div>
  );
}
