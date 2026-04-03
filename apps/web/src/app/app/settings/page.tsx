import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { checkSavedAddressEligibility } from "@/lib/address-eligibility";
import { SettingsClient } from "./settings-client";

export const metadata = { title: "Account Settings — DonateCrate" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/settings");

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/app/settings");

  const [
    { data: address },
    { data: subscription },
    { data: prefs },
  ] = await Promise.all([
    supabase
      .from("addresses")
      .select("id,address_line1,address_line2,city,state,postal_code,lat,lng")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("status,current_period_end,cancel_at,stripe_subscription_id")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("notification_preferences")
      .select("email_enabled,sms_enabled")
      .eq("user_id", profile.id)
      .maybeSingle(),
  ]);

  // Check current zone eligibility for address
  let zoneStatus: "active" | "pending" | "launching" | "not_covered" | null = null;
  let zoneName: string | null = null;
  if (address) {
    try {
      const eligibility = await checkSavedAddressEligibility(address);
      zoneStatus = (eligibility?.status ?? null) as "active" | "pending" | "launching" | "not_covered";
      zoneName = eligibility?.zone?.name ?? null;
    } catch {
      // non-fatal
    }
  }

  return (
    <SettingsClient
      profile={{
        id: profile.id,
        fullName: profile.full_name ?? "",
        email: user.email ?? "",
        phone: profile.phone ?? "",
      }}
      address={address
        ? {
            addressLine1: address.address_line1 ?? "",
            addressLine2: address.address_line2 ?? "",
            city: address.city ?? "",
            state: address.state ?? "",
            postalCode: address.postal_code ?? "",
          }
        : null}
      subscription={subscription
        ? {
            status: subscription.status ?? "none",
            currentPeriodEnd: subscription.current_period_end ?? null,
            cancelAt: subscription.cancel_at ?? null,
            hasStripe: Boolean(subscription.stripe_subscription_id),
          }
        : null}
      preferences={{
        emailEnabled: prefs?.email_enabled ?? true,
        smsEnabled: prefs?.sms_enabled ?? true,
      }}
      zoneStatus={zoneStatus}
      zoneName={zoneName}
    />
  );
}
