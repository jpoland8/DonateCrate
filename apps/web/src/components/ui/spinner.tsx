export function Spinner({ size = "md", color = "current" }: {
  size?: "sm" | "md" | "lg";
  color?: "white" | "current" | "orange"
}) {
  const sizes = { sm: "h-3.5 w-3.5", md: "h-[18px] w-[18px]", lg: "h-6 w-6" };
  const colors = { white: "text-white", current: "text-current", orange: "text-[var(--dc-orange)]" };
  return (
    <svg
      className={`animate-spin ${sizes[size]} ${colors[color]} shrink-0`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
