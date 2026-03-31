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
      <Suspense fallback={<p className="text-sm text-[var(--dc-gray-600)]">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
