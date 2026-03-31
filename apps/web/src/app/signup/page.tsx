import { Suspense } from "react";
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
        Join in minutes. Search for your address to check availability, then create your account and move straight into billing.
      </p>
      {hasReferral ? (
        <div className="mt-5 flex items-start gap-3 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-4">
          <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden>
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-emerald-900">You&apos;ve been referred!</p>
            <p className="mt-0.5 text-sm text-emerald-700">
              Complete signup and you&apos;ll both earn a $5 credit — that&apos;s a free month each.
            </p>
          </div>
        </div>
      ) : null}
      {hasEligibilityContext ? (
        <div className="mt-5 rounded-[1.5rem] border border-[var(--dc-orange)]/20 bg-[var(--dc-orange)]/8 p-4">
          <p className="text-sm font-semibold text-[var(--dc-orange)]">Address confirmed for signup</p>
          <p className="mt-1 text-sm text-[var(--dc-gray-700)]">
            {params.addressLine1 ? `${params.addressLine1}, ` : ""}
            {[params.city, params.state, params.postalCode].filter(Boolean).join(", ")}
          </p>
          <p className="mt-2 text-sm text-[var(--dc-gray-700)]">
            Your address is already filled in below. Create your account to continue.
          </p>
        </div>
      ) : null}
      <div className="mt-6">
        <Suspense fallback={<div className="h-12 animate-pulse rounded-2xl bg-black/5" />}>
          <SignupForm />
        </Suspense>
      </div>
    </AuthShell>
  );
}
