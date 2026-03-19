export function formatNotificationEventType(eventType: string) {
  switch (eventType) {
    case "billing_payment_failed":
      return "Billing payment failed";
    case "admin_sms_campaign":
      return "Admin SMS campaign";
    case "pickup_reminder_72h":
      return "72-hour pickup reminder";
    case "pickup_reminder_24h":
      return "24-hour pickup reminder";
    case "pickup_reminder_day_of":
      return "Day-of pickup reminder";
    case "pickup_reminder_manual":
      return "Manual pickup reminder";
    default:
      return eventType.replaceAll("_", " ");
  }
}

export function formatNotificationStatus(status: string) {
  switch (status) {
    case "queued":
      return "Queued";
    case "sent":
      return "Sent";
    case "delivered":
      return "Delivered";
    case "failed":
      return "Failed";
    default:
      return status.replaceAll("_", " ");
  }
}
