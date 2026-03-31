"use client";

import { isDemoOnlyZone } from "@/lib/zone-flags";
import type {
  NetworkSubtab,
  AdminData,
  AdminPartner,
  AdminZone,
  ZoneMember,
} from "../admin-types";
import {
  formatZoneStatusLabel,
  formatRoleLabel,
  formatPartnerTeamRole,
} from "../admin-utils";

// ---------------------------------------------------------------------------
// Place-autocomplete prediction shape
// ---------------------------------------------------------------------------
type PlacePrediction = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

type PlaceSelection = { placeId: string; formattedAddress: string };

// ---------------------------------------------------------------------------
// Partner settings draft (mirrors getPartnerSettingsDraft output)
// ---------------------------------------------------------------------------
type PartnerSettingsDraft = {
  partnerId: string;
  name: string;
  legalName: string;
  supportEmail: string;
  supportPhone: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  aboutParagraph: string;
  active: boolean;
  receiptMode: string;
  payoutModel: string;
  platformShareBps: number;
  partnerShareBps: number;
  notes: string;
  displayName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string;
  websiteUrl: string;
  receiptFooter: string;
};

// ---------------------------------------------------------------------------
// Zone create form shape
// ---------------------------------------------------------------------------
type ZoneFormState = {
  code: string;
  name: string;
  anchorPostalCode: string;
  radiusMiles: number;
  minActiveSubscribers: number;
  signupEnabled: boolean;
  demoOnly: boolean;
};

