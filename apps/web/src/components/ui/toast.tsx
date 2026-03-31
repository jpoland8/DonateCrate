"use client";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";

type ToastType = "success" | "error" | "info" | "warning";

type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
  action?: { label: string; onClick: () => void };
  duration: number;
};

type ToastContextValue = {
  success: (message: string, action?: ToastItem["action"]) => string;
  error: (message: string, action?: ToastItem["action"]) => string;
  info: (message: string, action?: ToastItem["action"]) => string;
  warning: (message: string, action?: ToastItem["action"]) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 5;

function ToastIcon({ type }: { type: ToastType }) {
  switch (type) {
    case "success":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
          <circle cx="10" cy="10" r="8" strokeWidth="1.5" />
          <path d="M6.5 10.5l2.5 2.5 4.5-5" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "error":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
          <circle cx="10" cy="10" r="8" strokeWidth="1.5" />
          <path d="M10 6.5v4M10 13.5h.01" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    case "warning":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
          <path d="M9.14 3.27a1 1 0 0 1 1.72 0l7.14 12.46A1 1 0 0 1 17.14 17H2.86a1 1 0 0 1-.86-1.27L9.14 3.27Z" strokeWidth="1.5" />
          <path d="M10 8v4M10 14h.01" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    case "info":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
          <circle cx="10" cy="10" r="8" strokeWidth="1.5" />
          <path d="M10 9v5M10 6.5h.01" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
  }
}

const TOAST_STYLES: Record<ToastType, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-rose-200 bg-rose-50 text-rose-800",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
};

function ToastCard({
  toast,
  onDismiss,
  visible,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
  visible: boolean;
}) {
  return (
    <div
      role="alert"
      aria-live={toast.type === "error" ? "assertive" : "polite"}
      style={{ pointerEvents: "auto" }}
      className={[
        "flex w-full max-w-[360px] items-start gap-3 rounded-xl border px-4 py-3 shadow-lg transition-all duration-300",
        TOAST_STYLES[toast.type],
        visible
          ? "translate-y-0 opacity-100"
          : "translate-x-full opacity-0",
      ].join(" ")}
    >
      <ToastIcon type={toast.type} />
      <p className="flex-1 text-sm font-medium leading-5">{toast.message}</p>
      {toast.action ? (
        <button
          type="button"
          onClick={() => {
            toast.action!.onClick();
            onDismiss(toast.id);
          }}
          className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          {toast.action.label}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 rounded-md p-0.5 opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current transition-opacity"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
          <path d="M4 4l8 8M12 4l-8 8" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

type ToastState = {
  toast: ToastItem;
  visible: boolean;
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    // Animate out first
    setToasts((prev) =>
      prev.map((ts) => (ts.toast.id === id ? { ...ts, visible: false } : ts)),
    );
    // Remove after animation
    const removeTimer = setTimeout(() => {
      setToasts((prev) => prev.filter((ts) => ts.toast.id !== id));
    }, 300);
    // Store in timers so we can clear if needed
    timersRef.current.set(`remove-${id}`, removeTimer);
  }, []);

  const add = useCallback(
    (type: ToastType, message: string, action?: ToastItem["action"]) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const duration = type === "error" ? 6000 : 4000;
      const item: ToastItem = { id, type, message, action, duration };

      setToasts((prev) => {
        const next = [...prev, { toast: item, visible: false }];
        return next.slice(-MAX_TOASTS);
      });

      // Trigger enter animation on next tick
      setTimeout(() => {
        setToasts((prev) =>
          prev.map((ts) => (ts.toast.id === id ? { ...ts, visible: true } : ts)),
        );
      }, 10);

      // Auto-dismiss
      const autoTimer = setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, autoTimer);

      return id;
    },
    [dismiss],
  );

  // Cleanup on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  const value: ToastContextValue = {
    success: (msg, action) => add("success", msg, action),
    error: (msg, action) => add("error", msg, action),
    info: (msg, action) => add("info", msg, action),
    warning: (msg, action) => add("warning", msg, action),
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Fixed overlay — pointer-events: none so it doesn't block the page */}
      <div
        className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse items-end gap-2 sm:bottom-4 sm:right-4 max-sm:bottom-4 max-sm:right-0 max-sm:left-0 max-sm:items-center max-sm:px-3"
        style={{ pointerEvents: "none" }}
        aria-label="Notifications"
      >
        {toasts.map(({ toast, visible }) => (
          <ToastCard
            key={toast.id}
            toast={toast}
            onDismiss={dismiss}
            visible={visible}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
