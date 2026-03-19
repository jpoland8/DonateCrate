import Image from "next/image";
import Link from "next/link";

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
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8efe4_0%,#f6f3ee_55%,#f1ece6_100%)] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 pb-4">
        <Link href="/" className="inline-flex items-center">
          <Image
            src="/images/logo-provided.png"
            alt="DonateCrate"
            width={190}
            height={48}
            className="h-10 w-auto"
          />
        </Link>
        <div className="hidden items-center gap-2 text-sm font-semibold text-[var(--dc-gray-700)] sm:flex">
          <Link href="/" className="rounded-full px-3 py-2 transition hover:bg-white/70 hover:text-black">
            Marketing Site
          </Link>
          <Link href="/login?next=/app" className="rounded-full bg-black px-4 py-2 text-white transition hover:bg-[var(--dc-orange)]">
            Account Access
          </Link>
        </div>
      </div>

      <main className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative overflow-hidden rounded-[2rem] border border-black/10 bg-[linear-gradient(160deg,#171311_0%,#0d0b0a_100%)] p-8 text-white shadow-[0_30px_80px_rgba(20,14,8,0.18)] sm:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,106,0,0.28),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_24%)]" />
          <div className="relative max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-300">{eyebrow}</p>
            <h1 className="mt-4 text-4xl leading-[1.02] font-bold sm:text-5xl">{title}</h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-white/76 sm:text-lg">{description}</p>

            <div className="mt-8 overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/6">
              <Image
                src="/images/hero-doorstep.jpg"
                alt="DonateCrate donation bag waiting on a doorstep"
                width={900}
                height={650}
                className="h-64 w-full object-cover"
              />
            </div>

            <div className="mt-8 rounded-[1.75rem] border border-white/10 bg-white/6 p-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">What to expect</p>
              <h2 className="mt-2 text-2xl font-bold">{panelTitle}</h2>
              <p className="mt-3 text-sm leading-6 text-white/74">{panelBody}</p>
              <ul className="mt-5 space-y-3 text-sm text-white/84">
                {panelPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--dc-orange)] text-xs font-bold text-white">
                      +
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-black/10 bg-white/92 p-6 shadow-[0_24px_60px_rgba(20,14,8,0.08)] backdrop-blur sm:p-8">
          {children}
        </section>
      </main>
    </div>
  );
}