// ---------------------------------------------------------------------------
// Partner create form shape
// ---------------------------------------------------------------------------
type PartnerFormState = {
  code: string;
  name: string;
  legalName: string;
  supportEmail: string;
  supportPhone: string;
  receiptMode: "partner_issued" | "platform_on_behalf" | "manual";
  payoutModel: "inventory_only" | "revenue_share" | "hybrid";
  platformShareBps: number;
  partnerShareBps: number;
  notes: string;
  displayName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string;
  websiteUrl: string;
  receiptFooter: string;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface AdminNetworkTabProps {
  networkSubtab: NetworkSubtab;
  data: AdminData;

  // Zone selection
  selectedZoneId: string;
  setSelectedZoneId: (id: string) => void;
  selectedZoneCode: string;
  setSelectedZoneCode: (code: string) => void;
  selectedZone: AdminZone | null;
  showCreateZoneForm: boolean;
  setShowCreateZoneForm: (value: boolean | ((prev: boolean) => boolean)) => void;
  zoneSaving: boolean;

  // Zone form (create)
  zoneForm: ZoneFormState;
  setZoneForm: (value: ZoneFormState | ((prev: ZoneFormState) => ZoneFormState)) => void;

  // Zone members
  zoneMembers: ZoneMember[];
  zoneMemberSearch: string;
  setZoneMemberSearch: (value: string) => void;
  zoneMemberRole: "all" | "customer" | "admin" | "driver" | "partner_admin" | "partner_coordinator" | "partner_driver";
  setZoneMemberRole: (value: "all" | "customer" | "admin" | "driver" | "partner_admin" | "partner_coordinator" | "partner_driver") => void;
  zoneMemberPage: number;
  setZoneMemberPage: (value: number | ((prev: number) => number)) => void;
  zoneMemberPagination: { page: number; pageSize: number; total: number; totalPages: number };

  // Zone center edit
  editCenterQuery: string;
  setEditCenterQuery: (value: string) => void;
  editCenterPredictions: PlacePrediction[];
  setEditCenterPredictions: (value: PlacePrediction[]) => void;
  editCenterSelection: PlaceSelection | null;
  setEditCenterSelection: (value: PlaceSelection | null) => void;

  // Zone center create
  createCenterQuery: string;
  setCreateCenterQuery: (value: string) => void;
  createCenterPredictions: PlacePrediction[];
  setCreateCenterPredictions: (value: PlacePrediction[]) => void;
  createCenterSelection: PlaceSelection | null;
  setCreateCenterSelection: (value: PlaceSelection | null) => void;

  // Partner selection
  selectedPartnerId: string;
  setSelectedPartnerId: (id: string) => void;
  selectedPartner: AdminPartner | null;
  partnerOptions: AdminPartner[];
  showCreatePartnerForm: boolean;
  setShowCreatePartnerForm: (value: boolean | ((prev: boolean) => boolean)) => void;

  // Partner form (create)
  partnerForm: PartnerFormState;
  setPartnerForm: (value: PartnerFormState | ((prev: PartnerFormState) => PartnerFormState)) => void;

  // Partner form (edit selected)
  selectedPartnerForm: PartnerSettingsDraft | null;
  setSelectedPartnerForm: (value: PartnerSettingsDraft | null | ((prev: PartnerSettingsDraft | null) => PartnerSettingsDraft | null)) => void;

  // Partner member add
  partnerMemberEmail: string;
  setPartnerMemberEmail: (value: string) => void;
  partnerMemberRole: "partner_admin" | "partner_coordinator" | "partner_driver";
  setPartnerMemberRole: (value: "partner_admin" | "partner_coordinator" | "partner_driver") => void;

  // Schedule form (zone code sync)
  setScheduleForm: (value: (prev: { zoneCode: string; [key: string]: unknown }) => { zoneCode: string; [key: string]: unknown }) => void;

  // Handlers
  updateZone: (payload: {
    zoneId: string;
    radiusMiles?: number;
    status?: "pending" | "launching" | "active" | "paused";
    signupEnabled?: boolean;
    demoOnly?: boolean;
    minActiveSubscribers?: number;
    centerPlaceId?: string;
    operationModel?: "donatecrate_operated" | "partner_operated";
    partnerId?: string | null;
    partnerPickupDateOverrideAllowed?: boolean;
    recurringPickupDay?: number | null;
    defaultCutoffDaysBefore?: number;
    defaultPickupWindowLabel?: string;
    partnerNotes?: string;
  }) => Promise<void>;
  createZone: () => Promise<void>;
  updateZoneCenterAddress: () => Promise<void>;
  fetchPlaceDetails: (placeId: string) => Promise<{ placeId: string; formattedAddress: string }>;
  createPartner: () => Promise<void>;
  updatePartnerAccount: () => Promise<void>;
  addPartnerMember: () => Promise<void>;
  updatePartnerMember: (memberId: string, payload: { role?: "partner_admin" | "partner_coordinator" | "partner_driver"; active?: boolean }) => Promise<void>;
  deletePartnerMember: (memberId: string, memberLabel: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function AdminNetworkTab({
  networkSubtab,
  data,
  selectedZoneId,
  setSelectedZoneId,
  selectedZoneCode,
  setSelectedZoneCode,
  selectedZone,
  showCreateZoneForm,
  setShowCreateZoneForm,
  zoneSaving,
  zoneForm,
  setZoneForm,
  zoneMembers,
  zoneMemberSearch,
  setZoneMemberSearch,
  zoneMemberRole,
  setZoneMemberRole,
  zoneMemberPage,
  setZoneMemberPage,
  zoneMemberPagination,
  editCenterQuery,
  setEditCenterQuery,
  editCenterPredictions,
  setEditCenterPredictions,
  editCenterSelection,
  setEditCenterSelection,
  createCenterQuery,
  setCreateCenterQuery,
  createCenterPredictions,
  setCreateCenterPredictions,
  createCenterSelection,
  setCreateCenterSelection,
  selectedPartnerId,
  setSelectedPartnerId,
  selectedPartner,
  partnerOptions,
  showCreatePartnerForm,
  setShowCreatePartnerForm,
  partnerForm,
  setPartnerForm,
  selectedPartnerForm,
  setSelectedPartnerForm,
  partnerMemberEmail,
  setPartnerMemberEmail,
  partnerMemberRole,
  setPartnerMemberRole,
  setScheduleForm,
  updateZone,
  createZone,
  updateZoneCenterAddress,
  fetchPlaceDetails,
  createPartner,
  updatePartnerAccount,
  addPartnerMember,
  updatePartnerMember,
  deletePartnerMember,
}: AdminNetworkTabProps) {
  return (
    <section className="grid gap-4 xl:grid-cols-[300px_1fr]">
      <aside className="space-y-4">
        <div className="rounded-3xl border border-admin bg-admin-surface p-4">
          <p className="text-sm font-semibold">Network Workspace</p>
          <p className="mt-1 text-xs text-admin-soft">Separate service area operations from nonprofit account management.</p>
          <div className="mt-3 space-y-2">
            <a
              href="/admin?tab=network&sub=zones"
              className={`block rounded-xl border px-3 py-2 text-sm font-semibold ${
                networkSubtab === "zones"
                  ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/15"
                  : "border-admin-strong bg-admin-panel hover:bg-admin-surface-strong"
              }`}
            >
              Zones
            </a>
            <a
              href="/admin?tab=network&sub=partners"
              className={`block rounded-xl border px-3 py-2 text-sm font-semibold ${
                networkSubtab === "partners"
                  ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/15"
                  : "border-admin-strong bg-admin-panel hover:bg-admin-surface-strong"
              }`}
            >
              Partners
            </a>
          </div>
        </div>

        {networkSubtab === "zones" ? (
          <div className="rounded-3xl border border-admin bg-admin-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Service Areas</p>
                <p className="mt-1 text-xs text-admin-soft">Select a service area to review settings, coverage, and scheduling.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateZoneForm((prev: boolean) => !prev);
                  if (!showCreateZoneForm) setSelectedZoneId("");
                }}
                className="rounded-lg border border-[var(--dc-orange)] px-4 py-2 text-sm font-semibold text-[var(--dc-orange)]"
              >
                {showCreateZoneForm ? "Close New Service Area Form" : "Add New Service Area"}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {data.zones.map((zone) => (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => {
                    setSelectedZoneId(zone.id);
                    setSelectedZoneCode(zone.code);
                    setScheduleForm((prev) => ({ ...prev, zoneCode: zone.code }));
                    setZoneMemberPage(1);
                    setShowCreateZoneForm(false);
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                    selectedZoneId === zone.id
                      ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/15"
                      : "border-admin-strong bg-admin-panel hover:bg-admin-surface-strong"
                  }`}
                >
                  <p className="font-semibold">{zone.name}</p>
                  <p className="text-xs text-admin-soft">ZIP {zone.anchor_postal_code} | {formatZoneStatusLabel(zone.status)}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-admin bg-admin-surface p-4">
            <p className="text-sm font-semibold">Organizations</p>
            <p className="mt-1 text-xs text-admin-soft">Select an organization to manage branding, contact details, and team access.</p>
            <div className="mt-3 space-y-2">
              {partnerOptions.map((partner) => (
                <button
                  key={partner.id}
                  type="button"
                  onClick={() => setSelectedPartnerId(partner.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                    selectedPartnerId === partner.id
                      ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/15"
                      : "border-admin-strong bg-admin-panel hover:bg-admin-surface-strong"
                  }`}
                >
                  <p className="font-semibold">{partner.name}</p>
                  <p className="text-xs text-admin-soft">{partner.code} | {partner.active ? "Active" : "Inactive"}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      <div className="space-y-4">
        {(networkSubtab === "zones" && selectedZone) || networkSubtab === "partners" ? (
          <>
            {networkSubtab === "zones" ? (
              <>
            <form
              key={selectedZone!.id}
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                updateZone({
                  zoneId: selectedZone!.id,
                  radiusMiles: Number(form.get("radiusMiles")),
                  minActiveSubscribers: Number(form.get("minActiveSubscribers")),
                  status: String(form.get("status")) as "pending" | "launching" | "active" | "paused",
                  demoOnly: form.get("demoOnly") === "on",
                  operationModel: String(form.get("operationModel")) as "donatecrate_operated" | "partner_operated",
                  partnerId: String(form.get("partnerId") || "") || null,
                  partnerPickupDateOverrideAllowed: form.get("partnerPickupDateOverrideAllowed") === "on",
                  recurringPickupDay: String(form.get("recurringPickupDay") || "").trim()
                    ? Number(form.get("recurringPickupDay"))
                    : null,
                  defaultCutoffDaysBefore: Number(form.get("defaultCutoffDaysBefore") || 7),
                  defaultPickupWindowLabel: String(form.get("defaultPickupWindowLabel") || ""),
                  partnerNotes: String(form.get("partnerNotes") || ""),
                });
              }}
              className="rounded-3xl border border-admin bg-admin-surface p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold">{selectedZone!.name}</h3>
                  <p className="text-xs text-admin-soft">{selectedZone!.code} | ZIP {selectedZone!.anchor_postal_code}</p>
                </div>
                {isDemoOnlyZone(selectedZone!) ? (
                  <div className="rounded-full border px-3 py-1 text-xs font-semibold admin-badge-amber">
                    Demo only
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => updateZone({ zoneId: selectedZone!.id, signupEnabled: true })}
                    disabled={selectedZone!.signup_enabled}
                    className="rounded-lg border border-green-400/60 px-3 py-2 text-xs font-semibold text-green-300 disabled:opacity-40"
                  >
                    Open Signup
                  </button>
                  <button
                    type="button"
                    onClick={() => updateZone({ zoneId: selectedZone!.id, signupEnabled: false })}
                    disabled={!selectedZone!.signup_enabled}
                    className="rounded-lg border border-yellow-400/60 px-3 py-2 text-xs font-semibold text-yellow-300 disabled:opacity-40"
                  >
                    Pause Signup
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <label className="text-xs text-admin-muted">
                  Service Radius (miles)
                  <input
                    name="radiusMiles"
                    type="number"
                    min={0.5}
                    step={0.5}
                    defaultValue={selectedZone!.radius_miles}
                    className="dc-input-admin mt-1 w-full"
                  />
                </label>
                <label className="text-xs text-admin-muted">
                  Active households
                  <input
                    name="minActiveSubscribers"
                    type="number"
                    min={1}
                    defaultValue={selectedZone!.min_active_subscribers}
                    className="dc-input-admin mt-1 w-full"
                  />
                </label>
                <label className="text-xs text-admin-muted">
                  Service area status
                  <select name="status" defaultValue={selectedZone!.status} className="dc-input-admin mt-1 w-full">
                    <option value="pending">Planning</option>
                    <option value="launching">Opening Soon</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                  </select>
                </label>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="text-xs text-admin-muted">
                  Service lead
                  <select name="operationModel" defaultValue={selectedZone!.operation_model} className="dc-input-admin mt-1 w-full">
                    <option value="donatecrate_operated">DonateCrate managed</option>
                    <option value="partner_operated">Organization managed</option>
                  </select>
                </label>
                <label className="text-xs text-admin-muted">
                  Organization
                  <select name="partnerId" defaultValue={selectedZone!.partner_id ?? ""} className="dc-input-admin mt-1 w-full">
                    <option value="">No organization assigned</option>
                    {partnerOptions.map((partner) => (
                      <option key={partner.id} value={partner.id}>{partner.name}</option>
                    ))}
                  </select>
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-admin-muted md:col-span-2">
                  <input name="partnerPickupDateOverrideAllowed" type="checkbox" defaultChecked={selectedZone!.partner_pickup_date_override_allowed} />
                  Let the organization manage pickup dates for this service area
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-admin-muted md:col-span-2">
                  <input name="demoOnly" type="checkbox" defaultChecked={selectedZone!.demo_only} />
                  Demo only: keep this service area available for staff demos but block public signup
                </label>
                <label className="text-xs text-admin-muted">
                  Recurring pickup day
                  <input
                    name="recurringPickupDay"
                    type="number"
                    min={1}
                    max={31}
                    defaultValue={selectedZone!.recurring_pickup_day ?? ""}
                    className="dc-input-admin mt-1 w-full"
                  />
                </label>
                <label className="text-xs text-admin-muted md:col-span-2">
                  Pickup window
                  <input
                    name="defaultPickupWindowLabel"
                    type="text"
                    defaultValue={selectedZone!.default_pickup_window_label ?? ""}
                    className="dc-input-admin mt-1 w-full"
                  />
                </label>
                <label className="text-xs text-admin-muted md:col-span-2">
                  Team notes
                  <textarea
                    name="partnerNotes"
                    defaultValue={selectedZone!.partner_notes ?? ""}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-admin-strong bg-admin-surface-strong px-3 py-2"
                    placeholder="Notes for staff handling this service area"
                  />
                </label>
              </div>

              <p className="mt-3 text-xs text-admin-soft">Area center: {selectedZone!.center_address || "Not set"}</p>
              {selectedZone!.demo_only ? (
                <p className="mt-1 text-xs text-amber-700">Public signup is blocked for this demo service area, even if signup is turned on.</p>
              ) : null}
              <p className="mt-1 text-xs text-admin-soft">
                Service lead: {selectedZone!.operation_model === "partner_operated"
                  ? selectedZone!.partner?.name || "No organization assigned"
                  : "DonateCrate team"}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="submit" disabled={zoneSaving} className="rounded-lg border border-admin-strong px-4 py-2 text-sm font-semibold disabled:opacity-60">
                  {zoneSaving ? "Saving..." : "Save Zone Settings"}
                </button>
              </div>
            </form>

            <section className="rounded-3xl border border-admin bg-admin-surface p-6">
              <h4 className="text-lg font-bold">People In This Service Area</h4>
              <p className="mt-1 text-xs text-admin-soft">Donors and team members currently connected to this coverage area.</p>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <input
                  value={zoneMemberSearch}
                  onChange={(event) => {
                    setZoneMemberSearch(event.target.value);
                    setZoneMemberPage(1);
                  }}
                  placeholder="Search members"
                  className="dc-input-admin"
                />
                <select
                  value={zoneMemberRole}
                  onChange={(event) => {
                    setZoneMemberRole(event.target.value as "all" | "customer" | "admin" | "driver" | "partner_admin" | "partner_coordinator" | "partner_driver");
                    setZoneMemberPage(1);
                  }}
                  className="dc-input-admin"
                >
                  <option value="all">All people</option>
                  <option value="customer">Donor</option>
                  <option value="driver">Driver</option>
                  <option value="admin">DonateCrate Admin</option>
                  <option value="partner_admin">Organization Admin</option>
                  <option value="partner_coordinator">Coordinator</option>
                  <option value="partner_driver">Driver</option>
                </select>
                <p className="text-xs text-admin-muted md:self-center">
                  {zoneMemberPagination.total} total members
                </p>
              </div>
              <div className="mt-3 space-y-2">
                {zoneMembers.map((user) => (
                  <div key={user.id} className="rounded-xl border border-admin bg-admin-panel p-3">
                    <p className="text-sm font-semibold">{user.full_name || user.email}</p>
                    <p className="text-xs text-admin-muted">{user.email} | {formatRoleLabel(user.role)}</p>
                    <p className="mt-1 text-xs text-admin-soft">{user.primary_address ? `${user.primary_address.address_line1}, ${user.primary_address.city}` : "Address not set"}</p>
                  </div>
                ))}
                {zoneMembers.length === 0 ? <p className="text-sm text-admin-soft">No active members found for this zone.</p> : null}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setZoneMemberPage((prev) => Math.max(1, prev - 1))}
                  disabled={zoneMemberPagination.page <= 1}
                  className="rounded border border-admin-strong px-2 py-1 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-admin-muted">Page {zoneMemberPagination.page} of {zoneMemberPagination.totalPages}</span>
                <button
                  type="button"
                  onClick={() => setZoneMemberPage((prev) => Math.min(zoneMemberPagination.totalPages, prev + 1))}
                  disabled={zoneMemberPagination.page >= zoneMemberPagination.totalPages}
                  className="rounded border border-admin-strong px-2 py-1 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-admin bg-admin-surface p-6">
              <h4 className="text-lg font-bold">Update Service Area Center</h4>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input
                  value={editCenterQuery}
                  onChange={(event) => {
                    setEditCenterQuery(event.target.value);
                    setEditCenterSelection(null);
                    if (event.target.value.trim().length < 3) setEditCenterPredictions([]);
                  }}
                  placeholder="Search zone center address"
                  className="dc-input-admin"
                />
                <button onClick={updateZoneCenterAddress} className="rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold">Save Center Address</button>
              </div>
              {editCenterPredictions.length > 0 ? (
                <div className="mt-3 max-h-56 overflow-auto rounded-lg border border-admin-strong bg-admin-panel p-2">
                  {editCenterPredictions.map((prediction) => (
                    <button
                      key={prediction.placeId}
                      type="button"
                      onClick={async () => {
                        const details = await fetchPlaceDetails(prediction.placeId);
                        setEditCenterSelection({ placeId: prediction.placeId, formattedAddress: details.formattedAddress });
                        setEditCenterQuery(details.formattedAddress);
                        setEditCenterPredictions([]);
                      }}
                      className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-admin-surface-strong"
                    >
                      {prediction.mainText}
                      <p className="text-xs text-admin-muted">{prediction.secondaryText || prediction.description}</p>
                    </button>
                  ))}
                </div>
              ) : null}
              {editCenterSelection ? <p className="mt-2 text-xs text-admin-muted">Selected: {editCenterSelection.formattedAddress}</p> : null}
            </section>
              </>
            ) : null}

            {networkSubtab === "partners" ? (
            <section className="rounded-3xl border border-admin bg-admin-surface p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-lg font-bold">Organizations</h4>
                  <p className="mt-1 text-xs text-admin-soft">Create organization records, manage team access, and connect each organization to the right service areas.</p>
                </div>
                <div className="flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreatePartnerForm((prev: boolean) => !prev);
                      if (!showCreatePartnerForm) setSelectedPartnerId("");
                    }}
                    className="rounded-lg border border-[var(--dc-orange)] px-4 py-2 text-sm font-semibold text-[var(--dc-orange)]"
                  >
                    {showCreatePartnerForm ? "Close New Partner Form" : "Add New Partner"}
                  </button>
                  <select
                    value={selectedPartnerId}
                    onChange={(event) => {
                      setSelectedPartnerId(event.target.value);
                      setShowCreatePartnerForm(false);
                    }}
                    className="h-10 w-full rounded-lg border border-admin-strong bg-admin-surface-strong px-3 text-sm sm:w-auto"
                  >
                    <option value="">Select organization</option>
                    {partnerOptions.map((partner) => (
                      <option key={partner.id} value={partner.id}>{partner.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedPartner ? (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
                    <article className="rounded-2xl border border-admin bg-admin-panel p-4 text-sm text-admin-muted">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-admin">{selectedPartner.name}</p>
                          <p className="mt-1 text-xs text-admin-soft">{selectedPartner.code} | Receipts sent by DonateCrate on behalf of this nonprofit</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedPartner.active ? "admin-badge-green" : "admin-badge-red"}`}>
                          {selectedPartner.active ? "Active partner" : "Inactive partner"}

                        </span>
                      </div>
                      <p className="mt-3 text-xs text-admin-muted">
                        Support: {selectedPartner.support_email || "No email"} {selectedPartner.support_phone ? `| ${selectedPartner.support_phone}` : ""}
                      </p>
                      <p className="mt-2 text-xs text-admin-muted">
                        Receipts send from giving@donatecrate.com and use this nonprofit&apos;s branding.
                      </p>
                      <p className="mt-2 text-xs text-admin-muted">
                        Service areas: {selectedPartner.zones.length > 0 ? selectedPartner.zones.map((zone) => zone.name).join(" | ") : "None yet"}
                      </p>
                    </article>
                    <article className="rounded-2xl border border-admin bg-admin-panel p-4">
                      <p className="text-sm font-semibold">Add team member</p>
                      <p className="mt-1 text-xs text-admin-soft">Use any email address. If the person is new to DonateCrate, we will create the account and send a branded setup email for this organization.</p>
                      <div className="mt-3 grid gap-2">
                        <input
                          value={partnerMemberEmail}
                          onChange={(event) => setPartnerMemberEmail(event.target.value)}
                          placeholder="Work email address"
                          className="dc-input-admin"
                        />
                        <select
                          value={partnerMemberRole}
                          onChange={(event) => setPartnerMemberRole(event.target.value as "partner_admin" | "partner_coordinator" | "partner_driver")}
                          className="dc-input-admin"
                        >
                          <option value="partner_admin">Organization Admin</option>
                          <option value="partner_coordinator">Coordinator</option>
                          <option value="partner_driver">Driver</option>
                        </select>
                        <button onClick={addPartnerMember} className="rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold">
                          Add Team Member
                        </button>
                      </div>
                    </article>
                  </div>

                  {selectedPartnerForm ? (
                    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                      <article className="rounded-2xl border border-admin bg-admin-panel p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-admin">Organization account</p>
                            <p className="mt-1 text-xs text-admin-soft">Update the organization&apos;s contact details, profile information, and donor-facing branding here.</p>
                          </div>
                          <label className="inline-flex items-center gap-2 text-xs text-admin-muted">
                            <input
                              type="checkbox"
                              checked={selectedPartnerForm.active}
                              onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, active: event.target.checked } : prev))}
                            />
                            Active
                          </label>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <input value={selectedPartnerForm.name} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))} placeholder="Organization name" className="dc-input-admin" />
                          <input value={selectedPartner.code} disabled className="dc-input-admin opacity-70" />
                          <input value={selectedPartnerForm.legalName} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, legalName: event.target.value } : prev))} placeholder="Legal name" className="dc-input-admin" />
                          <input value={selectedPartnerForm.supportEmail} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, supportEmail: event.target.value } : prev))} placeholder="Support email" className="dc-input-admin" />
                          <input value={selectedPartnerForm.supportPhone} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, supportPhone: event.target.value } : prev))} placeholder="Support phone" className="dc-input-admin" />
                          <input value={selectedPartnerForm.websiteUrl} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, websiteUrl: event.target.value } : prev))} placeholder="Website URL" className="dc-input-admin" />
                          <input value={selectedPartnerForm.addressLine1} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, addressLine1: event.target.value } : prev))} placeholder="Mailing address" className="dc-input-admin md:col-span-2" />
                          <input value={selectedPartnerForm.city} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, city: event.target.value } : prev))} placeholder="City" className="dc-input-admin" />
                          <div className="grid gap-3 sm:grid-cols-2">
                            <input value={selectedPartnerForm.state} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, state: event.target.value } : prev))} placeholder="State" className="dc-input-admin" />
                            <input value={selectedPartnerForm.postalCode} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, postalCode: event.target.value } : prev))} placeholder="ZIP code" className="dc-input-admin" />
                          </div>
                          <div className="rounded-xl border border-admin bg-admin-panel px-3 py-3 text-xs text-admin-muted md:col-span-2">
                            Receipt delivery is handled by DonateCrate on behalf of this nonprofit. Payout settings stay internal for now and are not edited here.
                          </div>
                          <textarea value={selectedPartnerForm.aboutParagraph} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, aboutParagraph: event.target.value } : prev))} rows={4} placeholder="About paragraph" className="rounded-lg border border-admin-strong bg-admin-surface-strong px-3 py-2 text-sm md:col-span-2" />
                          <textarea value={selectedPartnerForm.notes} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, notes: event.target.value } : prev))} rows={3} placeholder="Team notes" className="rounded-lg border border-admin-strong bg-admin-surface-strong px-3 py-2 text-sm md:col-span-2" />
                        </div>
                      </article>

                      <article className="rounded-2xl border border-admin bg-admin-panel p-4">
                        <p className="text-sm font-semibold text-admin">Receipt branding</p>
                        <p className="mt-1 text-xs text-admin-soft">This branding is used in donation receipt emails while delivery still comes from `giving@donatecrate.com`.</p>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <input value={selectedPartnerForm.displayName} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, displayName: event.target.value } : prev))} placeholder="Receipt display name" className="dc-input-admin" />
                          <div className="rounded-xl border border-admin bg-admin-panel p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-admin-soft">Logo preview</p>
                            <div className="mt-3 flex h-24 items-center justify-center rounded-lg border border-dashed border-admin bg-admin-surface p-3">
                              {selectedPartnerForm.logoUrl ? (
                                <div
                                  className="h-full w-full bg-contain bg-center bg-no-repeat"
                                  style={{ backgroundImage: `url(${selectedPartnerForm.logoUrl})` }}
                                />
                              ) : (
                                <p className="text-xs text-admin-soft">No logo uploaded yet.</p>
                              )}
                            </div>
                          </div>
                          <input value={selectedPartnerForm.primaryColor} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, primaryColor: event.target.value } : prev))} placeholder="Primary color (#hex)" className="dc-input-admin" />
                          <input value={selectedPartnerForm.secondaryColor} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, secondaryColor: event.target.value } : prev))} placeholder="Secondary color (#hex)" className="dc-input-admin" />
                          <input value={selectedPartnerForm.accentColor} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, accentColor: event.target.value } : prev))} placeholder="Accent color (#hex)" className="dc-input-admin" />
                          <div className="rounded-xl border border-admin bg-admin-panel px-3 py-3 text-xs text-admin-muted">
                            Sender: {selectedPartnerForm.displayName || selectedPartnerForm.name || selectedPartner.name} &lt;giving@donatecrate.com&gt;
                          </div>
                          <textarea value={selectedPartnerForm.receiptFooter} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, receiptFooter: event.target.value } : prev))} rows={4} placeholder="Receipt footer" className="rounded-lg border border-admin-strong bg-admin-surface-strong px-3 py-2 text-sm md:col-span-2" />
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <button onClick={updatePartnerAccount} className="rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold">
                            Save Partner Settings
                          </button>
                          <p className="text-xs text-admin-soft">Receipt sending is fixed to DonateCrate on behalf of the nonprofit.</p>
                        </div>
                      </article>
                    </div>
                  ) : null}

                  <article className="rounded-2xl border border-admin bg-admin-panel p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-admin">Organization team</p>
                        <p className="mt-1 text-xs text-admin-soft">Manage organization admins, coordinators, and drivers without leaving the DonateCrate admin panel.</p>
                      </div>
                      <p className="text-xs text-admin-soft">{selectedPartner.members.length} members</p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {selectedPartner.members.map((member) => (
                        <div key={member.id} className="rounded-xl border border-admin bg-admin-panel p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-admin">{member.full_name || member.email}</p>
                              <p className="mt-1 text-xs text-admin-muted">{member.email}{member.phone ? ` | ${member.phone}` : ""}</p>
                            </div>
                            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${member.active ? "admin-badge-green" : "admin-badge-slate"}`}>
                              {member.active ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <select
                              value={member.role}
                              onChange={(event) => updatePartnerMember(member.id, { role: event.target.value as "partner_admin" | "partner_coordinator" | "partner_driver" })}
                              className="h-9 rounded-lg border border-admin-strong bg-admin-surface-strong px-3 text-sm"
                            >
                              <option value="partner_admin">Organization Admin</option>
                              <option value="partner_coordinator">Coordinator</option>
                              <option value="partner_driver">Driver</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => updatePartnerMember(member.id, { active: !member.active })}
                              className="rounded-lg border border-admin-strong px-3 py-2 text-xs font-semibold"
                            >
                              {member.active ? "Deactivate" : "Reactivate"}
                            </button>
                            <button
                              type="button"
                              onClick={() => deletePartnerMember(member.id, member.full_name || member.email)}
                              className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100"
                            >
                              Delete
                            </button>
                            <p className="text-xs text-admin-soft">{formatPartnerTeamRole(member.role)}</p>
                          </div>
                        </div>
                      ))}
                      {selectedPartner.members.length === 0 ? <p className="text-sm text-admin-soft">No team members added yet.</p> : null}
                    </div>
                  </article>
                </div>
              ) : null}
            </section>
            ) : null}
          </>
        ) : null}

        {networkSubtab === "zones" ? showCreateZoneForm ? (
          <section className="rounded-3xl border border-admin bg-admin-surface p-6">
            <h4 className="text-lg font-bold">Add New Service Area</h4>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input value={zoneForm.name} onChange={(event) => setZoneForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Service area name" className="dc-input-admin" />
              <input value={zoneForm.code} onChange={(event) => setZoneForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="Internal area code" className="dc-input-admin" />
              <input value={zoneForm.anchorPostalCode} onChange={(event) => setZoneForm((prev) => ({ ...prev, anchorPostalCode: event.target.value }))} placeholder="Anchor ZIP" className="dc-input-admin" />
              <input type="number" min={0.5} step={0.5} value={zoneForm.radiusMiles} onChange={(event) => setZoneForm((prev) => ({ ...prev, radiusMiles: Number(event.target.value) }))} placeholder="Service radius (miles)" className="dc-input-admin" />
              <input type="number" min={1} value={zoneForm.minActiveSubscribers} onChange={(event) => setZoneForm((prev) => ({ ...prev, minActiveSubscribers: Number(event.target.value) }))} placeholder="Active household goal" className="dc-input-admin" />
              <input
                value={createCenterQuery}
                onChange={(event) => {
                  setCreateCenterQuery(event.target.value);
                  setCreateCenterSelection(null);
                  if (event.target.value.trim().length < 3) setCreateCenterPredictions([]);
                }}
                placeholder="Service area center address"
                className="dc-input-admin"
              />
            </div>
            {createCenterPredictions.length > 0 ? (
              <div className="mt-3 max-h-56 overflow-auto rounded-lg border border-admin-strong bg-admin-panel p-2">
                {createCenterPredictions.map((prediction) => (
                  <button
                    key={prediction.placeId}
                    type="button"
                    onClick={async () => {
                      const details = await fetchPlaceDetails(prediction.placeId);
                      setCreateCenterSelection({ placeId: prediction.placeId, formattedAddress: details.formattedAddress });
                      setCreateCenterQuery(details.formattedAddress);
                      setCreateCenterPredictions([]);
                    }}
                    className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-admin-surface-strong"
                  >
                    {prediction.mainText}
                    <p className="text-xs text-admin-muted">{prediction.secondaryText || prediction.description}</p>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-2 text-xs">
                <input type="checkbox" checked={zoneForm.signupEnabled} onChange={(event) => setZoneForm((prev) => ({ ...prev, signupEnabled: event.target.checked }))} />
                Signup enabled
              </label>
              <label className="inline-flex items-center gap-2 text-xs">
                <input type="checkbox" checked={zoneForm.demoOnly} onChange={(event) => setZoneForm((prev) => ({ ...prev, demoOnly: event.target.checked }))} />
                Demo only
              </label>
              <button onClick={createZone} className="rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold">Create Service Area</button>
              <button
                type="button"
                onClick={() => setShowCreateZoneForm(false)}
                className="rounded-lg border border-admin-strong px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </section>
        ) : null : showCreatePartnerForm ? (
          <section className="rounded-3xl border border-admin bg-admin-surface p-6">
            <h4 className="text-lg font-bold">Add Nonprofit Partner</h4>
            <p className="mt-1 text-xs text-admin-soft">This creates the organization record and the nonprofit can brand receipts while delivery still comes from giving@donatecrate.com.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input value={partnerForm.name} onChange={(event) => setPartnerForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Partner name" className="dc-input-admin" />
              <input value={partnerForm.code} onChange={(event) => setPartnerForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="Partner code" className="dc-input-admin" />
              <input value={partnerForm.legalName} onChange={(event) => setPartnerForm((prev) => ({ ...prev, legalName: event.target.value }))} placeholder="Legal name" className="dc-input-admin" />
              <input value={partnerForm.supportEmail} onChange={(event) => setPartnerForm((prev) => ({ ...prev, supportEmail: event.target.value }))} placeholder="Support email" className="dc-input-admin" />
              <input value={partnerForm.supportPhone} onChange={(event) => setPartnerForm((prev) => ({ ...prev, supportPhone: event.target.value }))} placeholder="Support phone" className="dc-input-admin" />
              <input value={partnerForm.displayName} onChange={(event) => setPartnerForm((prev) => ({ ...prev, displayName: event.target.value }))} placeholder="Receipt display name" className="dc-input-admin" />
              <div className="rounded-xl border border-admin bg-admin-panel px-3 py-3 text-xs text-admin-muted md:col-span-2">
                Receipt emails are always sent by DonateCrate on behalf of the nonprofit. Payout and revenue-share settings are handled internally and are not configured here yet.
              </div>
              <input value={partnerForm.primaryColor} onChange={(event) => setPartnerForm((prev) => ({ ...prev, primaryColor: event.target.value }))} placeholder="Primary color (#hex)" className="dc-input-admin" />
              <input value={partnerForm.accentColor} onChange={(event) => setPartnerForm((prev) => ({ ...prev, accentColor: event.target.value }))} placeholder="Accent color (#hex)" className="dc-input-admin" />
              <div className="rounded-xl border border-admin bg-admin-panel p-3 md:col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-admin-soft">Logo preview</p>
                <div className="mt-3 flex h-24 items-center justify-center rounded-lg border border-dashed border-admin bg-admin-surface p-3">
                  {partnerForm.logoUrl ? (
                    <div
                      className="h-full w-full bg-contain bg-center bg-no-repeat"
                      style={{ backgroundImage: `url(${partnerForm.logoUrl})` }}
                    />
                  ) : (
                    <p className="text-xs text-admin-soft">No logo added yet. Logos are managed after the partner is created.</p>
                  )}
                </div>
              </div>
              <input value={partnerForm.websiteUrl} onChange={(event) => setPartnerForm((prev) => ({ ...prev, websiteUrl: event.target.value }))} placeholder="Website URL" className="h-10 rounded-lg border border-admin-strong bg-admin-surface-strong px-3 text-sm md:col-span-2" />
              <textarea value={partnerForm.notes} onChange={(event) => setPartnerForm((prev) => ({ ...prev, notes: event.target.value }))} rows={3} placeholder="Internal notes" className="rounded-lg border border-admin-strong bg-admin-surface-strong px-3 py-2 text-sm md:col-span-2" />
              <textarea value={partnerForm.receiptFooter} onChange={(event) => setPartnerForm((prev) => ({ ...prev, receiptFooter: event.target.value }))} rows={3} placeholder="Receipt footer" className="rounded-lg border border-admin-strong bg-admin-surface-strong px-3 py-2 text-sm md:col-span-2" />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={createPartner} className="rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold">Create Partner</button>
              <button
                type="button"
                onClick={() => setShowCreatePartnerForm(false)}
                className="rounded-lg border border-admin-strong px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <p className="text-xs text-admin-soft">DonateCrate will send receipts on behalf of this nonprofit using the branding set here.</p>
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}
