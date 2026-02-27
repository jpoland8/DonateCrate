import { Suspense } from "react";
import { LoginForm } from "./sign-in-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[var(--dc-gray-100)] px-4 py-8 sm:px-6 sm:py-10">
      <main className="mx-auto w-full max-w-xl rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-[var(--dc-gray-700)]">Sign In</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Welcome Back to DonateCrate</h1>
        <p className="mt-2 text-[var(--dc-gray-700)]">
          Manage pickup status, track referral rewards, and keep your monthly donation routine active.
        </p>
        <div className="mt-6">
          <Suspense fallback={<p className="text-sm text-[var(--dc-gray-700)]">Loading form...</p>}>
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
