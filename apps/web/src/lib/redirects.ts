import { getAppUrl } from "@/lib/urls";

export function getSafeAppPath(input: string | null | undefined, fallback = "/app") {
  if (!input) return fallback;
  if (!input.startsWith("/")) return fallback;
  if (input.startsWith("//")) return fallback;

  try {
    const appUrl = getAppUrl();
    const normalized = new URL(input, appUrl);
    if (normalized.origin !== appUrl) return fallback;
    return `${normalized.pathname}${normalized.search}${normalized.hash}`;
  } catch {
    return fallback;
  }
}
