"use client";

import type { AdminData } from "../admin-types";

export type AdminGrowthTabProps = {
  data: AdminData;
};

export function AdminGrowthTab({ data }: AdminGrowthTabProps) {
  return (
    <section className="grid gap-6 xl:grid-cols-2">
      <article className="rounded-3xl border border-admin bg-admin-surface p-6">
        <h3 className="text-xl font-bold">Waitlist Pipeline</h3>
        <div className="mt-3 space-y-2">
          {data.waitlist.slice(0, 30).map((entry) => (
            <div key={entry.id} className="rounded-lg border border-admin bg-admin-panel p-3 text-sm">
              {entry.full_name} ({entry.postal_code}) - {entry.status}
            </div>
          ))}
        </div>
      </article>
      <article className="rounded-3xl border border-admin bg-admin-surface p-6">
        <h3 className="text-xl font-bold">Affiliate Referrals</h3>
        <div className="mt-3 space-y-2">
          {data.referrals.slice(0, 30).map((referral) => (
            <div key={referral.id} className="rounded-lg border border-admin bg-admin-panel p-3 text-sm">
              {referral.referrer_email ?? "Unknown"} {"->"} {referral.referred_email ?? "Pending user"} ({referral.referral_code}) - {referral.status}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
