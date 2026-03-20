import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { OnboardingForm } from "../onboarding/profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/app/profile");

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/app/profile");

  const { data: address } = await supabase
    .from("addresses")
    .select("address_line1,address_line2,city,state,postal_code")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const missingFields = [
    !profile.full_name?.trim() ? "full name" : null,
    !profile.phone?.trim() ? "phone number" : null,
    !address?.address_line1?.trim() ? "street address" : null,
    !address?.city?.trim() ? "city" : null,
    !address?.state?.trim() ? "state" : null,
    !address?.postal_code?.trim() ? "postal code" : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.82)] shadow-[0_22px_60px_rgba(17,24,39,0.08)] backdrop-blur">
        <div className="bg-[linear-gradient(135deg,#111827_0%,#1f2937_55%,#ff6a00_180%)] p-8 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">Account Profile</p>
          <h1 className="mt-2 text-4xl font-bold">Keep Your Pickup Details Accurate</h1>
          <p className="mt-3 max-w-3xl text-sm text-white/80">
            DonateCrate uses this information for reminders, route planning, and pickup-day communication.
          </p>
        </div>
        <div className="grid gap-4 p-6 md:grid-cols-[1fr_1.3fr]">
          <div className="space-y-4">
            {missingFields.length > 0 ? (
              <div className="rounded-[1.5rem] border border-amber-200 bg-[linear-gradient(135deg,#fff7ed_0%,#fffbeb_100%)] p-4 text-sm text-amber-900">
                Complete these fields before your next route is finalized: {missingFields.join(", ")}.
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#f0fdf4_100%)] p-4 text-sm text-emerald-900">
                Your contact and pickup profile is complete for route planning.
              </div>
            )}
            <div className="rounded-[1.5rem] border border-black/5 bg-[linear-gradient(180deg,#f7f7f6_0%,#efebe6_100%)] p-4 text-sm text-[var(--dc-gray-700)]">
              <p className="font-semibold text-black">What matters most</p>
              <p className="mt-2">Phone number for reminders and route-day changes</p>
              <p className="mt-2">Street address that matches the pickup location</p>
              <p className="mt-2">Apartment or gate notes if they affect access</p>
            </div>
            <a href="/app" className="inline-block rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-black">
              Back to dashboard
            </a>
          </div>
          <div className="rounded-[1.75rem] border border-black/10 bg-white/88 p-2 shadow-[0_12px_30px_rgba(17,24,39,0.04)]">
            <OnboardingForm
              defaultEmail={profile.email ?? user.email ?? ""}
              defaultFullName={profile.full_name ?? ""}
              defaultPhone={profile.phone ?? ""}
              defaultAddressLine1={address?.address_line1 ?? ""}
              defaultAddressLine2={address?.address_line2 ?? ""}
              defaultCity={address?.city ?? ""}
              defaultState={address?.state ?? ""}
              defaultPostalCode={address?.postal_code ?? ""}
              submitLabel="Save Profile"
              returnPath="/app/profile"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
