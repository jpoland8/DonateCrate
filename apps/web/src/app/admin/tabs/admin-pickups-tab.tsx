"use client";

import { useMemo, useState } from "react";
import type { AdminData, AdminPickupCycle } from "../admin-types";
import { formatDate, localDateISO } from "../admin-utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type AdminPickupsTabProps = {
  data: AdminData;
  /** Callback fired after a mutation so the parent can reload data. */
  onMessage: (message: string) => void;
  /** Reload all admin data after a write. */
  loadAll: () => Promise<void>;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdminPickupsTab({ data, onMessage, loadAll }: AdminPickupsTabProps) {
  // --- local state ---
  const [pickupMode, setPickupMode] = useState<"single" | "recurring">("single");
  const [applyToAllActiveZones, setApplyToAllActiveZones] = useState(false);
  const [timelineZoneFilter, setTimelineZoneFilter] = useState("all");
  const [scheduleForm, setScheduleForm] = useState(() => {
    const now = new Date();
    return {
      zoneCode: data.zones[0]?.code ?? "",
      pickupDate: localDateISO(now),
      startPickupDate: localDateISO(now),
      horizonMode: "months" as "months" | "forever",
      months: 6,
      weekendPolicy: "next_business_day" as "none" | "next_business_day",
      pickupWindowLabel: "",
    };
  });

  // --- derived data ---
  const timelineRows = useMemo(() => {
    return data.pickupCycles.filter((cycle) => {
      const zoneMeta = Array.isArray(cycle.service_zones) ? cycle.service_zones[0] : cycle.service_zones;
      if (timelineZoneFilter === "all") return true;
      return zoneMeta?.code === timelineZoneFilter;
    });
  }, [data, timelineZoneFilter]);

  const timelineByMonth = useMemo(() => {
    const groups = new Map<string, AdminPickupCycle[]>();
    for (const cycle of timelineRows) {
      const monthKey = cycle.pickup_date.slice(0, 7);
      const existing = groups.get(monthKey) ?? [];
      existing.push(cycle);
      groups.set(monthKey, existing);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, cycles]) => ({ month, cycles }));
  }, [timelineRows]);

  // --- handlers ---
  async function createPickupCycle() {
    const cycleMonth = scheduleForm.pickupDate.slice(0, 7) + "-01";
    const payload =
      pickupMode === "single"
        ? {
            mode: "single",
            zoneCode: scheduleForm.zoneCode,
            applyToAllActiveZones,
            cycleMonth,
            pickupDate: scheduleForm.pickupDate,
            pickupWindowLabel: scheduleForm.pickupWindowLabel || undefined,
          }
        : {
            mode: "recurring",
            zoneCode: scheduleForm.zoneCode,
            applyToAllActiveZones,
            startPickupDate: scheduleForm.startPickupDate,
            horizonMode: scheduleForm.horizonMode,
            months: Number(scheduleForm.months),
            weekendPolicy: scheduleForm.weekendPolicy,
            pickupWindowLabel: scheduleForm.pickupWindowLabel || undefined,
          };

    const response = await fetch("/api/admin/pickup-cycles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await response.json();
    if (!response.ok) return onMessage(json.error || "Could not create pickup cycle(s)");
    onMessage(
      pickupMode === "single"
        ? `Pickup cycle saved (${json.appliedZoneCount ?? 1} zone${(json.appliedZoneCount ?? 1) > 1 ? "s" : ""}).`
        : `Recurring schedule created (${json.createdCount ?? 0} cycles across ${json.appliedZoneCount ?? 1} zone${(json.appliedZoneCount ?? 1) > 1 ? "s" : ""}, horizon ${json.horizonMonthsApplied ?? scheduleForm.months} months).`,
    );
    await loadAll();
  }

  async function updatePickupStatus(requestId: string, status: string) {
    const response = await fetch("/api/admin/pickup-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, status }),
    });
    const json = await response.json();
    if (!response.ok) return onMessage(json.error || "Could not update pickup request");
    onMessage("Pickup request updated.");
    await loadAll();
  }

  // --- render ---
  return (
    <>
      <section className="rounded-3xl border border-admin bg-admin-surface p-6">
        <h3 className="text-xl font-bold">Pickup Calendar Builder</h3>
        <p className="mt-1 text-sm text-admin-muted">
          A pickup cycle is the actual service day for one zone. Build one cycle at a time, or generate the monthly calendar in advance.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPickupMode("single")}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${pickupMode === "single" ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/20" : "border-admin-strong"}`}
          >
            One-time cycle
          </button>
          <button
            type="button"
            onClick={() => setPickupMode("recurring")}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${pickupMode === "recurring" ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/20" : "border-admin-strong"}`}
          >
            Recurring monthly
          </button>
        </div>

        {/* Zone selector */}
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr]">
          <label className="text-xs text-admin-muted">
            Zone
            <select
              value={scheduleForm.zoneCode}
              onChange={(event) => setScheduleForm((prev) => ({ ...prev, zoneCode: event.target.value }))}
              className="dc-input-admin mt-1 w-full"
            >
              {data.zones.map((zone) => (
                <option key={zone.id} value={zone.code}>{zone.name}</option>
              ))}
            </select>
          </label>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 self-end rounded-lg border border-admin-strong bg-admin-panel px-3 text-xs text-admin-muted">
            <input
              type="checkbox"
              checked={applyToAllActiveZones}
              onChange={(event) => setApplyToAllActiveZones(event.target.checked)}
            />
            All active zones
          </label>
          <p className="self-end pb-2 text-xs text-admin-soft">
            {applyToAllActiveZones
              ? "Every active zone will get a cycle."
              : "Selected zone only."}
          </p>
        </div>

        {/* Mode-specific fields */}
        {pickupMode === "single" ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-xs text-admin-muted">
              Pickup date
              <input
                type="date"
                value={scheduleForm.pickupDate}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, pickupDate: event.target.value }))}
                className="dc-input-admin mt-1 w-full"
              />
              <span className="mt-1 block text-[11px] text-admin-soft">
                Cycle month is derived automatically ({scheduleForm.pickupDate ? new Date(scheduleForm.pickupDate + "T12:00:00").toLocaleString("en-US", { month: "long", year: "numeric" }) : "—"}).
              </span>
            </label>
            <label className="text-xs text-admin-muted">
              Pickup window <span className="text-admin-soft">(optional)</span>
              <input
                type="text"
                value={scheduleForm.pickupWindowLabel}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, pickupWindowLabel: event.target.value }))}
                placeholder="e.g. 9am – 1pm"
                className="dc-input-admin mt-1 w-full"
              />
              <span className="mt-1 block text-[11px] text-admin-soft">
                Shown to customers in their portal, emails, and SMS reminders.
              </span>
            </label>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-xs text-admin-muted">Scheduling horizon</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleForm((prev) => ({ ...prev, horizonMode: "months" }))}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${scheduleForm.horizonMode === "months" ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/20 text-admin" : "border-admin-strong text-admin-muted"}`}
                >
                  Fixed window
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleForm((prev) => ({ ...prev, horizonMode: "forever" }))}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${scheduleForm.horizonMode === "forever" ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/20 text-admin" : "border-admin-strong text-admin-muted"}`}
                >
                  Rolling (60 months)
                </button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-xs text-admin-muted">
                First pickup date
                <input
                  type="date"
                  value={scheduleForm.startPickupDate}
                  onChange={(event) => setScheduleForm((prev) => ({ ...prev, startPickupDate: event.target.value }))}
                  className="dc-input-admin mt-1 w-full"
                />
                <span className="mt-1 block text-[11px] text-admin-soft">Day-of-month repeats each cycle.</span>
              </label>
              {scheduleForm.horizonMode === "months" ? (
                <label className="text-xs text-admin-muted">
                  Months ahead
                  <input type="number" min={1} max={60} value={scheduleForm.months} onChange={(event) => setScheduleForm((prev) => ({ ...prev, months: Number(event.target.value) }))} className="dc-input-admin mt-1 w-full" />
                </label>
              ) : (
                <div className="rounded-lg border border-admin-strong bg-admin-panel p-3 text-xs text-admin-soft">
                  Generates 60 months ahead. Re-run anytime to extend or update.
                </div>
              )}
              <label className="text-xs text-admin-muted">
                Weekend behavior
                <select value={scheduleForm.weekendPolicy} onChange={(event) => setScheduleForm((prev) => ({ ...prev, weekendPolicy: event.target.value as "none" | "next_business_day" }))} className="dc-input-admin mt-1 w-full">
                  <option value="none">Keep exact date</option>
                  <option value="next_business_day">Move to next business day</option>
                </select>
              </label>
            </div>
            <label className="text-xs text-admin-muted">
              Pickup window <span className="text-admin-soft">(optional)</span>
              <input
                type="text"
                value={scheduleForm.pickupWindowLabel}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, pickupWindowLabel: event.target.value }))}
                placeholder="e.g. 9am – 1pm"
                className="dc-input-admin mt-1 w-full"
              />
              <span className="mt-1 block text-[11px] text-admin-soft">
                Applied to all generated cycles. Shown to customers in their portal, emails, and SMS reminders.
              </span>
            </label>
          </div>
        )}

        <button onClick={createPickupCycle} className="mt-4 rounded-xl bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold">
          {pickupMode === "single" ? "Save Pickup Cycle" : "Generate Recurring Cycles"}
        </button>

        <div className="mt-5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">Pickup Calendar Timeline</p>
            <select
              value={timelineZoneFilter}
              onChange={(event) => setTimelineZoneFilter(event.target.value)}
              className="h-9 rounded-lg border border-admin-strong bg-admin-surface-strong px-3 text-xs"
            >
              <option value="all">All zones</option>
              {data.zones.map((zone) => (
                <option key={zone.id} value={zone.code}>{zone.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-3">
            {timelineByMonth.map((group) => (
              <article key={group.month} className="rounded-2xl border border-admin bg-admin-panel p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-admin-muted">{group.month}</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {group.cycles.map((cycle) => {
                    const zoneMeta = Array.isArray(cycle.service_zones) ? cycle.service_zones[0] : cycle.service_zones;
                    return (
                      <div key={cycle.id} className="rounded-lg border border-admin bg-admin-panel p-3 text-xs">
                        <p className="font-semibold">{zoneMeta?.name || cycle.zone_id}</p>
                        <p className="mt-1 text-admin-muted">{formatDate(cycle.pickup_date)}{cycle.pickup_window_label ? ` · ${cycle.pickup_window_label}` : ""}</p>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
            {timelineByMonth.length === 0 ? <p className="text-xs text-admin-soft">No pickup cycles found for this filter.</p> : null}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-admin bg-admin-surface p-6">
        <h3 className="text-xl font-bold">Member Responses</h3>
        <p className="mt-1 text-sm text-admin-muted">
          Review the most recent household responses for published cycles and correct any exception state before dispatch is built.
        </p>
        <div className="mt-3 space-y-2">
            {data.pickupRequests.slice(0, 20).map((item) => (
            <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-admin bg-admin-panel p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm break-all">
                {(item.users?.full_name || item.users?.email) ?? "Unknown member"} ({item.pickup_cycles?.pickup_date})
              </p>
              <select
                value={item.status}
                onChange={(event) => updatePickupStatus(item.id, event.target.value)}
                className="h-9 w-full rounded-lg border border-admin-strong bg-admin-surface-strong px-2 text-xs sm:w-auto"
              >
                <option value="requested">requested</option>
                <option value="skipped">skipped</option>
                <option value="confirmed">confirmed</option>
                <option value="picked_up">picked_up</option>
                <option value="not_ready">not_ready</option>
                <option value="missed">missed</option>
              </select>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
