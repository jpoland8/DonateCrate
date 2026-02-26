import { Suspense } from "react";
import { CustomerShell } from "@/components/portal/customer-shell";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="min-h-screen bg-[var(--dc-gray-100)]" />}>
    <CustomerShell>{children}</CustomerShell>
  </Suspense>;
}
