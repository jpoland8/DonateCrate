export function formatCycleStatus(status: string | null) {
  switch (status) {
    case "requested":
      return "Ready for pickup";
    case "skipped":
      return "Skipped this month";
    case "confirmed":
      return "Confirmed for route";
    case "picked_up":
      return "Pickup completed";
    case "completed":
      return "Pickup completed";
    case "missed":
      return "Pickup missed";
    case "not_ready":
      return "Marked not ready";
    default:
      return "Included by default";
  }
}

export function getCycleUrgency(
  pickupDate: string | null | undefined,
  now = new Date(),
) {
  if (!pickupDate) {
    return {
      tone: "neutral" as const,
      label: "No pickup date scheduled yet",
      detail: "We will show your next cycle here as soon as your zone calendar is published.",
    };
  }

  const today = now.toISOString().slice(0, 10);

  if (today >= pickupDate) {
    return {
      tone: "warning" as const,
      label: "Pickup is today — responses are locked",
      detail: "Changes are no longer accepted for this cycle. Contact support if you need a manual adjustment.",
    };
  }

  const pickup = new Date(`${pickupDate}T09:00:00`);
  const daysUntilPickup = Math.ceil((pickup.getTime() - now.getTime()) / 86_400_000);

  if (daysUntilPickup <= 1) {
    return {
      tone: "high" as const,
      label: "Pickup is tomorrow",
      detail: "Set your orange bag out before route time and keep your phone nearby for any updates.",
    };
  }

  if (daysUntilPickup <= 3) {
    return {
      tone: "medium" as const,
      label: "Pickup is coming up this week",
      detail: "Your stop stays on the route unless you skip before pickup day.",
    };
  }

  return {
    tone: "low" as const,
    label: "You still have time to make changes",
    detail: "You are included by default. Only skip this month if you do not want a pickup.",
  };
}

export function getCustomerNextStep(params: {
  profileComplete: boolean;
  pickupDate: string | null | undefined;
  status: string | null | undefined;
  now?: Date;
}) {
  const { profileComplete, pickupDate, status, now = new Date() } = params;

  if (!profileComplete) {
    return {
      title: "Finish your profile",
      detail: "Add your phone number and full pickup address so routing and reminders stay accurate.",
      href: "/app/profile",
      cta: "Complete profile",
    };
  }

  if (!pickupDate) {
    return {
      title: "Wait for the next cycle",
      detail: "Your upcoming pickup date has not been published yet. We will notify you when it is ready.",
      href: "/app?tab=settings",
      cta: "Review alerts",
    };
  }

  const today = now.toISOString().slice(0, 10);
  if (today >= pickupDate) {
    return {
      title: "Pickup is today",
      detail: "Set your orange bag out and keep your phone nearby. The route is locked for the day.",
      href: "/app?tab=pickups",
      cta: "View cycle",
    };
  }

  if (status === "requested" || status === "confirmed") {
    return {
      title: "Your bag is on the list",
      detail: "Keep the bag ready and watch for your next reminder as pickup day gets closer.",
      href: "/app?tab=pickups",
      cta: "Review cycle",
    };
  }

  if (status === "skipped") {
    return {
      title: "You are skipped this month",
      detail: "If plans changed, undo the skip before pickup day so your stop goes back on the route.",
      href: "/app?tab=pickups",
      cta: "Update cycle",
    };
  }

  return {
    title: "You are set for this month",
    detail: "Your stop is included by default. Only skip this month if you do not want a pickup.",
    href: "/app?tab=pickups",
    cta: "Review this cycle",
  };
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
