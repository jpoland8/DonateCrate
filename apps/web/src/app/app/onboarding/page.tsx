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
  if (profile?.full_name && profile.full_name.trim().length > 1) {
    redirect("/app");
  }

  const { data: address } = profile
    ? await supabase
        .from("addresses")
        .select("address_line1,address_line2,city,state,postal_code")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  return (
    <div className="min-h-screen bg-[var(--dc-gray-100)] px-6 py-10">
      <main className="mx-auto w-full max-w-2xl rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--dc-orange)]">Account Setup</p>
        <h1 className="mt-2 text-4xl font-bold">Finish Your Profile</h1>
        <p className="mt-3 text-[var(--dc-gray-700)]">
          Add your basic details so we can manage pickup notifications and routing correctly.
        </p>
        <div className="mt-6">
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
            returnPath="/app"
          />
        </div>
      </main>
    </div>
  );
}
