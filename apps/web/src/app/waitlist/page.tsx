import { Suspense } from "react";
import { WaitlistForm } from "./waitlist-form";

export default function WaitlistPage() {
  return (
    <div className="min-h-screen bg-[var(--dc-gray-100)] px-6 py-12">
      <main className="mx-auto w-full max-w-3xl rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--dc-orange)]">Pending Zone</p>
        <h1 className="mt-2 text-4xl font-bold">Be First in Line When Your Zone Opens</h1>
        <p className="mt-3 text-[var(--dc-gray-700)]">
          We expand zone-by-zone to keep routes tight and reliable. Join the waitlist now, and we will notify
          you as soon as monthly pickup becomes available at your address.
        </p>
        <div className="mt-6">
          <Suspense fallback={<p className="text-sm text-[var(--dc-gray-700)]">Loading form...</p>}>
            <WaitlistForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
