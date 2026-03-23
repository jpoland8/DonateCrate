function normalizeUrl(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return fallback;
    }
    return parsed.origin;
  } catch {
    return fallback;
  }
}

export function getAppUrl() {
  return normalizeUrl(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL, "https://app.donatecrate.com");
}

export function getSiteUrl() {
  return normalizeUrl(process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL, "https://donatecrate.com");
}
