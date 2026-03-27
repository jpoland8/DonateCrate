import Image from "next/image";
import Link from "next/link";
import { getSiteUrl } from "@/lib/urls";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  panelTitle: string;
  panelBody: string;
  panelPoints: string[];
  children: React.ReactNode;
};

export function AuthShell({
  eyebrow,
  title,
  description,
  panelPoints,
  children,
}: AuthShellProps) {
  const siteUrl = getSiteUrl();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Left: Full-bleed brand panel ─────────────────────────── */}
      <div className="relative hidden lg:block lg:w-[52%] xl:w-[56%]">
        {/* Background photo */}
        <Image
          src="/images/hero-doorstep-1200.jpg"
          alt="DonateCrate donation bag on a doorstep"
          fill
          className="object-cover object-center"
          priority
        />
        {/* Depth overlays */}
        <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(12,7,2,0.74)_0%,rgba(18,10,3,0.50)_45%,rgba(8,4,1,0.82)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_top_right,rgba(255,106,0,0.22),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_bottom_left,rgba(255,140,40,0.08),transparent)]" />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-between p-10 xl:p-14">
          {/* Logo */}
          <a href={siteUrl} className="inline-block">
            <Image
              src="/images/logo-provided-520.webp"
              alt="DonateCrate"
              width={160}
              height={40}
              className="h-8 w-auto brightness-0 invert"
            />
          </a>

          {/* Main statement */}
          <div className="max-w-lg">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/25 bg-orange-400/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.26em] text-orange-300/90">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--dc-orange)]" />
              {eyebrow}
            </div>
            <h1 className="mt-5 text-[2.8rem] font-bold leading-[1.05] tracking-tight text-white xl:text-[3.3rem]">
              {title}
            </h1>
            <p className="mt-5 max-w-[400px] text-[0.95rem] leading-[1.75] text-white/58">
              {description}
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-3.5 border-t border-white/[0.11] pt-7">
            {panelPoints.map((point) => (
              <div key={point} className="flex items-start gap-3 text-sm text-white/65">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--dc-orange)]/20 ring-1 ring-[var(--dc-orange)]/30">
                  <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3 text-[var(--dc-orange)]">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {point}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: Form panel ────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-y-auto bg-[#f7f3ef]">
        {/* Mobile nav */}
        <div className="flex items-center justify-between px-6 pt-6 lg:hidden">
          <a href={siteUrl}>
            <Image
              src="/images/logo-provided-520.webp"
              alt="DonateCrate"
              width={150}
              height={38}
              className="h-8 w-auto"
            />
          </a>
          <Link
            href="/login?next=/app"
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[var(--dc-gray-700)] shadow-sm hover:border-[var(--dc-orange)] hover:text-[var(--dc-orange)] transition"
          >
            Sign in
          </Link>
        </div>

        {/* Centered form area */}
        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-[400px]">
            {children}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-black/[0.06] px-6 py-4 text-center">
          <a
            href={siteUrl}
            className="text-xs text-[var(--dc-gray-400)] transition hover:text-[var(--dc-gray-700)]"
          >
            ← Back to DonateCrate.com
          </a>
        </div>
      </div>
    </div>
  );
}
