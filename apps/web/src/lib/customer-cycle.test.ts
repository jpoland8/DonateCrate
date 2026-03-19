import { describe, expect, it } from "vitest";
import { formatCycleStatus, getNextReminderLabel } from "./customer-cycle";

describe("formatCycleStatus", () => {
  it("formats known statuses for the customer portal", () => {
    expect(formatCycleStatus("requested")).toBe("Pickup requested");
    expect(formatCycleStatus("skipped")).toBe("Skipped this month");
    expect(formatCycleStatus("completed")).toBe("Pickup completed");
  });

  it("falls back for unknown or empty statuses", () => {
    expect(formatCycleStatus(null)).toBe("Awaiting your response");
    expect(formatCycleStatus("missed")).toBe("Awaiting your response");
  });
});

describe("getNextReminderLabel", () => {
  it("shows reminder planning when a pickup is more than three days away", () => {
    const now = new Date("2026-03-01T10:00:00Z");
    expect(getNextReminderLabel("2026-03-06", { email_enabled: true, sms_enabled: false }, now)).toBe(
      "Next reminder planned 72 hours before pickup",
    );
  });

  it("respects disabled reminder preferences", () => {
    expect(getNextReminderLabel("2026-03-06", { email_enabled: false, sms_enabled: false })).toBe(
      "Reminders are turned off",
    );
  });
});
