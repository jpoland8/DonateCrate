import { describe, expect, it } from "vitest";
import { MAX_NOTIFICATION_ATTEMPTS, getNotificationRetryState } from "./notification-health";

describe("getNotificationRetryState", () => {
  it("allows queued events to be processed", () => {
    expect(getNotificationRetryState({ status: "queued", attempt_count: 0 }).canRetry).toBe(true);
  });

  it("blocks failed events after the max attempt count", () => {
    const state = getNotificationRetryState({
      status: "failed",
      attempt_count: MAX_NOTIFICATION_ATTEMPTS,
      last_error: "Invalid destination phone",
    });

    expect(state.canRetry).toBe(false);
    expect(state.label).toBe("Retry limit reached");
  });

  it("keeps ordinary failed events retryable", () => {
    const state = getNotificationRetryState({
      status: "failed",
      attempt_count: 1,
      last_error: "Temporary provider error",
    });

    expect(state.canRetry).toBe(true);
    expect(state.label).toBe("Needs retry");
  });
});
