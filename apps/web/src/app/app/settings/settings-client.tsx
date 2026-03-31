"use client";

import { useEffect, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type Profile = { id: string; fullName: string; email: string; phone: string };
type Address = { addressLine1: string; addressLine2: string; city: string; state: string; postalCode: string };
type Subscription = { status: string; currentPeriodEnd: string | null; cancelAt: string | null; hasStripe: boolean };
type Preferences = { emailEnabled: boolean; smsEnabled: boolean };
type ZoneStatus = "active" | "pending" | "launching" | "not_covered" | null;

type Props = {
  profile: Profile;
  address: Address | null;
  subscription: Subscription | null;
  preferences: Preferences;
  zoneStatus: ZoneStatus;
  zoneName: string | null;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function ZoneBadge({ status, name }: { status: ZoneStatus; name: string | null }) {
  if (!status) return null;
  const map: Record<NonNullable<ZoneStatus>, { label: string; cls: string }> = {
    active:     { label: "Active zone" + (name ? ` · ${name}` : ""), cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    launching:  { label: (name ?? "Zone") + " · Launching soon",   cls: "bg-amber-100 text-amber-800 border-amber-200" },
    pending:    { label: (name ?? "Zone") + " · Planned — not yet active", cls: "bg-amber-100 text-amber-800 border-amber-200" },
    not_covered:{ label: "Outside service area",                    cls: "bg-gray-100 text-gray-700 border-gray-200" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold shadow-sm ${cls}`}>
      {label}
    </span>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="dc-card overflow-hidden px-5 py-5 sm:px-6 sm:py-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="h-5 w-1 rounded-full bg-[var(--dc-orange)]" aria-hidden />
        <h2 className="text-base font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--dc-gray-600)]">{children}</label>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      <div className="mt-1 w-full">{children}</div>
    </div>
  );
}

function SaveButton({ saving, label = "Save Changes" }: { saving: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="cursor-pointer rounded-2xl bg-[var(--dc-orange)] px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(255,106,0,0.2)] transition-all hover:shadow-[0_6px_20px_rgba(255,106,0,0.35)] disabled:opacity-50"
    >
      {saving ? "Saving…" : label}
    </button>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function SettingsClient({ profile, address, subscription, preferences, zoneStatus, zoneName }: Props) {
  // ── Personal Info ──────────────────────────────────────────────
  const [infoForm, setInfoForm] = useState({ fullName: profile.fullName, phone: profile.phone });
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoMsg, setInfoMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    setInfoSaving(true);
    setInfoMsg(null);
    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: infoForm.fullName,
          phone: infoForm.phone,
          // Pass through existing address fields required by the endpoint
          addressLine1: address?.addressLine1 ?? "",
          city: address?.city ?? "",
          state: address?.state ?? "CO",
          postalCode: address?.postalCode ?? "",
          addressLine2: address?.addressLine2 ?? "",
        }),
      });
      const json = await res.json();
      if (res.ok) setInfoMsg({ ok: true, text: "Personal info updated." });
      else setInfoMsg({ ok: false, text: json.error ?? "Failed to save." });
    } finally {
      setInfoSaving(false);
    }
  }

  // ── Address Change ─────────────────────────────────────────────
  const [addressMode, setAddressMode] = useState<"view" | "edit" | "confirm">("view");
  const [editAddressForm, setEditAddressForm] = useState<Address>({
    addressLine1: address?.addressLine1 ?? "",
    addressLine2: address?.addressLine2 ?? "",
    city: address?.city ?? "",
    state: address?.state ?? "",
    postalCode: address?.postalCode ?? "",
  });
  const [pendingAddress, setPendingAddress] = useState<Address | null>(null);
  const [pendingZone, setPendingZone] = useState<{ status: ZoneStatus; name: string | null } | null>(null);
  const [currentAddress, setCurrentAddress] = useState<Address | null>(address);
  const [currentZoneStatus, setCurrentZoneStatus] = useState<ZoneStatus>(zoneStatus);
  const [currentZoneName, setCurrentZoneName] = useState<string | null>(zoneName);
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressMsg, setAddressMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function checkAndConfirmAddress(newAddr: Address) {
    setAddressSaving(true);
    setAddressMsg(null);
    try {
      // Check eligibility with full address so geocoding gives precise results
      const res = await fetch("/api/eligibility/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressLine1: newAddr.addressLine1,
          city: newAddr.city,
          state: newAddr.state,
          postalCode: newAddr.postalCode,
        }),
      });
      const json = await res.json();
      setPendingAddress(newAddr);
      setPendingZone({ status: (json.status ?? null) as ZoneStatus, name: json.zoneName ?? null });
      setAddressMode("confirm");
    } catch {
      setAddressMsg({ ok: false, text: "Could not verify zone for this address. Try again." });
    } finally {
      setAddressSaving(false);
    }
  }

  async function saveAddress() {
    if (!pendingAddress) return;
    setAddressSaving(true);
    setAddressMsg(null);
    try {
      const res = await fetch("/api/customer/update-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingAddress),
      });
      const json = await res.json();
      if (res.ok) {
        setCurrentAddress(pendingAddress);
        setCurrentZoneStatus(json.zoneStatus as ZoneStatus);
        setCurrentZoneName(json.zoneName);
        setPendingAddress(null);
        setPendingZone(null);
        setAddressMode("view");
        setAddressMsg({ ok: true, text: "Address updated successfully." });
      } else {
        setAddressMsg({ ok: false, text: json.error ?? "Failed to update address." });
      }
    } finally {
      setAddressSaving(false);
    }
  }

  // ── Billing ────────────────────────────────────────────────────
  const [billingWorking, setBillingWorking] = useState(false);
  const [billingMsg, setBillingMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState(subscription);

  async function openBillingPortal() {
    setBillingWorking(true);
    setBillingMsg(null);
    try {
      const res = await fetch("/api/billing/checkout-session", { method: "POST" });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
      else setBillingMsg({ ok: false, text: json.error ?? "Could not open billing portal." });
    } finally {
      setBillingWorking(false);
    }
  }

  async function cancelSubscription() {
    setBillingWorking(true);
    setBillingMsg(null);
    try {
      const res = await fetch("/api/customer/cancel-subscription", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setCurrentSubscription((prev) => prev ? { ...prev, status: "canceling", cancelAt: json.cancelAt } : prev);
        setBillingMsg({ ok: true, text: "Your subscription will end at the close of the current billing period. You'll keep full access until then." });
        setShowCancelConfirm(false);
      } else {
        setBillingMsg({ ok: false, text: json.error ?? "Failed to cancel subscription." });
      }
    } finally {
      setBillingWorking(false);
    }
  }

  // ── Notifications ──────────────────────────────────────────────
  const [prefs, setPrefs] = useState(preferences);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsMsg, setPrefsMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function savePrefs(e: React.FormEvent) {
    e.preventDefault();
    setPrefsSaving(true);
    setPrefsMsg(null);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const json = await res.json();
      if (res.ok) setPrefsMsg({ ok: true, text: "Notification preferences saved." });
      else setPrefsMsg({ ok: false, text: json.error ?? "Failed to save." });
    } finally {
      setPrefsSaving(false);
    }
  }

  // ── Subscription display helpers ───────────────────────────────
  const subStatusLabel: Record<string, string> = {
    active: "Active",
    paused: "Paused",
    canceling: "Cancels at period end",
    canceled: "Canceled",
    none: "No subscription",
  };
  const status = currentSubscription?.status ?? "none";

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-2xl space-y-5 pb-4">
      <header className="rounded-2xl bg-gradient-to-br from-[var(--dc-gray-50)] to-white px-5 py-5 shadow-sm ring-1 ring-black/5">
        <a href="/app" className="text-xs font-medium text-[var(--dc-gray-500)] hover:text-[var(--dc-gray-900)]">← Back to Dashboard</a>
        <h1 className="mt-2 text-2xl font-bold">Account Settings</h1>
        <p className="mt-1 text-sm text-[var(--dc-gray-600)]">Manage your personal info, address, billing, and notification preferences.</p>
      </header>

      {/* ── Personal Info ── */}
      <SectionCard title="Personal Information">
        <form onSubmit={saveInfo} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <Field label="Full Name">
              <input
                value={infoForm.fullName}
                onChange={(e) => setInfoForm((p) => ({ ...p, fullName: e.target.value }))}
                required
                minLength={2}
                className="dc-input w-full"
                placeholder="Your full name"
              />
            </Field>
            <Field label="Phone Number">
              <input
                value={infoForm.phone}
                onChange={(e) => setInfoForm((p) => ({ ...p, phone: e.target.value }))}
                type="tel"
                className="dc-input w-full"
                placeholder="(555) 000-0000"
              />
            </Field>
          </div>
          <Field label="Email Address">
            <input
              value={profile.email}
              disabled
              className="dc-input w-full opacity-60 cursor-not-allowed"
              title="To change your email address, contact support@donatecrate.com"
            />
            <p className="mt-1 text-xs text-[var(--dc-gray-500)]">To update your email, contact <a href="mailto:support@donatecrate.com" className="underline">support@donatecrate.com</a>.</p>
          </Field>
          {infoMsg && (
            <p className={`text-sm font-medium ${infoMsg.ok ? "text-emerald-700" : "text-red-600"}`}>{infoMsg.text}</p>
          )}
          <SaveButton saving={infoSaving} />
        </form>
      </SectionCard>

      {/* ── Service Address ── */}
      <SectionCard title="Service Address">
        {addressMode === "view" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                {currentAddress ? (
                  <div className="text-sm">
                    <p className="font-medium">{currentAddress.addressLine1}{currentAddress.addressLine2 ? `, ${currentAddress.addressLine2}` : ""}</p>
                    <p className="text-[var(--dc-gray-600)]">{currentAddress.city}, {currentAddress.state} {currentAddress.postalCode}</p>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--dc-gray-500)]">No address on file.</p>
                )}
                <div className="mt-2">
                  <ZoneBadge status={currentZoneStatus} name={currentZoneName} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setAddressMode("edit"); setAddressMsg(null); }}
                className="cursor-pointer rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-[var(--dc-gray-50)] transition-colors"
              >
                Change Address
              </button>
            </div>
            {currentZoneStatus && currentZoneStatus !== "active" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <strong>Your area isn't active yet.</strong> We'll email you as soon as service opens near you.
                If you've moved to a new address in an active zone, use "Change Address" above to update it.
              </div>
            )}
            {addressMsg && (
              <p className={`text-sm font-medium ${addressMsg.ok ? "text-emerald-700" : "text-red-600"}`}>{addressMsg.text}</p>
            )}
          </div>
        )}

        {addressMode === "edit" && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--dc-gray-600)]">Enter your new service address. We'll verify it's in an active zone before saving.</p>
            <div className="grid gap-3">
              <Field label="Street Address">
                <input
                  value={editAddressForm.addressLine1}
                  onChange={(e) => setEditAddressForm((p) => ({ ...p, addressLine1: e.target.value }))}
                  className="dc-input w-full"
                  placeholder="123 Main St"
                />
              </Field>
              <Field label="Apt / Unit (optional)">
                <input
                  value={editAddressForm.addressLine2}
                  onChange={(e) => setEditAddressForm((p) => ({ ...p, addressLine2: e.target.value }))}
                  className="dc-input w-full"
                  placeholder="Apt 4B"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3 [&>*]:min-w-0">
                <Field label="City">
                  <input
                    value={editAddressForm.city}
                    onChange={(e) => setEditAddressForm((p) => ({ ...p, city: e.target.value }))}
                    className="dc-input w-full"
                    placeholder="Denver"
                  />
                </Field>
                <Field label="State">
                  <input
                    value={editAddressForm.state}
                    onChange={(e) => setEditAddressForm((p) => ({ ...p, state: e.target.value.toUpperCase().slice(0, 2) }))}
                    className="dc-input w-full"
                    placeholder="CO"
                    maxLength={2}
                  />
                </Field>
                <Field label="ZIP Code">
                  <input
                    value={editAddressForm.postalCode}
                    onChange={(e) => setEditAddressForm((p) => ({ ...p, postalCode: e.target.value }))}
                    className="dc-input w-full"
                    placeholder="80202"
                  />
                </Field>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={addressSaving || !editAddressForm.addressLine1 || !editAddressForm.city || !editAddressForm.state || !editAddressForm.postalCode}
                onClick={() => checkAndConfirmAddress(editAddressForm)}
                className="cursor-pointer rounded-2xl bg-[var(--dc-gray-900)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {addressSaving ? "Checking…" : "Verify & Continue"}
              </button>
              <button
                type="button"
                onClick={() => setAddressMode("view")}
                className="text-sm text-[var(--dc-gray-500)] hover:text-black underline cursor-pointer self-center"
              >
                Cancel
              </button>
            </div>
            {addressMsg && (
              <p className={`text-sm font-medium ${addressMsg.ok ? "text-emerald-700" : "text-red-600"}`}>{addressMsg.text}</p>
            )}
          </div>
        )}

        {addressMode === "confirm" && pendingAddress && pendingZone && (
          <div className="space-y-4">
            <div className="rounded-xl border border-black/10 bg-[var(--dc-gray-50)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dc-gray-500)]">New Address</p>
              <p className="mt-1 font-medium">{pendingAddress.addressLine1}{pendingAddress.addressLine2 ? `, ${pendingAddress.addressLine2}` : ""}</p>
              <p className="text-sm text-[var(--dc-gray-600)]">{pendingAddress.city}, {pendingAddress.state} {pendingAddress.postalCode}</p>
              <div className="mt-2">
                <ZoneBadge status={pendingZone.status} name={pendingZone.name} />
              </div>
            </div>

            {pendingZone.status !== "active" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <strong>This address is not in an active service zone yet.</strong> You can still save it — we'll notify you when service opens in your area. Your subscription (if active) will remain as-is.
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={saveAddress}
                disabled={addressSaving}
                className="cursor-pointer rounded-2xl bg-[var(--dc-orange)] px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(255,106,0,0.2)] disabled:opacity-50"
              >
                {addressSaving ? "Saving…" : "Save This Address"}
              </button>
              <button
                type="button"
                onClick={() => { setAddressMode("edit"); setPendingAddress(null); setPendingZone(null); }}
                className="cursor-pointer rounded-2xl border border-black/10 bg-white px-5 py-2 text-sm font-semibold"
              >
                Try a Different Address
              </button>
              <button
                type="button"
                onClick={() => { setAddressMode("view"); setPendingAddress(null); setPendingZone(null); }}
                className="text-sm text-[var(--dc-gray-500)] hover:text-black underline cursor-pointer self-center"
              >
                Keep Current Address
              </button>
            </div>
            {addressMsg && (
              <p className={`text-sm font-medium ${addressMsg.ok ? "text-emerald-700" : "text-red-600"}`}>{addressMsg.text}</p>
            )}
          </div>
        )}
      </SectionCard>

      {/* ── Billing ── */}
      <SectionCard title="Billing & Subscription">
        <div className="space-y-5">

          {/* Plan status card */}
          <div className="rounded-xl border border-black/10 bg-[var(--dc-gray-50)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dc-gray-500)]">DonateCrate Monthly Pickup Plan</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-sm font-semibold ${
                status === "active"    ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                status === "canceling" ? "bg-amber-100 text-amber-800 border-amber-200" :
                status === "paused"    ? "bg-blue-100 text-blue-800 border-blue-200" :
                                         "bg-gray-100 text-gray-700 border-gray-200"
              }`}>
                {subStatusLabel[status] ?? status}
              </span>
            </div>
            {currentSubscription?.currentPeriodEnd && status === "active" && (
              <p className="mt-2 text-xs text-[var(--dc-gray-500)]">
                Next billing date: <span className="font-medium text-[var(--dc-gray-900)]">{new Date(currentSubscription.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
              </p>
            )}
            {currentSubscription?.cancelAt && (
              <p className="mt-2 text-xs font-medium text-amber-700">
                ⚠ Your access ends {new Date(currentSubscription.cancelAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. No further charges will be made.
              </p>
            )}
          </div>

          {/* Active / paused: payment + billing actions */}
          {(status === "active" || status === "paused") && currentSubscription?.hasStripe && (
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={openBillingPortal}
                disabled={billingWorking}
                className="cursor-pointer flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-[var(--dc-gray-50)] disabled:opacity-50 transition-colors"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path d="M2.5 4A1.5 1.5 0 0 0 1 5.5v1h18v-1A1.5 1.5 0 0 0 17.5 4h-15ZM19 8.5H1V14.5A1.5 1.5 0 0 0 2.5 16h15a1.5 1.5 0 0 0 1.5-1.5V8.5ZM4 12.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75ZM9.75 11.5a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H9.75Z" />
                </svg>
                {billingWorking ? "Opening…" : "Update Payment Method"}
              </button>
              <button
                type="button"
                onClick={openBillingPortal}
                disabled={billingWorking}
                className="cursor-pointer flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-[var(--dc-gray-50)] disabled:opacity-50 transition-colors"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M4.5 2A2.5 2.5 0 0 0 2 4.5v11A2.5 2.5 0 0 0 4.5 18h11a2.5 2.5 0 0 0 2.5-2.5v-11A2.5 2.5 0 0 0 15.5 2h-11ZM5 6.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5Zm0 3a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5Zm0 3a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5Z" clipRule="evenodd" />
                </svg>
                {billingWorking ? "Opening…" : "View Billing History"}
              </button>
            </div>
          )}

          {/* No subscription: start one */}
          {(!currentSubscription || status === "none" || status === "canceled") && (
            <button
              type="button"
              onClick={openBillingPortal}
              disabled={billingWorking}
              className="cursor-pointer rounded-2xl bg-[var(--dc-orange)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(255,106,0,0.2)] hover:shadow-[0_6px_20px_rgba(255,106,0,0.35)] disabled:opacity-50 transition-all"
            >
              {billingWorking ? "Loading…" : "Start Subscription"}
            </button>
          )}

          {billingMsg && (
            <p className={`rounded-xl border px-4 py-3 text-sm font-medium ${billingMsg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{billingMsg.text}</p>
          )}

          {/* Cancel */}
          {(status === "active" || status === "paused") && (
            <div className="border-t border-black/5 pt-4">
              {!showCancelConfirm ? (
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-[var(--dc-gray-500)]">Need to step away? You&apos;ll keep access through the end of your billing period.</p>
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(true)}
                    className="cursor-pointer shrink-0 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Cancel Plan
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-red-900">Cancel your subscription?</p>
                  <p className="text-sm text-red-800">
                    Your pickups and account access continue until <strong>{currentSubscription?.cancelAt ? new Date(currentSubscription.cancelAt).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : "the end of your billing period"}</strong>. No further charges will be made after that.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCancelConfirm(false)}
                      className="cursor-pointer rounded-xl bg-[var(--dc-gray-900)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                    >
                      Keep My Plan
                    </button>
                    <button
                      type="button"
                      onClick={cancelSubscription}
                      disabled={billingWorking}
                      className="cursor-pointer rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      {billingWorking ? "Canceling…" : "Yes, Cancel"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Canceling state: inform + support */}
          {status === "canceling" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-1">
              <p className="font-semibold">Your plan is set to cancel.</p>
              <p>You still have full access until your billing period ends. If you change your mind, contact <a href="mailto:support@donatecrate.com" className="underline font-medium">support@donatecrate.com</a> and we can reactivate your plan.</p>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Notifications ── */}
      <SectionCard title="Notification Preferences">
        <form onSubmit={savePrefs} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-black/10 bg-[var(--dc-gray-50)] p-4">
              <div>
                <p className="font-medium text-sm">Email Reminders</p>
                <p className="text-xs text-[var(--dc-gray-500)]">72h and 24h pickup reminders</p>
              </div>
              <button
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, emailEnabled: !p.emailEnabled }))}
                className={`relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors ${prefs.emailEnabled ? "bg-emerald-500" : "bg-gray-300"}`}
                role="switch"
                aria-checked={prefs.emailEnabled}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${prefs.emailEnabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </label>
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-black/10 bg-[var(--dc-gray-50)] p-4">
              <div>
                <p className="font-medium text-sm">SMS Reminders</p>
                <p className="text-xs text-[var(--dc-gray-500)]">Text messages before pickup</p>
              </div>
              <button
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, smsEnabled: !p.smsEnabled }))}
                className={`relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors ${prefs.smsEnabled ? "bg-emerald-500" : "bg-gray-300"}`}
                role="switch"
                aria-checked={prefs.smsEnabled}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${prefs.smsEnabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </label>
          </div>
          <p className="rounded-xl border border-black/5 bg-[var(--dc-gray-50)] px-4 py-3 text-sm text-[var(--dc-gray-600)]">
            We&apos;ll only send reminders during reasonable hours.
          </p>
          {prefsMsg && (
            <p className={`text-sm font-medium ${prefsMsg.ok ? "text-emerald-700" : "text-red-600"}`}>{prefsMsg.text}</p>
          )}
          <SaveButton saving={prefsSaving} />
        </form>
      </SectionCard>

      {/* Support */}
      <section className="rounded-2xl border border-black/5 bg-white/60 p-4 text-center">
        <p className="text-sm text-[var(--dc-gray-500)]">
          Need further help?{" "}
          <a href="mailto:support@donatecrate.com" className="font-semibold text-[var(--dc-orange)] hover:underline">
            Contact support
          </a>
          {" "}and we&apos;ll get back to you within 24 hours.
        </p>
      </section>
    </div>
  );
}
