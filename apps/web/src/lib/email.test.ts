import { describe, expect, it, vi } from "vitest";

vi.mock("./urls", () => ({
  getAppUrl: () => "https://app.donatecrate.com",
  getSiteUrl: () => "https://donatecrate.com",
}));

describe("buildNotificationEmailContent", async () => {
  const { buildNotificationEmailContent } = await import("./email");

  it("builds a welcome email", () => {
    const result = buildNotificationEmailContent({
      eventType: "account_welcome",
      recipient: { email: "jake@example.com", fullName: "Jake Poland" },
      metadata: { next_step: "Finish billing to unlock your first pickup request." },
    });

    expect(result.subject).toBe("Welcome to DonateCrate");
    expect(result.text).toContain("Finish billing");
    expect(result.html).toContain("Welcome to DonateCrate");
  });

  it("builds a billing activation email", () => {
    const result = buildNotificationEmailContent({
      eventType: "billing_plan_active",
      recipient: { email: "jake@example.com", fullName: "Jake Poland" },
      metadata: { plan_name: "DonateCrate monthly pickup plan", status_label: "Active" },
    });

    expect(result.subject).toBe("Your DonateCrate plan is active");
    expect(result.text).toContain("request the current pickup cycle");
    expect(result.html).toContain("Billing Activated");
  });

  it("builds a password reset email", () => {
    const result = buildNotificationEmailContent({
      eventType: "auth_password_reset",
      recipient: { email: "jake@example.com", fullName: "Jake Poland" },
      metadata: { reset_link: "https://app.donatecrate.com/reset-password/token" },
    });

    expect(result.subject).toBe("Reset your DonateCrate password");
    expect(result.text).toContain("reset-password");
    expect(result.html).toContain("Reset your password");
  });
});
