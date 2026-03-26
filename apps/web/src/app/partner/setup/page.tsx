import { AuthShell } from "@/components/auth/auth-shell";
import { PartnerSetupForm } from "./partner-setup-form";

type PartnerSetupPageProps = {
  searchParams?: Promise<{ token_hash?: string }>;
};

export default async function PartnerSetupPage({ searchParams }: PartnerSetupPageProps) {
  const params = (await searchParams) ?? {};

  return (
    <AuthShell
      eyebrow="Partner Setup"
      title="Set your password and finish your team account."
      description="New organization teammates need one short setup step before they can access the partner portal."
      panelTitle="What happens next"
      panelBody="Set your password, add the phone number your team should use for operational updates, and then sign in normally."
      panelPoints={[
        "Your work email becomes your DonateCrate sign-in.",
        "Your phone number is used for route-day updates and team coordination.",
        "After setup, sign in and you will land in the partner portal.",
      ]}
    >
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">Partner Team Account</p>
      <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Finish your first-time setup</h2>
      <p className="mt-3 text-base leading-7 text-[var(--dc-gray-700)]">
        Create your password and add your phone number so your organization can reach you for pickup-day work.
      </p>
      <div className="mt-6">
        <PartnerSetupForm tokenHash={params.token_hash ?? null} />
      </div>
    </AuthShell>
  );
}
