import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getDefaultHomePath, hasOperationsConsoleAccess } from "@/lib/access";
import { CustomerShell } from "@/components/portal/customer-shell";
import { getCurrentPartnerRole } from "@/lib/partner-access";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (profile) {
    const supabase = await createClient();
    const { partnerRole } = await getCurrentPartnerRole({
      supabase,
      userId: profile.id,
    });
    if (hasOperationsConsoleAccess(profile.role) || partnerRole) {
      redirect(getDefaultHomePath(profile.role, { hasActivePartnerMembership: Boolean(partnerRole) }));
    }
  }

  return <Suspense fallback={<div className="min-h-screen bg-[var(--dc-gray-100)]" />}>
    <CustomerShell>{children}</CustomerShell>
  </Suspense>;
}
