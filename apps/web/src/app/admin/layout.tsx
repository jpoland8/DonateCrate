import { Suspense } from "react";
import { AdminShell } from "@/components/portal/admin-shell";
import { getCurrentPartnerRole } from "@/lib/partner-access";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let portalLinks: { label: string; href: string }[] = [];
  const profile = await getCurrentProfile();
  if (profile) {
    const supabase = await createClient();
    const { partnerRole } = await getCurrentPartnerRole({ supabase, userId: profile.id });
    if (partnerRole) {
      portalLinks = [{ label: "Partner Portal", href: "/partner" }];
    }
  }
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--dc-black)]" />}>
      <AdminShell portalLinks={portalLinks}>{children}</AdminShell>
    </Suspense>
  );
}
