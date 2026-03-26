import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "./sign-in-form";

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Member Login"
      title="Welcome back to your monthly pickup routine."
      description="Manage pickup status, billing, reminders, and referrals from the same account you used during signup."
      panelTitle="Your account stays action-oriented"
      panelBody="The portal is built around the monthly cycle, so you can see what is due this cycle, what is already confirmed, and what still needs attention."
      panelPoints={[
        "See your current pickup cycle and readiness status.",
        "Manage billing and reminder preferences without contacting support.",
        "Keep profile details current so route planning stays clean.",
      ]}
    >
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">Sign In</p>
      <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Access your DonateCrate account</h2>
      <p className="mt-3 text-base leading-7 text-[var(--dc-gray-700)]">
        Use your password or request a magic link. Team accounts are directed to the appropriate workspace automatically.
      </p>
      <div className="mt-6">
        <Suspense fallback={<p className="text-sm text-[var(--dc-gray-700)]">Loading form...</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </AuthShell>
  );
}
