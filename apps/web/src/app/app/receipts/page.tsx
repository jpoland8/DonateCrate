import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { ReceiptList } from "./receipt-list";

export default async function ReceiptsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/app/receipts");
  }

  const profile = await getCurrentProfile();
  if (!profile?.full_name || profile.full_name.trim().length < 2) {
    redirect("/app/onboarding");
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6">
      <header className="dc-card p-5 sm:p-6">
        <p className="dc-eyebrow">Donation Receipts</p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--dc-gray-900)]">Your receipt history</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--dc-gray-600)]">
          View receipts from completed pickups. Receipts are generated when your donation is picked up and processed by
          our nonprofit partner.
        </p>
      </header>

      <ReceiptList />

      <div className="text-center">
        <a
          href="/app"
          className="inline-block text-sm font-semibold text-[var(--dc-orange)] hover:underline"
        >
          Back to dashboard
        </a>
      </div>
    </main>
  );
}
