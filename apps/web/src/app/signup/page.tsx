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
    <div className="min-h-screen bg-[var(--dc-gray-100)] px-4 py-8 sm:px-6 sm:py-10">
      <main className="mx-auto w-full max-w-xl rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-[var(--dc-gray-700)]">Create Account</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Start Monthly Donation Pickup</h1>
        <p className="mt-2 text-[var(--dc-gray-700)]">
          Join in minutes. We will use your details to confirm service availability, set your pickup profile,
          and keep you updated each month.
        </p>
        {hasEligibilityContext ? (
          <div className="mt-4 rounded-2xl border border-[var(--dc-orange)]/20 bg-[var(--dc-orange)]/8 p-4">
            <p className="text-sm font-semibold text-[var(--dc-orange)]">Address confirmed for launch signup</p>
            <p className="mt-1 text-sm text-[var(--dc-gray-700)]">
              {params.addressLine1 ? `${params.addressLine1}, ` : ""}
              {[params.city, params.state, params.postalCode].filter(Boolean).join(", ")}
            </p>
            <p className="mt-2 text-sm text-[var(--dc-gray-700)]">
              Create your account first. Billing happens after sign-in, and your address will be prefilled below.
            </p>
          </div>
        ) : null}
        <div className="mt-6">
          <SignupForm />
        </div>
      </main>
    </div>
  );
}
