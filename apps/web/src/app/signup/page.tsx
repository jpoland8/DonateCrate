import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "./signup-form";

type SignupPageProps = {
  searchParams?: Promise<{
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    source?: string;
    ref?: string;
  }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = (await searchParams) ?? {};
  const hasEligibilityContext = Boolean(params.addressLine1 || params.postalCode);
  const hasReferral = Boolean(params.ref);

  return (
    <AuthShell
      eyebrow="Create Account"
      title="Start a cleaner monthly donation habit."
      description="Set up your DonateCrate account, confirm your service address, and move straight into billing and pickup onboarding."
      panelTitle="Why signup is structured this way"
      panelBody="The account setup captures the information operations actually need to route a pickup cleanly and notify you at the right moments."
      panelPoints={[
        "Your address flows into zone eligibility and future route planning.",
        "Billing happens after account creation so you can recover onboarding safely.",
        "Phone and profile details power reminders and smoother pickup completion.",
      ]}
    >
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">Create Account</p>
      <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Start monthly donation pickup</h2>
      <p className="mt-3 text-base leading-7 text-[var(--dc-gray-700)]">
        Join in minutes. We verify the address during signup so active homes can continue straight into billing, while homes outside the route can join the waitlist instead.
      </p>
      {hasReferral ? (
        <div className="mt-5 rounded-[1.5rem] border border-black/10 bg-black/[0.03] p-4">
          <p className="text-sm font-semibold text-black">Referral offer applied</p>
          <p className="mt-1 text-sm text-[var(--dc-gray-700)]">
            If this address is active and you complete signup, the referral credit will be attached automatically.
          </p>
        </div>
      ) : null}
      {hasEligibilityContext ? (
        <div className="mt-5 rounded-[1.5rem] border border-[var(--dc-orange)]/20 bg-[var(--dc-orange)]/8 p-4">
          <p className="text-sm font-semibold text-[var(--dc-orange)]">Address confirmed for launch signup</p>
          <p className="mt-1 text-sm text-[var(--dc-gray-700)]">
            {params.addressLine1 ? `${params.addressLine1}, ` : ""}
            {[params.city, params.state, params.postalCode].filter(Boolean).join(", ")}
          </p>
          <p className="mt-2 text-sm text-[var(--dc-gray-700)]">
            Create the account first. Billing happens after sign-in, and your address is already carried forward below.
          </p>
        </div>
      ) : (
        <div className="mt-5 rounded-[1.5rem] border border-black/10 bg-black/[0.03] p-4">
          <p className="text-sm font-semibold text-black">Address check happens during signup</p>
          <p className="mt-1 text-sm text-[var(--dc-gray-700)]">
            Enter the service address below. If the address is active, signup continues normally. If not, we will offer the waitlist instead of creating the wrong account flow.
          </p>
        </div>
      )}
      <div className="mt-6">
        <SignupForm />
      </div>
    </AuthShell>
  );
}
