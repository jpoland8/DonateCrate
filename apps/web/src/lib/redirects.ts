export function getSafeAppPath(input: string | null | undefined, fallback = "/app") {
  if (!input) return fallback;
  if (!input.startsWith("/")) return fallback;
  if (input.startsWith("//")) return fallback;

  try {
    const normalized = new URL(input, "https://app.donatecrate.com");
    if (normalized.origin !== "https://app.donatecrate.com") return fallback;
    return `${normalized.pathname}${normalized.search}${normalized.hash}`;
  } catch {
    return fallback;
  }
}
