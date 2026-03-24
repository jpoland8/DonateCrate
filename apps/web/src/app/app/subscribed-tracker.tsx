"use client";

import { useEffect } from "react";
import { trackMeta, trackMetaCustom } from "@/lib/meta-pixel";

export function SubscribedTracker({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    trackMeta("Subscribe", {
      value: 5,
      currency: "USD",
      predicted_ltv: 60,
    });
    trackMetaCustom("Subscribed", {
      value: 5,
      currency: "USD",
    });
  }, [enabled]);

  return null;
}
