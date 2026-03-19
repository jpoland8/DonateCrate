import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "./signup-form";

type SignupPageProps = {
  searchParams?: Promise<{
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    source?: string;
  }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = (await searchParams) ?? {};
  const hasEligibilityContext = Boolean(params.addressLine1 || params.postalCode);

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
        Join in minutes. We use your details to confirm service, set your pickup profile, and keep each cycle easy to manage.
      </p>
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
      ) : null}
      <div className="mt-6">
        <SignupForm />
      </div>
    </AuthShell>
  );
}
