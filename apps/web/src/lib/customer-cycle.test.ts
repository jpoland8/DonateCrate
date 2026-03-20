import { describe, expect, it } from "vitest";
import { formatCycleStatus, getCustomerNextStep, getCycleUrgency, getNextReminderLabel } from "./customer-cycle";

describe("formatCycleStatus", () => {
  it("formats known statuses for the customer portal", () => {
    expect(formatCycleStatus("requested")).toBe("Ready for pickup");
    expect(formatCycleStatus("skipped")).toBe("Skipped this month");
    expect(formatCycleStatus("completed")).toBe("Pickup completed");
    expect(formatCycleStatus("confirmed")).toBe("Confirmed for route");
  });

  it("falls back for unknown or empty statuses", () => {
    expect(formatCycleStatus(null)).toBe("Awaiting your response");
    expect(formatCycleStatus("missed")).toBe("Pickup missed");
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

describe("getCycleUrgency", () => {
  it("shows a locked state after the cutoff", () => {
    expect(
      getCycleUrgency("2026-03-06", "2026-03-03T10:00:00Z", new Date("2026-03-04T10:00:00Z")).label,
    ).toBe("This cycle is locked");
  });

  it("shows a near-term state when pickup is within one day", () => {
    expect(
      getCycleUrgency("2026-03-06", "2026-03-05T22:00:00Z", new Date("2026-03-05T11:00:00Z")).label,
    ).toBe("Pickup is coming up this week");
  });
});

describe("getCustomerNextStep", () => {
  it("sends incomplete members to profile first", () => {
    expect(
      getCustomerNextStep({
        profileComplete: false,
        pickupDate: "2026-03-06",
        requestCutoffAt: "2026-03-05T22:00:00Z",
        status: null,
      }).href,
    ).toBe("/app/profile");
  });

  it("shows route-ready guidance for requested pickups", () => {
    expect(
      getCustomerNextStep({
        profileComplete: true,
        pickupDate: "2026-03-06",
        requestCutoffAt: "2026-03-06T22:00:00Z",
        status: "requested",
        now: new Date("2026-03-05T10:00:00Z"),
      }).title,
    ).toBe("Your bag is on the list");
  });
});
