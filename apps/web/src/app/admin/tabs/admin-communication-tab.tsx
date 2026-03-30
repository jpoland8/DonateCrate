"use client";

import { getNotificationRetryState } from "@/lib/notification-health";
import { formatNotificationChannel, formatNotificationEventType, formatNotificationStatus } from "@/lib/notification-labels";

import type { AdminData, AdminNotificationEvent, CommunicationChannelHealth } from "../admin-types";

// ---------- local helper (mirrors the one in admin-workspace) ----------

function getNotificationStateTone(severity: "healthy" | "attention" | "blocked") {
  switch (severity) {
    case "healthy":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-50";
    case "blocked":
      return "border-red-400/25 bg-red-400/10 text-red-50";
    default:
      return "border-amber-400/25 bg-amber-400/10 text-amber-50";
  }
}

// ---------- types ----------

export type SmsZoneEligibleUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  phone: string;
};

export type AdminCommunicationTabProps = {
  /** Full admin data payload (used for zones list and user search). */
  data: AdminData;

  // Channel health
  communicationHealth: {
    sms: CommunicationChannelHealth | null;
    email: CommunicationChannelHealth | null;
  };

  // Notification event derived lists
  notificationEvents: AdminNotificationEvent[];
  queuedNotificationEvents: AdminNotificationEvent[];
  failedNotificationEvents: AdminNotificationEvent[];
  blockedNotificationEvents: AdminNotificationEvent[];
  smsNotificationEvents: AdminNotificationEvent[];
  emailNotificationEvents: AdminNotificationEvent[];

  // Notification selection & loading
  notificationSelection: string[];
  setNotificationSelection: React.Dispatch<React.SetStateAction<string[]>>;
  notificationActionLoading: boolean;

  // SMS campaign state
  smsTarget: "individual" | "zone" | "all";
  setSmsTarget: (value: "individual" | "zone" | "all") => void;
  smsUserIds: string[];
  setSmsUserIds: React.Dispatch<React.SetStateAction<string[]>>;
  smsZoneId: string;
  setSmsZoneId: (value: string) => void;
  smsIncludeStaff: boolean;
  setSmsIncludeStaff: (value: boolean) => void;
  smsSearch: string;
  setSmsSearch: (value: string) => void;
  smsMessage: string;
  setSmsMessage: (value: string) => void;
  smsSending: boolean;
  smsConfigError: string | null;
  smsRecipientEstimate: number;
  smsUsersWithPhones: Array<{ id: string; email: string; full_name: string | null; phone: string | null }>;

  // SMS zone preview
  smsZoneEligibleUsers: SmsZoneEligibleUser[];
  smsZonePreviewLoading: boolean;

  // Action handlers
  sendSmsCampaign: () => void;
  queueCycleReminders: (cadence: "72h" | "24h" | "day_of") => void;
  processQueuedNotifications: () => void;
  retrySelectedNotifications: () => void;
};

