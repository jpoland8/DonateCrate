import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[var(--dc-gray-100)] px-6 py-10">
      <main className="mx-auto w-full max-w-xl rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-[var(--dc-gray-700)]">Create Account</p>
        <h1 className="mt-2 text-4xl font-bold">Start Monthly Donation Pickup</h1>
        <p className="mt-2 text-[var(--dc-gray-700)]">
          Join in minutes. We will use your details to confirm service availability, set your pickup profile,
          and keep you updated each month.
        </p>
        <div className="mt-6">
          <SignupForm />
        </div>
      </main>
    </div>
  );
}
