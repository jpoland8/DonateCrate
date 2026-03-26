import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canManagePartnerSchedule, getDefaultHomePath } from "@/lib/access";
import { getHighestPartnerRole } from "@/lib/partner-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/supabase/server";
import { PartnerBrandingEditor } from "./partner-branding-editor";
import { PartnerOperationsPanel } from "./partner-operations-panel";
import { PartnerTeamManager } from "./partner-team-manager";

type PartnerPageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

const validTabs = ["home", "pickups", "service-areas", "team", "organization"] as const;
type ActiveTab = (typeof validTabs)[number];

function getActiveTab(tab: string | undefined): ActiveTab {
  if (tab === "overview") return "home";
  if (tab === "zones") return "service-areas";
  if (tab === "members") return "team";
  if (tab === "branding") return "organization";
  return validTabs.includes((tab ?? "") as ActiveTab) ? ((tab ?? "") as ActiveTab) : "home";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not scheduled";
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function formatRecurringDay(day: number | null | undefined) {
  if (day === null || day === undefined) return "No repeating day set";
  const suffix = day % 10 === 1 && day % 100 !== 11 ? "st" : day % 10 === 2 && day % 100 !== 12 ? "nd" : day % 10 === 3 && day % 100 !== 13 ? "rd" : "th";
  return `Repeats on the ${day}${suffix} of each month`;
}

async function ensurePartnerCyclePickupRequests(params: {
  supabaseAdmin: SupabaseClient;
  zoneIds: string[];
  cycleIds: string[];
}) {
  const { supabaseAdmin, zoneIds, cycleIds } = params;
  if (zoneIds.length === 0 || cycleIds.length === 0) {
    return;
  }

  const [{ data: activeMembers, error: membersError }, { data: cycleRows, error: cyclesError }] = await Promise.all([
    supabaseAdmin
      .from("zone_memberships")
      .select("zone_id,user_id,status")
      .in("zone_id", zoneIds)
      .eq("status", "active"),
    supabaseAdmin
      .from("pickup_cycles")
      .select("id,zone_id")
      .in("id", cycleIds),
  ]);

  if (membersError || cyclesError || !activeMembers?.length || !cycleRows?.length) {
    return;
  }

  const memberUserIds = Array.from(new Set(activeMembers.map((member) => member.user_id)));
  const [{ data: existingRequests, error: existingError }, { data: subscriptions, error: subscriptionsError }] = await Promise.all([
    supabaseAdmin
      .from("pickup_requests")
      .select("user_id,pickup_cycle_id")
      .in("pickup_cycle_id", cycleIds),
    supabaseAdmin
      .from("subscriptions")
      .select("user_id,status")
      .in("user_id", memberUserIds)
      .in("status", ["active", "past_due", "paused"]),
  ]);

  if (existingError || subscriptionsError || !subscriptions?.length) {
    return;
  }

  const eligibleUserIds = new Set(subscriptions.map((row) => row.user_id));
  const existingKeys = new Set((existingRequests ?? []).map((row) => `${row.user_id}:${row.pickup_cycle_id}`));
  const userIdsByZone = new Map<string, string[]>();
  for (const member of activeMembers) {
    if (!eligibleUserIds.has(member.user_id)) continue;
    const current = userIdsByZone.get(member.zone_id) ?? [];
    current.push(member.user_id);
    userIdsByZone.set(member.zone_id, current);
  }

  const missingRequests = cycleRows.flatMap((cycle) =>
    (userIdsByZone.get(cycle.zone_id) ?? [])
      .filter((userId) => !existingKeys.has(`${userId}:${cycle.id}`))
      .map((userId) => ({
        user_id: userId,
        pickup_cycle_id: cycle.id,
        status: "requested",
        note: "Auto-created by partner pickup default policy",
        updated_at: new Date().toISOString(),
      })),
  );

  if (missingRequests.length === 0) {
    return;
  }

  await supabaseAdmin
    .from("pickup_requests")
    .upsert(missingRequests, { onConflict: "user_id,pickup_cycle_id", ignoreDuplicates: true });
}

export default async function PartnerPage({ searchParams }: PartnerPageProps) {
  const params = (await searchParams) ?? {};
  const activeTab = getActiveTab(params.tab);

  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login?next=/partner");
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const [{ data: memberships, error: membershipsError }, { data: driverProfile }] = await Promise.all([
    supabaseAdmin
      .from("partner_memberships")
      .select("id,partner_id,role,nonprofit_partners(id,name,code,support_email,support_phone,address_line1,city,state,postal_code,about_paragraph,receipt_mode,payout_model,active)")
      .eq("user_id", profile.id)
      .eq("active", true),
    supabaseAdmin
      .from("drivers")
      .select("id")
      .eq("user_id", profile.id)
      .eq("active", true)
      .maybeSingle(),
  ]);

  if (membershipsError) {
    return <main className="mx-auto max-w-5xl"><p className="text-sm text-red-700">Could not load partner access: {membershipsError.message}</p></main>;
  }

  const partnerLinks = memberships ?? [];
  const partnerRole = getHighestPartnerRole(partnerLinks.map((row) => row.role));
  if (partnerLinks.length === 0) {
    return (
      <main className="mx-auto max-w-5xl rounded-[2rem] border border-black/10 bg-white/85 p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">Partner Portal</p>
        <h1 className="mt-2 text-3xl font-bold">No active partner assignment</h1>
        <p className="mt-3 text-sm text-[var(--dc-gray-700)]">
          Your account does not have an active organization assignment yet. Ask a DonateCrate admin to attach your account to an organization.
        </p>
      </main>
    );
  }
  if (!partnerRole) {
    redirect(getDefaultHomePath(profile.role));
  }

  const partnerIds = partnerLinks.map((row) => row.partner_id);
  const [{ data: zones }, { data: brandingRows }, { data: teamRows }, { data: pickupCycles }, { data: routes }] = await Promise.all([
    supabaseAdmin
      .from("service_zones")
      .select("id,name,code,status,anchor_postal_code,center_address,radius_miles,operation_model,partner_id,partner_pickup_date_override_allowed,recurring_pickup_day,default_pickup_window_label,partner_notes")
      .in("partner_id", partnerIds)
      .order("name", { ascending: true }),
    supabaseAdmin
      .from("partner_branding")
      .select("partner_id,display_name,logo_url,primary_color,secondary_color,accent_color,website_url,receipt_footer")
      .in("partner_id", partnerIds),
    supabaseAdmin
      .from("partner_memberships")
      .select("id,partner_id,role,active,users!inner(id,email,full_name,phone)")
      .in("partner_id", partnerIds)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("pickup_cycles")
      .select("id,zone_id,pickup_date,request_cutoff_at,pickup_window_label,service_zones!inner(name,partner_id,partner_pickup_date_override_allowed)")
      .gte("pickup_date", new Date().toISOString().slice(0, 10))
      .in("service_zones.partner_id", partnerIds)
      .order("pickup_date", { ascending: true })
      .limit(24),
    supabaseAdmin
      .from("routes")
      .select("id,status,zone_id,pickup_cycle_id,partner_id,driver_id,fulfillment_mode,pickup_cycles(pickup_date,pickup_window_label),service_zones(name)")
      .eq("fulfillment_mode", "partner_team")
      .in("partner_id", partnerIds)
      .in("status", ["draft", "assigned", "in_progress", "completed"])
      .order("created_at", { ascending: false }),
  ]);

  const cycleIds = (pickupCycles ?? []).map((cycle) => cycle.id);
  const zoneIds = (zones ?? []).map((zone) => zone.id);
  const routeIds = (routes ?? []).map((route) => route.id);
  const teamUserIds = Array.from(
    new Set(
      (teamRows ?? []).flatMap((row) => {
        const user = Array.isArray(row.users) ? row.users[0] : row.users;
        return user?.id ? [user.id] : [];
      }),
    ),
  );
  const { data: driverRows } =
    teamUserIds.length > 0
      ? await supabaseAdmin.from("drivers").select("id,user_id,employee_id,active").in("user_id", teamUserIds).eq("active", true)
      : { data: [] as Array<{ id: string; user_id: string; employee_id: string; active: boolean }> };
  const driverByUserId = new Map((driverRows ?? []).map((row) => [row.user_id, row]));

  await ensurePartnerCyclePickupRequests({
    supabaseAdmin,
    zoneIds,
    cycleIds,
  });

  const [{ data: zoneMemberships }, { data: cycleRequests }, { data: routeStops }] = await Promise.all([
    zoneIds.length > 0
      ? supabaseAdmin
          .from("zone_memberships")
          .select("zone_id,user_id,status")
          .in("zone_id", zoneIds)
          .eq("status", "active")
      : Promise.resolve({ data: [] as Array<{ zone_id: string; user_id: string; status: string }> }),
    cycleIds.length > 0
      ? supabaseAdmin
          .from("pickup_requests")
          .select("id,user_id,pickup_cycle_id,status,note,updated_at")
          .in("pickup_cycle_id", cycleIds)
      : Promise.resolve({ data: [] as Array<{ id: string; user_id: string; pickup_cycle_id: string; status: string; note: string | null; updated_at: string }> }),
    routeIds.length > 0
      ? supabaseAdmin
          .from("pickup_stops")
          .select("id,route_id,stop_order,status,pickup_request_id")
          .in("route_id", routeIds)
          .order("stop_order", { ascending: true })
      : Promise.resolve({ data: [] as Array<{ id: string; route_id: string; stop_order: number; status: string; pickup_request_id: string }> }),
  ]);

  const customerIds = Array.from(
    new Set([
      ...(zoneMemberships ?? []).map((row) => row.user_id),
      ...(cycleRequests ?? []).map((request) => request.user_id),
    ]),
  );

  const [{ data: users }, { data: addresses }, { data: requests }] = await Promise.all([
    customerIds.length > 0
      ? supabaseAdmin.from("users").select("id,email,full_name,phone,role").in("id", customerIds)
      : Promise.resolve({ data: [] as Array<{ id: string; email: string; full_name: string | null; phone: string | null; role: string }> }),
    customerIds.length > 0
      ? supabaseAdmin
          .from("addresses")
          .select("user_id,address_line1,city,state,postal_code,created_at")
          .in("user_id", customerIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<{ user_id: string; address_line1: string; city: string; state: string; postal_code: string; created_at: string }> }),
    customerIds.length > 0
      ? supabaseAdmin
          .from("pickup_requests")
          .select("user_id,status,updated_at,pickup_cycles(pickup_date)")
          .in("user_id", customerIds)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<{ user_id: string; status: string; updated_at: string; pickup_cycles?: { pickup_date?: string | null } | Array<{ pickup_date?: string | null }> | null }> }),
  ]);

  const addressByUserId = new Map<string, { address_line1: string; city: string; state: string; postal_code: string }>();
  for (const address of addresses ?? []) {
    if (!addressByUserId.has(address.user_id)) {
      addressByUserId.set(address.user_id, {
        address_line1: address.address_line1,
        city: address.city,
        state: address.state,
        postal_code: address.postal_code,
      });
    }
  }

  const latestRequestByUserId = new Map<string, { status: string; updated_at: string; pickup_date: string | null }>();
  for (const request of requests ?? []) {
    if (latestRequestByUserId.has(request.user_id)) continue;
    const cycleRaw = Array.isArray(request.pickup_cycles) ? request.pickup_cycles[0] : request.pickup_cycles;
    latestRequestByUserId.set(request.user_id, {
      status: request.status,
      updated_at: request.updated_at,
      pickup_date: cycleRaw?.pickup_date ?? null,
    });
  }

  const membershipZoneMap = new Map<string, string[]>();
  for (const row of zoneMemberships ?? []) {
    const current = membershipZoneMap.get(row.user_id) ?? [];
    current.push(row.zone_id);
    membershipZoneMap.set(row.user_id, current);
  }

  const brandingByPartnerId = new Map((brandingRows ?? []).map((row) => [row.partner_id, row]));
  const teamByPartnerId = new Map<
    string,
    Array<{
      id: string;
      user_id: string;
      full_name: string | null;
      email: string;
      phone: string | null;
      role: "partner_admin" | "partner_coordinator" | "partner_driver";
      active: boolean;
      editable: boolean;
      driver_id: string | null;
      driver_label: string | null;
    }>
  >();
  for (const row of teamRows ?? []) {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    const current = teamByPartnerId.get(row.partner_id) ?? [];
    current.push({
      id: row.id,
      user_id: user?.id ?? "",
      full_name: user?.full_name ?? null,
      email: user?.email ?? "",
      phone: user?.phone ?? null,
      role: row.role,
      active: row.active,
      editable: true,
      driver_id: driverByUserId.get(user?.id ?? "")?.id ?? null,
      driver_label: driverByUserId.get(user?.id ?? "")?.employee_id ?? null,
    });
    teamByPartnerId.set(row.partner_id, current);
  }

  for (const membership of partnerLinks) {
    const current = teamByPartnerId.get(membership.partner_id) ?? [];
    const alreadyIncluded = current.some((member) => member.user_id === profile.id);
    if (alreadyIncluded) continue;

    current.push({
      id: membership.id,
      user_id: profile.id,
      full_name: profile.full_name ?? null,
      email: profile.email ?? "",
      phone: profile.phone ?? null,
      role: membership.role,
      active: true,
      editable: true,
      driver_id: driverByUserId.get(profile.id)?.id ?? null,
      driver_label: driverByUserId.get(profile.id)?.employee_id ?? null,
    });
    teamByPartnerId.set(membership.partner_id, current);
  }

  const zoneNameById = new Map((zones ?? []).map((zone) => [zone.id, zone.name]));
  const nextCycleByZoneId = new Map<string, { pickupDate: string; pickupWindowLabel: string | null; requestCutoffAt: string }>();
  for (const cycle of pickupCycles ?? []) {
    if (!nextCycleByZoneId.has(cycle.zone_id)) {
      nextCycleByZoneId.set(cycle.zone_id, {
        pickupDate: cycle.pickup_date,
        pickupWindowLabel: cycle.pickup_window_label ?? null,
        requestCutoffAt: cycle.request_cutoff_at,
      });
    }
  }

  const routeStopsByRequestId = new Map(
    (routeStops ?? []).map((stop) => [
      stop.pickup_request_id,
      { id: stop.id, routeId: stop.route_id, stopOrder: stop.stop_order, stopStatus: stop.status },
    ]),
  );

  const routeCards = (routes ?? []).map((route) => {
    const zoneMeta = Array.isArray(route.service_zones) ? route.service_zones[0] : route.service_zones;
    const cycleMeta = Array.isArray(route.pickup_cycles) ? route.pickup_cycles[0] : route.pickup_cycles;
    const stops = (routeStops ?? [])
      .filter((stop) => stop.route_id === route.id)
      .map((stop) => {
        const pickupRequest = (cycleRequests ?? []).find((request) => request.id === stop.pickup_request_id);
        const member = pickupRequest ? (users ?? []).find((user) => user.id === pickupRequest.user_id) : null;
        const address = pickupRequest ? addressByUserId.get(pickupRequest.user_id) : null;
        return {
          id: stop.id,
          pickupRequestId: stop.pickup_request_id,
          stopOrder: stop.stop_order,
          stopStatus: stop.status,
          memberName: member?.full_name || member?.email || "Unknown member",
          email: member?.email || "No email on file",
          addressLine: address
            ? `${address.address_line1}, ${address.city}, ${address.state} ${address.postal_code}`
            : "Address unavailable",
          requestStatus: pickupRequest?.status ?? null,
          requestNote: pickupRequest?.note ?? null,
        };
      });
    return {
      id: route.id,
      pickupCycleId: route.pickup_cycle_id,
      status: route.status,
      partnerId: route.partner_id ?? null,
      driverId: route.driver_id ?? null,
      zoneName: zoneMeta?.name || "Zone",
      pickupDate: cycleMeta?.pickup_date ?? null,
      pickupWindowLabel: cycleMeta?.pickup_window_label ?? null,
      stops,
    };
  });

  const cycleCards = (pickupCycles ?? []).map((cycle) => {
    const zoneMeta = Array.isArray(cycle.service_zones) ? cycle.service_zones[0] : cycle.service_zones;
    const zoneConfig = (zones ?? []).find((zone) => zone.id === cycle.zone_id);
    return {
      id: cycle.id,
      zoneId: cycle.zone_id,
      zoneName: zoneMeta?.name || "Zone",
      partnerId: zoneMeta?.partner_id ?? null,
      pickupDate: cycle.pickup_date,
      requestCutoffAt: cycle.request_cutoff_at,
      pickupWindowLabel: cycle.pickup_window_label ?? null,
      overrideAllowed: Boolean(zoneMeta?.partner_pickup_date_override_allowed),
      recurringPickupDay: zoneConfig?.recurring_pickup_day ?? null,
    };
  });

  const pickupZoneSummaries = (zones ?? []).map((zone) => ({
    id: zone.id,
    name: zone.name,
    code: zone.code,
    overrideAllowed: Boolean(zone.partner_pickup_date_override_allowed),
    recurringPickupDay: zone.recurring_pickup_day ?? null,
    defaultPickupWindowLabel: zone.default_pickup_window_label ?? null,
  }));

  const pickupLists = cycleCards.map((cycle) => {
    const households = (cycleRequests ?? [])
      .filter((request) => request.pickup_cycle_id === cycle.id)
      .map((request) => {
        const member = (users ?? []).find((user) => user.id === request.user_id);
        const address = addressByUserId.get(request.user_id);
        const stop = routeStopsByRequestId.get(request.id);
        return {
          pickupRequestId: request.id,
          stopId: stop?.id ?? null,
          stopOrder: stop?.stopOrder ?? null,
          memberName: member?.full_name || member?.email || "Unknown member",
          email: member?.email || "No email on file",
          addressLine: address
            ? `${address.address_line1}, ${address.city}, ${address.state} ${address.postal_code}`
            : "Address unavailable",
          status: stop?.stopStatus ?? request.status,
          requestNote: request.note ?? null,
        };
      })
      .sort((a, b) => {
        if (a.stopOrder !== null && b.stopOrder !== null) return a.stopOrder - b.stopOrder;
        if (a.stopOrder !== null) return -1;
        if (b.stopOrder !== null) return 1;
        return a.memberName.localeCompare(b.memberName);
      });

    return {
      cycleId: cycle.id,
      households,
    };
  });

  const visibleMembers = (users ?? [])
    .filter((user) => user.role === "customer")
    .map((user) => ({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      zones: (membershipZoneMap.get(user.id) ?? []).map((zoneId) => zoneNameById.get(zoneId) ?? zoneId),
      address: addressByUserId.get(user.id) ?? null,
      pickup: latestRequestByUserId.get(user.id) ?? null,
    }))
    .sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email));

  const partnerCards = partnerLinks.map((link) => {
    const partner = Array.isArray(link.nonprofit_partners) ? link.nonprofit_partners[0] : link.nonprofit_partners;
    return {
      id: partner?.id ?? link.partner_id,
      name: partner?.name ?? "Partner",
      code: partner?.code ?? "",
      support_email: partner?.support_email ?? null,
      support_phone: partner?.support_phone ?? null,
      address_line1: partner?.address_line1 ?? null,
      city: partner?.city ?? null,
      state: partner?.state ?? null,
      postal_code: partner?.postal_code ?? null,
      about_paragraph: partner?.about_paragraph ?? null,
      receipt_mode: partner?.receipt_mode ?? "partner_issued",
      payout_model: partner?.payout_model ?? "inventory_only",
      active: partner?.active ?? true,
      membership_role: link.role,
      zones: (zones ?? []).filter((zone) => zone.partner_id === link.partner_id),
      branding: brandingByPartnerId.get(link.partner_id) ?? null,
      team: (teamByPartnerId.get(link.partner_id) ?? []).sort((a, b) =>
        (a.full_name || a.email).localeCompare(b.full_name || b.email),
      ),
    };
  });

  const nextPickupDate = cycleCards[0]?.pickupDate ?? null;
  const nextPickupWindow = cycleCards[0]?.pickupWindowLabel ?? null;
  const activePickupList =
    pickupLists.find((pickup) =>
      pickup.households.some((household) => !["picked_up", "no_access", "not_ready", "rescheduled", "missed"].includes(household.status)),
    ) ?? pickupLists[0] ?? null;
  const openRouteStopCount = activePickupList
    ? activePickupList.households.filter(
        (household) => !["picked_up", "no_access", "not_ready", "rescheduled", "missed"].includes(household.status),
      ).length
    : 0;
  const activePickupCycle = activePickupList ? cycleCards.find((cycle) => cycle.id === activePickupList.cycleId) ?? null : null;
  const summary = {
    zones: (zones ?? []).length,
    members: visibleMembers.length,
    partnerStaff: (teamRows ?? []).filter((row) => row.active).length,
  };

  const primaryAction =
    openRouteStopCount > 0
      ? {
          title: "Finish the active pickup",
          description: `${openRouteStopCount} household${openRouteStopCount === 1 ? "" : "s"} still need to be marked${activePickupCycle ? ` for ${formatDate(activePickupCycle.pickupDate)}` : ""}.`,
          href: "/partner?tab=pickups",
          label: "Open Pickups",
        }
      : nextPickupDate
        ? {
            title: "Review the next scheduled pickup",
            description: `${formatDate(nextPickupDate)}${nextPickupWindow ? ` • ${nextPickupWindow}` : ""}`,
            href: "/partner?tab=pickups",
            label: "Review Schedule",
          }
        : {
            title: "Schedule the next pickup",
            description: "No upcoming pickups are on the calendar yet.",
            href: "/partner?tab=pickups",
            label: "Set Pickup Schedule",
          };

  const attentionItems = [
    {
      title: openRouteStopCount > 0 ? "Pickup actions are waiting" : "No pickup actions are waiting",
      description:
        openRouteStopCount > 0
          ? "Open Pickups, select the right day, and mark each household as Picked Up or Could Not Be Retrieved."
          : "Your team is clear on pickup-day actions right now.",
      href: "/partner?tab=pickups",
      label: openRouteStopCount > 0 ? "Work Pickups" : "View Pickups",
    },
    {
      title: nextPickupDate ? "The next pickup is already scheduled" : "The next pickup still needs to be scheduled",
      description: nextPickupDate
        ? `${formatDate(nextPickupDate)}${nextPickupWindow ? ` • ${nextPickupWindow}` : ""}`
        : "Choose a date or set a repeating schedule for each service area.",
      href: "/partner?tab=pickups",
      label: "Manage Schedule",
    },
    {
      title: "Review donor-facing organization settings",
      description: "Keep your nonprofit name, logo, colors, website, and receipt message current before supporters hear from you.",
      href: "/partner?tab=organization",
      label: "Open Organization Settings",
    },
  ];

  const topHeader =
    activeTab === "home" ? (
      <header className="overflow-hidden rounded-[2rem] border border-black/10 bg-white/90 shadow-sm">
        <div className="grid gap-6 bg-[linear-gradient(135deg,#16202d_0%,#24424c_55%,#ff6a00_160%)] px-6 py-6 text-white lg:grid-cols-[minmax(0,1.1fr)_360px]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Home</p>
            <h1 className="mt-2 text-3xl font-bold">Your team should always know the next move.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/80">
              This workspace is built around the real job: keep pickups on track, cover the right service areas, and give supporters a clean, trustworthy experience.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={primaryAction.href} className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[var(--dc-gray-900)] shadow-sm">
                {primaryAction.label}
              </Link>
              <Link href="/partner?tab=service-areas" className="rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white">
                Review Service Areas
              </Link>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">Do This Now</p>
            <h2 className="mt-2 text-2xl font-bold">{primaryAction.title}</h2>
            <p className="mt-2 text-sm text-white/80">{primaryAction.description}</p>
            <div className="mt-5 space-y-3 text-sm text-white/80">
              <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-white/60">Next pickup</p>
                <p className="mt-1 font-semibold text-white">{nextPickupDate ? formatDate(nextPickupDate) : "Not scheduled yet"}</p>
                <p className="mt-1 text-xs text-white/70">{nextPickupWindow || "Pickup window not set yet"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-white/60">Work waiting</p>
                <p className="mt-1 font-semibold text-white">{openRouteStopCount} household{openRouteStopCount === 1 ? "" : "s"} need action</p>
                <p className="mt-1 text-xs text-white/70">
                  {activePickupCycle ? `${formatDate(activePickupCycle.pickupDate)}${activePickupCycle.pickupWindowLabel ? ` • ${activePickupCycle.pickupWindowLabel}` : ""}` : "No active pickup day"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5 md:grid-cols-3">
          <div className="rounded-2xl border border-black/10 bg-[var(--dc-gray-100)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--dc-gray-700)]">Service areas</p>
            <p className="mt-2 text-3xl font-bold">{summary.zones}</p>
          </div>
          <div className="rounded-2xl border border-black/10 bg-[var(--dc-gray-100)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--dc-gray-700)]">Households visible</p>
            <p className="mt-2 text-3xl font-bold">{summary.members}</p>
          </div>
          <div className="rounded-2xl border border-black/10 bg-[var(--dc-gray-100)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--dc-gray-700)]">Team members</p>
            <p className="mt-2 text-3xl font-bold">{summary.partnerStaff}</p>
          </div>
        </div>
      </header>
    ) : null;

  const sectionIntro: Record<Exclude<ActiveTab, "home">, { eyebrow: string; title: string; description: string }> = {
    pickups: {
      eyebrow: "Pickups",
      title: "Pickup days and household actions",
      description: "Select a day, review the households on that pickup, and mark outcomes there. Scheduling changes also happen here.",
    },
    "service-areas": {
      eyebrow: "Service Areas",
      title: "Where your organization picks up",
      description: "Each area shows where pickups begin, how far the area extends, and what the next scheduled day looks like.",
    },
    team: {
      eyebrow: "Team",
      title: "Who can work pickups and manage settings",
      description: "Organization Admins have full access. Coordinators can schedule pickups and also work routes. Drivers can work routes and view donor pickup details.",
    },
    organization: {
      eyebrow: "Organization",
      title: "Branding and donor-facing organization details",
      description: "Keep your nonprofit profile and receipt branding clear, current, and easy for supporters to recognize.",
    },
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      {topHeader}

      {activeTab !== "home" ? (
        <section className="rounded-[1.65rem] border border-black/10 bg-white/90 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dc-orange)]">{sectionIntro[activeTab].eyebrow}</p>
          <h1 className="mt-2 text-2xl font-bold text-[var(--dc-gray-900)]">{sectionIntro[activeTab].title}</h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--dc-gray-700)]">{sectionIntro[activeTab].description}</p>
        </section>
      ) : null}

      {activeTab === "home" ? (
        <div className="space-y-6">
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className="rounded-[1.85rem] border border-black/10 bg-white/90 p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dc-orange)]">Attention Queue</p>
              <h2 className="mt-2 text-2xl font-bold text-[var(--dc-gray-900)]">What needs attention now</h2>
              <div className="mt-5 space-y-3">
                {attentionItems.map((item) => (
                  <article key={item.title} className="flex flex-col gap-4 rounded-[1.5rem] border border-black/10 bg-[var(--dc-gray-100)] p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-base font-semibold text-[var(--dc-gray-900)]">{item.title}</p>
                      <p className="mt-1 text-sm text-[var(--dc-gray-700)]">{item.description}</p>
                    </div>
                    <Link href={item.href} className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-[var(--dc-gray-900)]">
                      {item.label}
                    </Link>
                  </article>
                ))}
              </div>
            </div>

            <aside className="rounded-[1.85rem] border border-black/10 bg-white/90 p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dc-orange)]">Upcoming Pickups</p>
              <h2 className="mt-2 text-2xl font-bold text-[var(--dc-gray-900)]">The next few dates</h2>
              <div className="mt-5 space-y-3">
                {cycleCards.slice(0, 4).map((cycle) => (
                  <article key={cycle.id} className="rounded-[1.4rem] border border-black/10 bg-[var(--dc-gray-100)] p-4">
                    <p className="text-base font-semibold text-[var(--dc-gray-900)]">{cycle.zoneName}</p>
                    <p className="mt-1 text-sm text-[var(--dc-gray-800)]">{formatDate(cycle.pickupDate)}</p>
                    <p className="mt-1 text-xs text-[var(--dc-gray-700)]">{cycle.pickupWindowLabel || "Pickup window not set"}</p>
                    <p className="mt-2 text-xs text-[var(--dc-gray-700)]">Response deadline: {formatDateTime(cycle.requestCutoffAt)}</p>
                  </article>
                ))}
                {cycleCards.length === 0 ? (
                  <p className="rounded-[1.4rem] border border-dashed border-black/15 bg-[var(--dc-gray-100)] px-4 py-4 text-sm text-[var(--dc-gray-700)]">
                    No pickups are scheduled yet. Open Pickups to set the first one.
                  </p>
                ) : null}
              </div>
            </aside>
          </section>

        </div>
      ) : null}

      {activeTab === "pickups" ? (
        <PartnerOperationsPanel
          routes={routeCards}
          cycles={cycleCards}
          pickupLists={pickupLists}
          zones={pickupZoneSummaries}
          canManageSchedule={canManagePartnerSchedule(partnerRole)}
          currentUserRole={partnerRole}
          currentDriverId={driverProfile?.id ?? null}
          driverOptions={partnerCards.flatMap((partner) =>
            partner.team
              .filter(
                (member): member is typeof member & { driver_id: string; role: "partner_coordinator" | "partner_driver" } =>
                  member.active && Boolean(member.driver_id) && (member.role === "partner_coordinator" || member.role === "partner_driver"),
              )
              .map((member) => ({
                id: member.driver_id,
                userId: member.user_id,
                partnerId: partner.id,
                name: member.full_name || member.email,
                email: member.email,
                driverLabel: member.driver_label || "Partner driver",
                role: member.role,
              })),
          )}
        />
      ) : null}

      {activeTab === "service-areas" ? (
        <section className="space-y-4">
          {(zones ?? []).map((zone) => {
            const nextCycle = nextCycleByZoneId.get(zone.id);
            const households = visibleMembers.filter((member) => member.zones.includes(zone.name)).length;
            return (
              <article key={zone.id} className="rounded-[1.85rem] border border-black/10 bg-white/90 p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dc-orange)]">{zone.code}</p>
                    <h2 className="mt-2 text-2xl font-bold text-[var(--dc-gray-900)]">{zone.name}</h2>
                    <p className="mt-2 text-sm text-[var(--dc-gray-700)]">{zone.status} • {zone.operation_model}</p>
                  </div>
                  <Link href="/partner?tab=pickups" className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-[var(--dc-gray-900)]">
                    Manage Pickup Days
                  </Link>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-black/10 bg-[var(--dc-gray-100)] p-4 text-sm text-[var(--dc-gray-700)]">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--dc-gray-700)]">Starting area</p>
                    <p className="mt-2 font-semibold text-[var(--dc-gray-900)]">{zone.center_address || `Near ZIP ${zone.anchor_postal_code}`}</p>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-[var(--dc-gray-100)] p-4 text-sm text-[var(--dc-gray-700)]">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--dc-gray-700)]">Coverage radius</p>
                    <p className="mt-2 font-semibold text-[var(--dc-gray-900)]">{zone.radius_miles} miles</p>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-[var(--dc-gray-100)] p-4 text-sm text-[var(--dc-gray-700)]">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--dc-gray-700)]">Next pickup</p>
                    <p className="mt-2 font-semibold text-[var(--dc-gray-900)]">{nextCycle ? formatDate(nextCycle.pickupDate) : "Not scheduled"}</p>
                    <p className="mt-1 text-xs">{nextCycle?.pickupWindowLabel || "Pickup window not set"}</p>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-[var(--dc-gray-100)] p-4 text-sm text-[var(--dc-gray-700)]">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--dc-gray-700)]">Repeating day</p>
                    <p className="mt-2 font-semibold text-[var(--dc-gray-900)]">{formatRecurringDay(zone.recurring_pickup_day)}</p>
                    <p className="mt-1 text-xs">{zone.default_pickup_window_label || "No default pickup window set"}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-[var(--dc-gray-700)]">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--dc-gray-700)]">Scheduling control</p>
                    <p className="mt-2 font-semibold text-[var(--dc-gray-900)]">
                      {zone.partner_pickup_date_override_allowed ? "Your team can schedule this area" : "DonateCrate schedules this area"}
                    </p>
                    <p className="mt-1">Pickup-day changes are made from the Pickups page after you open the exact day you want.</p>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-[var(--dc-gray-700)]">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--dc-gray-700)]">Households in this area</p>
                    <p className="mt-2 font-semibold text-[var(--dc-gray-900)]">{households}</p>
                    <p className="mt-1">People currently visible to your team for planning and pickup-day work.</p>
                  </div>
                </div>

                {zone.partner_notes ? (
                  <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    DonateCrate note: {zone.partner_notes}
                  </p>
                ) : null}
              </article>
            );
          })}
          {(zones ?? []).length === 0 ? (
            <article className="rounded-[1.75rem] border border-dashed border-black/15 bg-white/70 p-6 text-sm text-[var(--dc-gray-700)]">
              No service areas are assigned to this organization yet.
            </article>
          ) : null}
        </section>
      ) : null}

      {activeTab === "team" ? (
        <div className="space-y-6">
          <PartnerTeamManager
            partners={partnerCards.map((partner) => ({
              id: partner.id,
              name: partner.name,
              membershipRole: partner.membership_role,
              team: partner.team,
            }))}
          />

          <section className="space-y-3">
            <div className="rounded-[1.7rem] border border-black/10 bg-white/90 p-5 shadow-sm">
              <h2 className="text-xl font-bold text-[var(--dc-gray-900)]">Households your team can see</h2>
              <p className="mt-2 text-sm text-[var(--dc-gray-700)]">
                This list is operational only. It helps your team verify addresses, review pickup status, and resolve route questions.
              </p>
            </div>
            {visibleMembers.map((member) => (
              <article key={member.id} className="rounded-[1.6rem] border border-black/10 bg-white/90 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-[var(--dc-gray-900)]">{member.full_name || member.email}</p>
                    <p className="text-sm text-[var(--dc-gray-700)]">{member.email}</p>
                  </div>
                  <div className="text-right text-xs text-[var(--dc-gray-700)]">
                    <p>{member.phone || "No phone"}</p>
                    <p>{member.zones.join(" | ") || "No assigned area"}</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-black/10 bg-[var(--dc-gray-100)] p-4 text-sm text-[var(--dc-gray-700)]">
                    Address: {member.address ? `${member.address.address_line1}, ${member.address.city}, ${member.address.state} ${member.address.postal_code}` : "Not available"}
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-[var(--dc-gray-100)] p-4 text-sm text-[var(--dc-gray-700)]">
                    Latest pickup status: <span className="font-semibold text-[var(--dc-gray-900)]">{member.pickup?.status || "No response yet"}</span>
                    <p className="mt-1 text-xs">
                      {member.pickup?.pickup_date ? `Pickup date ${formatDate(member.pickup.pickup_date)}` : "No cycle tied to the latest status"}
                    </p>
                  </div>
                </div>
              </article>
            ))}
            {visibleMembers.length === 0 ? (
              <article className="rounded-[1.75rem] border border-dashed border-black/15 bg-white/70 p-6 text-sm text-[var(--dc-gray-700)]">
                No active households are attached to your service areas yet.
              </article>
            ) : null}
          </section>
        </div>
      ) : null}

      {activeTab === "organization" ? (
        <PartnerBrandingEditor
          partners={partnerCards.map((partner) => ({
            id: partner.id,
            name: partner.name,
            membershipRole: partner.membership_role,
            organization: {
              support_email: partner.support_email,
              support_phone: partner.support_phone,
              address_line1: partner.address_line1,
              city: partner.city,
              state: partner.state,
              postal_code: partner.postal_code,
              about_paragraph: partner.about_paragraph,
            },
            branding: partner.branding,
          }))}
        />
      ) : null}
    </main>
  );
}
