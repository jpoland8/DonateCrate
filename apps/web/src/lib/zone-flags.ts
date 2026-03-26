const DEMO_ZONE_CODES = new Set([
  "test-sandbox-knoxville",
  "partner-hope-west-knox",
]);

export function isDemoOnlyZone(zone: { demo_only?: boolean | null; code?: string | null; name?: string | null }) {
  if (zone.demo_only === true) return true;
  const code = zone.code?.trim().toLowerCase() ?? "";
  const name = zone.name?.trim().toLowerCase() ?? "";
  return DEMO_ZONE_CODES.has(code) || code.includes("sandbox") || code.startsWith("test-") || name.includes("sandbox") || name.startsWith("test -");
}
