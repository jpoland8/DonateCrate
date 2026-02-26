import { Suspense } from "react";
import { AdminShell } from "@/components/portal/admin-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="min-h-screen bg-[var(--dc-black)]" />}>
    <AdminShell>{children}</AdminShell>
  </Suspense>;
}
