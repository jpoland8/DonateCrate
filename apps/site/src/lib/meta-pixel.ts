declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function trackMeta(event: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  if (params) {
    window.fbq("track", event, params);
    return;
  }
  window.fbq("track", event);
}

export function trackMetaCustom(event: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  if (params) {
    window.fbq("trackCustom", event, params);
    return;
  }
  window.fbq("trackCustom", event);
}
