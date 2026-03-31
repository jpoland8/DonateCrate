import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getDefaultHomePath, hasOperationsConsoleAccess } from "@/lib/access";
import { PartnerShell } from "@/components/portal/partner-shell";
import { getCurrentPartnerRole } from "@/lib/partner-access";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login?next=/partner");
  }
  const supabase = await createClient();
  const { partnerRole } = await getCurrentPartnerRole({
    supabase,
    userId: profile.id,
  });
  if (!partnerRole) {
    redirect(getDefaultHomePath(profile.role));
  }

  const portalLinks = hasOperationsConsoleAccess(profile.role)
    ? [{ label: "Admin Portal", href: "/admin" }]
    : [];

  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--dc-gray-100)]" />}>
      <PartnerShell portalLinks={portalLinks}>{children}</PartnerShell>
    </Suspense>
  );
}
