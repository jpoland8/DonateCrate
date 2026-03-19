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
    <div className="mx-auto w-full max-w-2xl rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--dc-orange)]">Account Profile</p>
      <h1 className="mt-2 text-4xl font-bold">Update Your Details</h1>
      <p className="mt-3 text-[var(--dc-gray-700)]">
        Keep your contact and pickup address current so monthly route planning stays accurate.
      </p>
      {missingFields.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Complete these fields before your next route is finalized: {missingFields.join(", ")}.
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Your contact and pickup profile is complete for route planning.
        </div>
      )}
      <div className="mt-6">
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
  );
}
