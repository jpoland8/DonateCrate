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
      return "Awaiting your response";
  }
}

export function getCycleUrgency(
  pickupDate: string | null | undefined,
  requestCutoffAt: string | null | undefined,
  now = new Date(),
) {
  if (!pickupDate) {
    return {
      tone: "neutral" as const,
      label: "No pickup date scheduled yet",
      detail: "We will show your next cycle here as soon as your zone calendar is published.",
    };
  }

  if (requestCutoffAt && now > new Date(requestCutoffAt)) {
    return {
      tone: "warning" as const,
      label: "This cycle is locked",
      detail: "The response cutoff has passed, so changes now require manual help from operations.",
    };
  }

  const pickup = new Date(`${pickupDate}T09:00:00`);
  const daysUntilPickup = Math.ceil((pickup.getTime() - now.getTime()) / 86_400_000);

  if (daysUntilPickup <= 1) {
    return {
      tone: "high" as const,
      label: "Pickup day is close",
      detail: "Set your orange bag out before route time and keep your phone nearby for any updates.",
    };
  }

  if (daysUntilPickup <= 3) {
    return {
      tone: "medium" as const,
      label: "Pickup is coming up this week",
      detail: "If you want this month collected, confirm now so your stop stays on the route.",
    };
  }

  return {
    tone: "low" as const,
    label: "You still have time to respond",
    detail: "Confirm or skip this month before the route cutoff and we will take care of the rest.",
  };
}

export function getCustomerNextStep(params: {
  profileComplete: boolean;
  pickupDate: string | null | undefined;
  requestCutoffAt: string | null | undefined;
  status: string | null | undefined;
  now?: Date;
}) {
  const { profileComplete, pickupDate, requestCutoffAt, status, now = new Date() } = params;

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

  if (requestCutoffAt && now > new Date(requestCutoffAt)) {
    return {
      title: "This month is locked",
      detail: "The route cutoff has passed. Review reminders and activity while the current cycle runs.",
      href: "/app?tab=settings",
      cta: "View account activity",
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
      detail: "If plans changed, undo the skip before the cutoff so your stop can go back onto the route.",
      href: "/app?tab=pickups",
      cta: "Update cycle",
    };
  }

  return {
    title: "Tell us about this month",
    detail: "Confirm pickup if your orange bag will be out, or skip the visit if you need another cycle.",
    href: "/app?tab=pickups",
    cta: "Choose pickup status",
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
