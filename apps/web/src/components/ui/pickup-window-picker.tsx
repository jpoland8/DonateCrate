"use client";

import { useEffect, useState } from "react";

// Time slots from 5am to 9pm in 30-minute increments
const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const opts = [];
  for (let h = 5; h <= 21; h++) {
    for (const m of [0, 30]) {
      if (h === 21 && m === 30) break;
      const totalMins = h * 60 + m;
      const ampm = h < 12 ? "am" : "pm";
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const label = m === 0 ? `${hour12}${ampm}` : `${hour12}:${String(m).padStart(2, "0")}${ampm}`;
      opts.push({ value: String(totalMins), label });
    }
  }
  return opts;
})();

/** Format two total-minute values into a window label string e.g. "9am – 1pm" */
function formatWindow(startMins: string, endMins: string): string {
  const s = TIME_OPTIONS.find((o) => o.value === startMins);
  const e = TIME_OPTIONS.find((o) => o.value === endMins);
  if (!s || !e) return "";
  return `${s.label} – ${e.label}`;
}

/** Parse a window label string back to {start, end} in total-minute values */
function parseWindow(label: string | null | undefined): { start: string; end: string } {
  const defaultStart = String(9 * 60); // 9am
  const defaultEnd = String(13 * 60); // 1pm

  if (!label) return { start: defaultStart, end: defaultEnd };

  const match = label.match(
    /^(\d{1,2})(?::(\d{2}))?(am|pm)\s*[–\-]\s*(\d{1,2})(?::(\d{2}))?(am|pm)$/i,
  );
  if (!match) return { start: defaultStart, end: defaultEnd };

  const toMins = (h: string, m: string | undefined, period: string) => {
    let hour = parseInt(h, 10);
    const min = m ? parseInt(m, 10) : 0;
    if (period.toLowerCase() === "pm" && hour !== 12) hour += 12;
    if (period.toLowerCase() === "am" && hour === 12) hour = 0;
    return String(hour * 60 + min);
  };

  return {
    start: toMins(match[1], match[2], match[3]),
    end: toMins(match[4], match[5], match[6]),
  };
}

type Props = {
  /** Current formatted window label e.g. "9am – 1pm" */
  value: string;
  onChange: (value: string) => void;
  /** If provided, a hidden <input> is rendered so uncontrolled forms work */
  name?: string;
  disabled?: boolean;
  /** "admin" uses dc-input-admin classes; "partner" uses dc-input */
  variant?: "admin" | "partner";
  label?: string;
  hint?: string;
};

export function PickupWindowPicker({
  value,
  onChange,
  name,
  disabled = false,
  variant = "admin",
  label,
  hint,
}: Props) {
  const inputClass = variant === "admin" ? "dc-input-admin" : "dc-input";

  const [times, setTimes] = useState(() => parseWindow(value));

  // Sync inward when parent value changes (e.g. when a cycle is selected)
  useEffect(() => {
    setTimes(parseWindow(value));
  }, [value]);

  function handleChange(field: "start" | "end", newVal: string) {
    const next = { ...times, [field]: newVal };
    setTimes(next);
    onChange(formatWindow(next.start, next.end));
  }

  const selectClass = `${inputClass} pr-8`;

  return (
    <div>
      {label && (
        <span className={`text-xs ${variant === "admin" ? "text-admin-muted" : "text-[var(--dc-gray-700)]"}`}>
          {label}
        </span>
      )}
      <div className="mt-1 flex items-center gap-2">
        <select
          value={times.start}
          onChange={(e) => handleChange("start", e.target.value)}
          disabled={disabled}
          className={`${selectClass} flex-1 disabled:opacity-50 cursor-pointer`}
          aria-label="Start time"
        >
          {TIME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className={`shrink-0 text-xs font-medium ${variant === "admin" ? "text-admin-soft" : "text-[var(--dc-gray-500)]"}`}>
          to
        </span>
        <select
          value={times.end}
          onChange={(e) => handleChange("end", e.target.value)}
          disabled={disabled}
          className={`${selectClass} flex-1 disabled:opacity-50 cursor-pointer`}
          aria-label="End time"
        >
          {TIME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {name && (
          <input type="hidden" name={name} value={formatWindow(times.start, times.end)} />
        )}
      </div>
      {hint && (
        <span className={`mt-1 block text-[11px] ${variant === "admin" ? "text-admin-soft" : "text-[var(--dc-gray-500)]"}`}>
          {hint}
        </span>
      )}
    </div>
  );
}
