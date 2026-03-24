import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "./reset-password-form";

type ResetPasswordPageProps = {
  searchParams?: Promise<{ token_hash?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = (await searchParams) ?? {};
  return (
    <AuthShell
      eyebrow="Password Recovery"
      title="Choose a new password and get back into your account."
      description="Use a new password you will remember easily. Once it is saved, DonateCrate will send you back into the app."
      panelTitle="Reset links are time-sensitive"
      panelBody="Open the link from your email on the same device when possible. If the link expires, request another one from the login page."
      panelPoints={[
        "Your old password stops working as soon as the new one is saved.",
        "A reset link is only meant for account recovery, not account creation.",
        "If you still cannot sign in, request another link from the login screen.",
      ]}
    >
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">Reset Password</p>
      <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Create a new password</h2>
      <p className="mt-3 text-base leading-7 text-[var(--dc-gray-700)]">
        Enter your new password below. When it saves successfully, we will take you back to the app automatically.
      </p>
      <div className="mt-6">
        <ResetPasswordForm tokenHash={params.token_hash ?? null} />
      </div>
    </AuthShell>
  );
}
