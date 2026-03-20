export const MAX_NOTIFICATION_ATTEMPTS = 3;

export type NotificationRetryState = {
  canRetry: boolean;
  severity: "healthy" | "attention" | "blocked";
  label: string;
  detail: string;
};

export function getNotificationRetryState(event: {
  status: string;
  attempt_count?: number | null;
  last_error?: string | null;
}) {
  const attempts = event.attempt_count ?? 0;

  if (event.status === "sent" || event.status === "delivered") {
    return {
      canRetry: false,
      severity: "healthy" as const,
      label: "Delivered",
      detail: "This notification already left the queue successfully.",
    };
  }

  if (event.status === "queued") {
    return {
      canRetry: true,
      severity: "attention" as const,
      label: "Queued",
      detail: attempts > 0 ? "Queued again after a prior failure." : "Waiting to be processed by the sender.",
    };
  }

  if (event.status === "failed" && attempts >= MAX_NOTIFICATION_ATTEMPTS) {
    return {
      canRetry: false,
      severity: "blocked" as const,
      label: "Retry limit reached",
      detail: event.last_error
        ? `Fix the underlying issue before retrying again: ${event.last_error}`
        : "Fix the underlying issue before retrying again.",
    };
  }

  if (event.status === "failed") {
    return {
      canRetry: true,
      severity: "attention" as const,
      label: "Needs retry",
      detail: event.last_error
        ? `Latest error: ${event.last_error}`
        : "Delivery failed and can be queued again.",
    };
  }

  return {
    canRetry: false,
    severity: "attention" as const,
    label: "Review event",
    detail: "This notification status should be checked before retrying.",
  };
}
