import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { KpiPanel } from "./kpi-panel";
import { AdminWorkspace } from "./admin-workspace";

type AdminPageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = (await searchParams) ?? {};
  const activeTab = ["overview", "pickups", "logistics", "people", "zones", "growth"].includes(params.tab || "")
    ? (params.tab as "overview" | "pickups" | "logistics" | "people" | "zones" | "growth")
    : "overview";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "driver")) {
    redirect("/app");
  }

  if (profile.role === "driver") {
    const [{ data: driver }, { data: nextRoute }, { count: routeCount }] = await Promise.all([
      supabase.from("drivers").select("id,employee_id,active").eq("user_id", profile.id).maybeSingle(),
      supabase
        .from("routes")
        .select("id,status,pickup_cycles(pickup_date)")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("routes").select("id", { count: "exact", head: true }),
    ]);
    const nextPickupDate = Array.isArray(nextRoute?.pickup_cycles)
      ? (nextRoute.pickup_cycles[0] as { pickup_date?: string } | undefined)?.pickup_date
      : undefined;

    return (
      <main className="mx-auto w-full max-w-5xl space-y-6 text-white">
        <header>
          <p className="text-sm font-medium text-white/70">Driver Console</p>
          <h1 className="text-4xl font-bold">DonateCrate Driver Operations</h1>
          <p className="mt-1 text-sm text-white/70">{profile.email}</p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-white/15 bg-white/5 p-5">
            <p className="text-sm text-white/70">Employee ID</p>
            <p className="mt-2 text-2xl font-bold">{driver?.employee_id ?? "Unassigned"}</p>
          </article>
          <article className="rounded-2xl border border-white/15 bg-white/5 p-5">
            <p className="text-sm text-white/70">Driver Status</p>
            <p className="mt-2 text-2xl font-bold">{driver?.active ? "Active" : "Inactive"}</p>
          </article>
          <article className="rounded-2xl border border-white/15 bg-white/5 p-5">
            <p className="text-sm text-white/70">Routes in System</p>
            <p className="mt-2 text-2xl font-bold">{routeCount ?? 0}</p>
          </article>
        </section>

        <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
          <h2 className="text-xl font-bold">Next Route</h2>
          <p className="mt-2 text-sm text-white/80">
            {nextRoute
              ? `Status: ${nextRoute.status} | Pickup Date: ${nextPickupDate ?? "TBD"}`
              : "No route assigned yet. Check back after dispatch planning."}
          </p>
        </section>
      </main>
    );
  }

  const [{ data: zone }, { count: subscribers }, { count: drivers }, { count: routes }] = await Promise.all([
    supabase
      .from("service_zones")
      .select("anchor_postal_code,radius_miles")
      .eq("code", "knoxville-37922")
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .in("status", ["active", "trialing"]),
    supabase.from("drivers").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("routes").select("id", { count: "exact", head: true }),
  ]);

  const adminTiles = [
    {
      title: "Active Zone",
      value: `${zone?.anchor_postal_code ?? "37922"} | ${zone?.radius_miles ?? 3} mi radius`,
    },
    { title: "Subscribers", value: String(subscribers ?? 0) },
    { title: "Drivers", value: `${drivers ?? 0} employees assigned` },
    { title: "Routes (Total)", value: String(routes ?? 0) },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 text-white">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">Operations Console</p>
        <h1 className="text-4xl font-bold">DonateCrate Admin</h1>
        <p className="mt-1 text-sm text-white/70">{profile.email}</p>
      </header>

      <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
        <h2 className="text-xl font-bold">How Admin Portal Works</h2>
        <p className="mt-2 text-sm text-white/80">
          Manage the full Knoxville launch operation in one workspace: create pickup cycles, triage request statuses,
          assign drivers, and monitor subscription health so routes stay dense and profitable.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {adminTiles.map((tile) => (
          <article key={tile.title} className="rounded-2xl border border-white/15 bg-white/5 p-5">
            <p className="text-sm text-white/70">{tile.title}</p>
            <p className="mt-2 text-2xl font-bold">{tile.value}</p>
          </article>
        ))}
      </section>

      {activeTab === "overview" ? <KpiPanel /> : null}
      <AdminWorkspace section={activeTab} />
    </main>
  );
}
