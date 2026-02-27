"use client";

import { useEffect } from "react";

const RECOVERY_FLAG = "dc_recovered_connection_closed_v1";

function recoverOnce() {
  if (typeof window === "undefined") return;
  const alreadyRecovered = window.sessionStorage.getItem(RECOVERY_FLAG) === "1";
  if (alreadyRecovered) return;
  window.sessionStorage.setItem(RECOVERY_FLAG, "1");
  window.location.reload();
}

export function ClientRecovery() {
  useEffect(() => {
    function handleErrorEvent(event: ErrorEvent) {
      const message = event.message || "";
      if (message.includes("Connection closed")) recoverOnce();
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message =
        typeof reason === "string"
          ? reason
          : reason && typeof reason.message === "string"
            ? reason.message
            : "";
      if (message.includes("Connection closed")) recoverOnce();
    }

    window.addEventListener("error", handleErrorEvent);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleErrorEvent);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}

