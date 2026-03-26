import { redirect } from "next/navigation";
import { getDefaultHomePath, hasOperationsConsoleAccess, isDriverRole } from "@/lib/access";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { DriverStopActions } from "./driver-stop-actions";
import { KpiPanel } from "./kpi-panel";
import { AdminWorkspace } from "./admin-workspace";

type AdminPageProps = {
  searchParams?: Promise<{ tab?: string; sub?: string }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = (await searchParams) ?? {};
  const activeTab = ["overview", "pickups", "logistics", "people", "network", "billing", "growth", "communication"].includes(
    params.tab || "",
  )
    ? (params.tab as "overview" | "pickups" | "logistics" | "people" | "network" | "billing" | "growth" | "communication")
    : params.tab === "zones" || params.tab === "partners"
      ? "network"
      : "overview";
  const networkSubtab =
    params.sub === "partners" || params.tab === "partners"
      ? "partners"
      : "zones";
  const peopleSubtab = params.sub === "staff" ? "staff" : "customers";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const profile = await getCurrentProfile();
  if (!profile || !hasOperationsConsoleAccess(profile.role)) {
    redirect(getDefaultHomePath(profile?.role));
  }

  if (isDriverRole(profile.role)) {
    const { data: driver } = await supabase
      .from("drivers")
      .select("id,employee_id,active")
      .eq("user_id", profile.id)
      .maybeSingle();
    const { count: routeCount } = driver
      ? await supabase.from("routes").select("id", { count: "exact", head: true }).eq("driver_id", driver.id)
      : { count: 0 };
    const { data: nextRoute } = driver
      ? await supabase
          .from("routes")
          .select("id,status,pickup_cycles(pickup_date)")
          .eq("driver_id", driver.id)
          .in("status", ["assigned", "in_progress", "draft"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };
    const nextPickupDate = Array.isArray(nextRoute?.pickup_cycles)
      ? (nextRoute.pickup_cycles[0] as { pickup_date?: string } | undefined)?.pickup_date
      : undefined;
    const { data: routeStops } = nextRoute
      ? await supabase
          .from("pickup_stops")
          .select("id,stop_order,status,pickup_request_id")
          .eq("route_id", nextRoute.id)
          .order("stop_order", { ascending: true })
      : { data: [] as Array<{ id: string; stop_order: number; status: string; pickup_request_id: string }> };
    const requestIds = (routeStops ?? []).map((stop) => stop.pickup_request_id);
    const { data: requests } =
      requestIds.length > 0
        ? await supabase.from("pickup_requests").select("id,user_id,note").in("id", requestIds)
        : { data: [] as Array<{ id: string; user_id: string; note: string | null }> };
    const userIds = Array.from(new Set((requests ?? []).map((row) => row.user_id)));
    const [{ data: users }, { data: addresses }] = await Promise.all([
      userIds.length > 0
        ? supabase.from("users").select("id,email,full_name").in("id", userIds)
        : Promise.resolve({ data: [] as Array<{ id: string; email: string; full_name: string | null }> }),
      userIds.length > 0
        ? supabase
            .from("addresses")
            .select("user_id,address_line1,city,state,postal_code,created_at")
            .in("user_id", userIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({
            data: [] as Array<{
              user_id: string;
              address_line1: string;
              city: string;
              state: string;
              postal_code: string;
              created_at: string;
            }>,
          }),
    ]);
    const requestById = new Map((requests ?? []).map((request) => [request.id, request]));
    const userById = new Map((users ?? []).map((item) => [item.id, item]));
    const addressByUserId = new Map<
      string,
      { user_id: string; address_line1: string; city: string; state: string; postal_code: string; created_at: string }
    >();
    for (const address of addresses ?? []) {
      if (!addressByUserId.has(address.user_id)) addressByUserId.set(address.user_id, address);
    }
    const driverStops = (routeStops ?? []).map((stop) => {
      const pickupRequest = requestById.get(stop.pickup_request_id);
      const member = pickupRequest ? userById.get(pickupRequest.user_id) : null;
      const address = pickupRequest ? addressByUserId.get(pickupRequest.user_id) : null;
      return {
        id: stop.id,
        stopOrder: stop.stop_order,
        stopStatus: stop.status,
        memberName: member?.full_name || member?.email || "Unknown member",
        email: member?.email || "No email on file",
        addressLine: address
          ? `${address.address_line1}, ${address.city}, ${address.state} ${address.postal_code}`
          : "Address unavailable",
        requestNote: pickupRequest?.note ?? null,
      };
    });

    return (
      <main className="mx-auto w-full max-w-5xl space-y-6" style={{ color: "var(--admin-text)" }}>
        <header>
          <p className="text-sm font-medium" style={{ color: "var(--admin-muted)" }}>Driver Console</p>
          <h1 className="text-4xl font-bold">DonateCrate Driver Operations</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--admin-muted)" }}>{profile.email}</p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
            <p className="text-sm" style={{ color: "var(--admin-muted)" }}>Employee ID</p>
            <p className="mt-2 text-2xl font-bold">{driver?.employee_id ?? "Unassigned"}</p>
          </article>
          <article className="rounded-2xl border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
            <p className="text-sm" style={{ color: "var(--admin-muted)" }}>Driver Status</p>
            <p className="mt-2 text-2xl font-bold">{driver?.active ? "Active" : "Inactive"}</p>
          </article>
          <article className="rounded-2xl border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
            <p className="text-sm" style={{ color: "var(--admin-muted)" }}>Routes Assigned</p>
            <p className="mt-2 text-2xl font-bold">{routeCount ?? 0}</p>
          </article>
        </section>

        <section className="rounded-2xl border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
          <h2 className="text-xl font-bold">Next Route</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--admin-muted)" }}>
            {nextRoute
              ? `Status: ${nextRoute.status} | Pickup Date: ${nextPickupDate ?? "TBD"}`
              : "No route assigned yet. Check back after dispatch planning."}
          </p>
        </section>
        {nextRoute ? (
          <DriverStopActions routeId={nextRoute.id} initialRouteStatus={nextRoute.status} stops={driverStops} />
        ) : null}
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
      .in("status", ["active"]),
    supabase.from("drivers").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("routes").select("id", { count: "exact", head: true }),
  ]);

  const adminTiles = [
    {
      title: "Primary Launch Zone",
      value: `${zone?.anchor_postal_code ?? "37922"} | ${zone?.radius_miles ?? 3} mi radius`,
    },
    { title: "Active Members", value: String(subscribers ?? 0) },
    { title: "Drivers Ready", value: `${drivers ?? 0} employees assigned` },
    { title: "Routes Built", value: String(routes ?? 0) },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8" style={{ color: "var(--admin-text)" }}>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">Operations Console</p>
        <h1 className="text-4xl font-bold">DonateCrate Admin</h1>
        <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--admin-muted)" }}>
          Run pickup calendars, dispatch routes, customer communications, and subscription recovery from one operational workspace.
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--admin-muted)" }}>{profile.email}</p>
      </header>

      <section className="rounded-2xl border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
        <h2 className="text-xl font-bold">How To Use This Workspace</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--admin-muted)" }}>
          Overview shows what needs attention first. Pickup Calendar sets the service days, Dispatch turns that calendar into
          a real route and driver assignment, and Messages tracks reminder delivery plus failures that need follow-up.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {adminTiles.map((tile) => (
          <article key={tile.title} className="rounded-2xl border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
            <p className="text-sm" style={{ color: "var(--admin-muted)" }}>{tile.title}</p>
            <p className="mt-2 text-2xl font-bold">{tile.value}</p>
          </article>
        ))}
      </section>

      {activeTab === "overview" ? <KpiPanel /> : null}
      <AdminWorkspace section={activeTab} networkSubtab={networkSubtab} peopleSubtab={peopleSubtab} />
    </main>
  );
}
