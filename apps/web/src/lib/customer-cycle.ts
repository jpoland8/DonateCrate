export function formatCycleStatus(status: string | null) {
  switch (status) {
    case "requested":
      return "Pickup requested";
    case "skipped":
      return "Skipped this month";
    case "completed":
      return "Pickup completed";
    default:
      return "Awaiting your response";
  }
}

export function getNextReminderLabel(
  pickupDate: string | null | undefined,
  prefs: { email_enabled?: boolean | null; sms_enabled?: boolean | null } | null,
  now = new Date(),
) {
  if (!pickupDate) return "Pickup date not scheduled yet";
  if (!prefs?.email_enabled && !prefs?.sms_enabled) return "Reminders are turned off";

  const pickup = new Date(`${pickupDate}T09:00:00`);
  const daysUntilPickup = Math.ceil((pickup.getTime() - now.getTime()) / 86_400_000);

  if (daysUntilPickup > 3) return "Next reminder planned 72 hours before pickup";
  if (daysUntilPickup > 1) return "Next reminder planned 24 hours before pickup";
  if (daysUntilPickup >= 0) return "Day-of reminder is next";
  return "Pickup window is in progress or has passed";
}