export function AdminCommunicationTab({
  data,
  communicationHealth,
  notificationEvents,
  queuedNotificationEvents,
  failedNotificationEvents,
  blockedNotificationEvents,
  smsNotificationEvents,
  emailNotificationEvents,
  notificationSelection,
  setNotificationSelection,
  notificationActionLoading,
  smsTarget,
  setSmsTarget,
  smsUserIds,
  setSmsUserIds,
  smsZoneId,
  setSmsZoneId,
  smsIncludeStaff,
  setSmsIncludeStaff,
  smsSearch,
  setSmsSearch,
  smsMessage,
  setSmsMessage,
  smsSending,
  smsConfigError,
  smsRecipientEstimate,
  smsUsersWithPhones,
  smsZoneEligibleUsers,
  smsZonePreviewLoading,
  sendSmsCampaign,
  queueCycleReminders,
  processQueuedNotifications,
  retrySelectedNotifications,
}: AdminCommunicationTabProps) {
  return (
    <section className="space-y-6">
      {/* ---- Channel Health Overview ---- */}
      <article className="rounded-3xl border border-admin bg-admin-surface p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">Messaging Control</p>
        <h3 className="mt-2 text-2xl font-bold">Keep reminders, billing alerts, and delivery issues in one place</h3>
        <p className="mt-2 max-w-3xl text-sm text-admin-muted">
          Customers should get simple, dependable updates. Use this tab to confirm both delivery channels are healthy, queue pickup reminders, and separate retryable failures from events that need account cleanup first.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-admin bg-admin-panel p-4">
            <p className="text-xs uppercase tracking-wide text-admin-soft">Queued</p>
            <p className="mt-2 text-2xl font-bold">{queuedNotificationEvents.length}</p>
          </div>
          <div className="rounded-2xl border border-admin bg-admin-panel p-4">
            <p className="text-xs uppercase tracking-wide text-admin-soft">Retryable failures</p>
            <p className="mt-2 text-2xl font-bold">
              {failedNotificationEvents.filter((event) => getNotificationRetryState(event).canRetry).length}
            </p>
          </div>
          <div className="rounded-2xl border border-admin bg-admin-panel p-4">
            <p className="text-xs uppercase tracking-wide text-admin-soft">Blocked failures</p>
            <p className="mt-2 text-2xl font-bold">{blockedNotificationEvents.length}</p>
          </div>
          <div className="rounded-2xl border border-admin bg-admin-panel p-4">
            <p className="text-xs uppercase tracking-wide text-admin-soft">Selected for retry</p>
            <p className="mt-2 text-2xl font-bold">{notificationSelection.length}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className={`rounded-2xl border p-4 ${getNotificationStateTone(communicationHealth.sms?.ready ? "healthy" : communicationHealth.sms?.configured ? "attention" : "blocked")}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-admin-soft">Text delivery</p>
                <h4 className="mt-2 text-lg font-semibold text-admin">Twilio</h4>
              </div>
              <span className="rounded-full border border-admin px-3 py-1 text-xs font-semibold uppercase tracking-wide text-admin-muted">
                {communicationHealth.sms?.ready ? "Verified" : communicationHealth.sms?.configured ? "Needs attention" : "Setup needed"}
              </span>
            </div>
            <p className="mt-3 text-sm text-admin-muted">
              {communicationHealth.sms?.detail || "SMS channel status will appear here once loaded."}
            </p>
            <p className="mt-3 text-xs text-admin-soft">
              Sender: {communicationHealth.sms?.fromNumber || communicationHealth.sms?.messagingServiceSid || "Not configured"}
            </p>
            <p className="mt-2 text-xs text-admin-soft">{smsNotificationEvents.length} text events logged recently.</p>
          </div>
          <div className={`rounded-2xl border p-4 ${getNotificationStateTone(communicationHealth.email?.ready ? "healthy" : communicationHealth.email?.configured ? "attention" : "blocked")}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-admin-soft">Email delivery</p>
                <h4 className="mt-2 text-lg font-semibold text-admin">Resend</h4>
              </div>
              <span className="rounded-full border border-admin px-3 py-1 text-xs font-semibold uppercase tracking-wide text-admin-muted">
                {communicationHealth.email?.ready ? "Verified" : communicationHealth.email?.configured ? "Needs attention" : "Setup needed"}
              </span>
            </div>
            <p className="mt-3 text-sm text-admin-muted">
              {communicationHealth.email?.detail || "Email channel status will appear here once loaded."}
            </p>
            <p className="mt-3 text-xs text-admin-soft">
              From: {communicationHealth.email?.fromEmail || "Not configured"}
            </p>
            <p className="mt-2 text-xs text-admin-soft">
              Provider: {communicationHealth.email?.host || "Not configured"} • {emailNotificationEvents.length} email events logged recently.
            </p>
          </div>
        </div>
      </article>

      {/* ---- SMS Campaigns ---- */}
      <article className="rounded-3xl border border-admin bg-admin-surface p-6">
        <h3 className="text-xl font-bold">SMS Campaigns</h3>
        <p className="mt-1 text-sm text-admin-muted">
          Send one-off SMS updates to individual users, active users in a zone, or your full audience.
        </p>
        {smsConfigError ? (
          <div className="mt-4 rounded-xl border admin-badge-amber px-4 py-3 text-sm text-admin-muted">
            SMS is not ready in this environment: {smsConfigError}.
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-xs text-admin-muted">
            Target Type
            <select
              value={smsTarget}
              onChange={(event) => setSmsTarget(event.target.value as "individual" | "zone" | "all")}
              className="dc-input-admin mt-1 w-full"
            >
              <option value="individual">Individual users</option>
              <option value="zone">Single zone group</option>
              <option value="all">All audience</option>
            </select>
          </label>
          {smsTarget === "zone" ? (
            <label className="text-xs text-admin-muted">
              Zone
              <select
                value={smsZoneId}
                onChange={(event) => setSmsZoneId(event.target.value)}
                className="dc-input-admin mt-1 w-full"
              >
                <option value="">Select zone</option>
                {data.zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {smsTarget === "all" ? (
            <label className="inline-flex items-center gap-2 text-xs text-admin-muted md:mt-6">
              <input
                type="checkbox"
                checked={smsIncludeStaff}
                onChange={(event) => setSmsIncludeStaff(event.target.checked)}
              />
              Include admin + driver accounts
            </label>
          ) : null}
          <div className="rounded-lg border border-admin bg-admin-panel px-3 py-2 text-xs text-admin-muted md:mt-6">
            Eligible recipients: {smsRecipientEstimate}
          </div>
        </div>

        {smsTarget === "individual" ? (
          <div className="mt-4 space-y-3">
            <input
              value={smsSearch}
              onChange={(event) => setSmsSearch(event.target.value)}
              placeholder="Search users by name, email, or phone"
              className="h-10 w-full rounded-lg border border-admin-strong bg-admin-surface-strong px-3 text-sm"
            />
            <div className="max-h-56 overflow-auto rounded-xl border border-admin bg-admin-panel p-2">
              {smsUsersWithPhones.slice(0, 120).map((user) => (
                <label
                  key={user.id}
                  className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-admin-surface-strong"
                >
                  <span className="pr-2">
                    {user.full_name || user.email}
                    <span className="ml-2 text-xs text-admin-muted">{user.phone}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={smsUserIds.includes(user.id)}
                    onChange={(event) => {
                      setSmsUserIds((prev) =>
                        event.target.checked ? [...prev, user.id] : prev.filter((id) => id !== user.id),
                      );
                    }}
                  />
                </label>
              ))}
              {smsUsersWithPhones.length === 0 ? (
                <p className="px-2 py-3 text-sm text-admin-soft">No users with phone numbers match this search.</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {smsTarget === "zone" ? (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-admin-muted">Active eligible users in zone</p>
            <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-admin bg-admin-panel p-2">
              {smsZonePreviewLoading ? (
                <p className="px-2 py-3 text-sm text-admin-soft">Loading zone recipients...</p>
              ) : smsZoneEligibleUsers.length === 0 ? (
                <p className="px-2 py-3 text-sm text-admin-soft">No active subscribed + SMS opted-in users found.</p>
              ) : (
                smsZoneEligibleUsers.map((user) => (
                  <div key={user.id} className="rounded-lg px-2 py-2 text-sm hover:bg-admin-surface-strong">
                    <span>{user.fullName || user.email}</span>
                    <span className="ml-2 text-xs text-admin-muted">{user.phone}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          <label className="text-xs text-admin-muted">
            SMS Message
            <textarea
              value={smsMessage}
              onChange={(event) => setSmsMessage(event.target.value)}
              rows={5}
              maxLength={600}
              placeholder="Write your operational update or reminder"
              className="mt-1 w-full rounded-xl border border-admin-strong bg-admin-surface-strong px-3 py-3 text-sm"
            />
          </label>
          <p className="mt-1 text-xs text-admin-soft">{smsMessage.length}/600 characters</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={sendSmsCampaign}
            disabled={smsSending || !!smsConfigError}
            className="rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold text-admin disabled:opacity-60"
          >
            {smsSending ? "Sending..." : "Send SMS Campaign"}
          </button>
        </div>
      </article>

      {/* ---- Reminder Queue & Notification Events ---- */}
      <article className="rounded-3xl border border-admin bg-admin-surface p-6">
        <h3 className="text-xl font-bold">Reminder Queue</h3>
        <p className="mt-1 text-sm text-admin-muted">
          Queue cycle reminders for opted-in households. If email is connected, pickup reminders will queue for both text and email.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => queueCycleReminders("72h")}
            disabled={notificationActionLoading}
            className="rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold text-admin disabled:opacity-60"
          >
            Queue 72h Reminder
          </button>
          <button
            type="button"
            onClick={() => queueCycleReminders("24h")}
            disabled={notificationActionLoading}
            className="rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold text-admin disabled:opacity-60"
          >
            Queue 24h Reminder
          </button>
          <button
            type="button"
            onClick={() => queueCycleReminders("day_of")}
            disabled={notificationActionLoading}
            className="rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold text-admin disabled:opacity-60"
          >
            Queue Day-of Reminder
          </button>
          <button
            type="button"
            onClick={processQueuedNotifications}
            disabled={notificationActionLoading}
            className="rounded-lg border border-admin-strong px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            Process Queued Events
          </button>
          <button
            type="button"
            onClick={retrySelectedNotifications}
            disabled={notificationActionLoading || notificationSelection.length === 0}
            className="rounded-lg border border-admin-strong px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            Retry Selected Failures
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-admin bg-admin-panel p-4">
            <p className="text-xs uppercase tracking-wide text-admin-soft">Queued</p>
            <p className="mt-2 text-2xl font-bold">{queuedNotificationEvents.length}</p>
          </div>
          <div className="rounded-2xl border border-admin bg-admin-panel p-4">
            <p className="text-xs uppercase tracking-wide text-admin-soft">Retryable Failures</p>
            <p className="mt-2 text-2xl font-bold">
              {failedNotificationEvents.filter((event) => getNotificationRetryState(event).canRetry).length}
            </p>
          </div>
          <div className="rounded-2xl border border-admin bg-admin-panel p-4">
            <p className="text-xs uppercase tracking-wide text-admin-soft">Needs Manual Fix</p>
            <p className="mt-2 text-2xl font-bold">{blockedNotificationEvents.length}</p>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-admin bg-admin-panel p-4 text-sm text-admin-muted">
          Failures with too many attempts are blocked from retry until the underlying problem is fixed, such as a missing phone number or provider configuration issue.
        </div>
        <div className="mt-4 space-y-2">
          {notificationEvents.slice(0, 40).map((event) => (
            <label key={event.id} className="flex cursor-pointer gap-3 rounded-xl border border-admin bg-admin-panel p-3 text-sm">
              <input
                type="checkbox"
                checked={notificationSelection.includes(event.id)}
                disabled={!getNotificationRetryState(event).canRetry || event.status === "sent" || event.status === "delivered"}
                onChange={(inputEvent) => {
                  setNotificationSelection((prev) =>
                    inputEvent.target.checked ? [...prev, event.id] : prev.filter((id) => id !== event.id),
                  );
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">
                    {formatNotificationEventType(event.event_type)} | {formatNotificationChannel(event.channel)} | {formatNotificationStatus(event.status)}
                  </p>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getNotificationStateTone(getNotificationRetryState(event).severity)}`}>
                    {getNotificationRetryState(event).label}
                  </span>
                </div>
                <p className="mt-1 text-xs text-admin-muted">
                  Attempts: {event.attempt_count ?? 0} | Last attempt:{" "}
                  {event.last_attempt_at ? new Date(event.last_attempt_at).toLocaleString() : "Not attempted"}
                </p>
                <p className="mt-1 text-xs text-admin-soft">
                  Correlation: {event.correlation_id ?? "n/a"} | Logged {new Date(event.created_at).toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-admin-muted">{getNotificationRetryState(event).detail}</p>
                {event.last_error ? <p className="mt-1 text-xs text-amber-700">Error: {event.last_error}</p> : null}
              </div>
            </label>
          ))}
          {notificationEvents.length === 0 ? (
            <p className="text-sm text-admin-soft">No notification events logged yet.</p>
          ) : null}
        </div>
      </article>
    </section>
  );
}
