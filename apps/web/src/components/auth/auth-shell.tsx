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
  panelTitle,
  panelBody,
  panelPoints,
  children,
}: AuthShellProps) {
  const siteUrl = getSiteUrl();

  return (
    <div className="flex min-h-screen flex-col bg-[linear-gradient(160deg,#f8efe4_0%,#f5f0ea_50%,#f0ebe3_100%)]">
      {/* Top nav */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <a href={siteUrl} className="inline-flex items-center">
          <Image
            src="/images/logo-provided-520.webp"
            alt="DonateCrate"
            width={190}
            height={48}
            className="h-9 w-auto"
          />
        </a>
        <div className="hidden items-center gap-1 text-sm font-semibold text-[var(--dc-gray-600)] sm:flex">
          <a href={siteUrl} className="rounded-full px-3 py-2 transition hover:bg-black/5 hover:text-[var(--dc-gray-900)]">
            Home
          </a>
          <Link
            href="/login?next=/app"
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-[var(--dc-gray-900)] shadow-sm transition hover:border-[var(--dc-orange)] hover:text-[var(--dc-orange)]"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-stretch gap-5 px-4 pb-8 pt-2 sm:px-6 lg:gap-6">
        {/* Left — brand panel */}
        <section className="relative hidden overflow-hidden rounded-[2rem] border border-black/10 bg-[linear-gradient(160deg,#1a1210_0%,#0e0c0b_100%)] p-8 text-white shadow-[0_24px_64px_rgba(20,14,8,0.20)] lg:flex lg:flex-col lg:w-[52%] xl:w-[55%]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,106,0,0.22),transparent_36%),radial-gradient(ellipse_at_bottom_left,rgba(255,180,80,0.06),transparent_32%)]" />
          <div className="relative flex flex-1 flex-col">
            <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-orange-300/90">{eyebrow}</p>
            <h1 className="mt-4 text-[2.6rem] font-bold leading-[1.04] xl:text-5xl">{title}</h1>
            <p className="mt-4 max-w-md text-base leading-7 text-white/68">{description}</p>

            <div className="mt-8 overflow-hidden rounded-[1.5rem] border border-white/10">
              <Image
                src="/images/hero-doorstep-1200.jpg"
                alt="DonateCrate donation bag waiting on a doorstep"
                width={1200}
                height={900}
                sizes="560px"
                className="h-56 w-full object-cover"
              />
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-white/[0.09] bg-white/[0.05] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-orange-300/80">What to expect</p>
              <h2 className="mt-2 text-xl font-bold">{panelTitle}</h2>
              <ul className="mt-4 space-y-2.5 text-sm text-white/78">
                {panelPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--dc-orange)] text-[10px] font-bold text-white">
                      ✓
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Right — form panel */}
        <section className="flex flex-1 flex-col rounded-[2rem] border border-black/[0.08] bg-white/95 px-6 py-8 shadow-[0_16px_48px_rgba(20,14,8,0.07)] backdrop-blur sm:px-8 sm:py-10 lg:max-w-[420px] lg:justify-center xl:max-w-[440px]">
          {children}
        </section>
      </main>
    </div>
  );
}
