export function isResolvedStopStatus(status: string) {
  return ["picked_up", "no_access", "not_ready", "rescheduled", "missed"].includes(status);
}

export function deriveRouteStatus(params: {
  driverId: string | null;
  stopStatuses: string[];
}) {
  const { driverId, stopStatuses } = params;
  if (stopStatuses.length === 0 || stopStatuses.every((status) => status === "scheduled")) {
    return driverId ? "assigned" : "draft";
  }

  return "in_progress";
}
