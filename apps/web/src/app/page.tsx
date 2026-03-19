import Image from "next/image";
import Link from "next/link";
import { EligibilityWidget } from "@/components/marketing/eligibility-widget";

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--dc-white)]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/images/logo-provided.png"
              alt="DonateCrate"
              width={195}
              height={48}
              className="h-10 w-auto"
            />
          </Link>
          <nav className="hidden items-center gap-10 text-lg font-semibold text-white md:flex">
            <a href="#home" className="transition hover:text-[var(--dc-orange)]">
              Home
            </a>
            <a href="#about" className="transition hover:text-[var(--dc-orange)]">
              About Us
            </a>
            <a href="#impact" className="transition hover:text-[var(--dc-orange)]">
              Case Studies
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/app"
              className="rounded-lg border border-[var(--dc-orange)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--dc-orange)] sm:px-4 sm:text-sm"
            >
              Portal
            </Link>
            <Link
              href="/admin"
              className="rounded-lg bg-[var(--dc-orange)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--dc-orange-strong)] sm:px-4 sm:text-sm"
            >
              Admin
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section
          id="home"
          className="relative isolate min-h-[82vh] overflow-hidden bg-[radial-gradient(circle_at_15%_20%,#ff6a0033,transparent_42%),linear-gradient(160deg,#121212_0%,#050505_70%)]"
        >
          <Image
            src="/images/hero-doorstep.jpg"
            alt="DonateCrate donation bag at a doorstep"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/55" />
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:40px_40px]" />
          <div className="absolute right-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-[var(--dc-orange)] blur-3xl opacity-30" />
          <div className="absolute bottom-[-10rem] left-[-4rem] h-80 w-80 rounded-full bg-[var(--dc-orange)] blur-3xl opacity-20" />

          <div className="relative mx-auto flex min-h-[82vh] w-full max-w-7xl items-center px-4 py-12 sm:px-6 sm:py-16">
            <div className="fade-up max-w-3xl text-white">
              <p className="inline-block rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                Knoxville Launch | Zip 37922
              </p>
              <h1 className="mt-6 text-4xl leading-[1.05] font-bold sm:text-5xl md:text-7xl">
                Put Textile Donations on Autopilot for Your Community.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-7 text-white/90 sm:text-xl sm:leading-8">
                DonateCrate is monthly doorstep pickup for clothing, shoes, and linens. We provide the bags,
                send reminders, and handle the route logistics so your household can give consistently without
                extra errands.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
                <a
                  href="#home"
                  className="rounded-full bg-[var(--dc-orange)] px-5 py-3 text-white transition hover:bg-[var(--dc-orange-strong)]"
                >
                  Check My Address
                </a>
                <Link
                  href="/signup"
                  className="rounded-full border border-white/30 px-5 py-3 text-white transition hover:border-[var(--dc-orange)] hover:text-[var(--dc-orange)]"
                >
                  See Launch Signup Flow
                </Link>
              </div>

              <EligibilityWidget />
            </div>
          </div>
        </section>

        <section id="about" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-8 lg:grid-cols-2">
            <article className="rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
              <h2 className="text-3xl font-bold text-black sm:text-4xl">How DonateCrate Works</h2>
              <p className="mt-4 text-lg leading-8 text-[var(--dc-gray-700)]">
                No drop-off lines. No guessing where to take items. We make donating as easy as taking out the
                recycling, with one simple monthly flow.
              </p>
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl bg-[var(--dc-gray-100)] p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--dc-orange)]">Step 1</p>
                  <p className="mt-1 text-xl font-bold">Sign up in under 2 minutes</p>
                </div>
                <div className="rounded-2xl bg-[var(--dc-gray-100)] p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--dc-orange)]">Step 2</p>
                  <p className="mt-1 text-xl font-bold">Fill your orange bag with clean textiles</p>
                </div>
                <div className="rounded-2xl bg-[var(--dc-gray-100)] p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--dc-orange)]">Step 3</p>
                  <p className="mt-1 text-xl font-bold">Set out on pickup day, we handle the rest</p>
                </div>
              </div>
            </article>

            <div className="grid gap-6 sm:grid-cols-2">
              <article className="rounded-3xl border border-black/10 bg-[var(--dc-gray-100)] p-6">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--dc-orange)]">Textiles Accepted</p>
                <h3 className="mt-2 text-2xl font-bold">Clothing + Shoes + Linens</h3>
                <p className="mt-3 text-[var(--dc-gray-700)]">
                  We focus on reusable household textiles and apparel. Keep items clean, dry, and bagged
                  for easy sorting and nonprofit handoff.
                </p>
              </article>
              <article className="rounded-3xl border border-black/10 bg-[var(--dc-gray-100)] p-6">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--dc-orange)]">Prep Standard</p>
                <h3 className="mt-2 text-2xl font-bold">Bagged + Ready by Pickup Day</h3>
                <p className="mt-3 text-[var(--dc-gray-700)]">
                  Residents pack donations in provided bags or crates. We notify ahead of pickup to keep
                  the process smooth and predictable each month.
                </p>
              </article>
              <article className="rounded-3xl border border-black/10 bg-black p-6 text-white sm:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wide text-orange-300">Why People Stick With It</p>
                <h3 className="mt-2 text-2xl font-bold">Low Effort, High Impact, Every Month</h3>
                <p className="mt-3 text-white/80">
                  A predictable monthly rhythm turns one-time cleanouts into a year-round giving habit. That means
                  more reusable textiles diverted from waste and more support for local nonprofit partners.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="bg-black py-16 text-white sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
            <h2 className="text-3xl font-bold sm:text-4xl">Built for Communities That Want to Do More</h2>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-white/80">
              Whether you are a busy resident, apartment manager, or neighborhood organizer, DonateCrate gives your
              community a clean, modern way to donate that people actually use.
            </p>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              <article className="rounded-2xl border border-white/20 bg-white/5 p-6">
                <h3 className="text-2xl font-bold">Never Miss a Donation Month</h3>
                <p className="mt-3 text-white/80">
                  We remind members ahead of pickup so bags are out on time and participation stays strong.
                </p>
              </article>
              <article className="rounded-2xl border border-white/20 bg-white/5 p-6">
                <h3 className="text-2xl font-bold">Designed for Busy Households</h3>
                <p className="mt-3 text-white/80">
                  Easy account tools, reminder notifications, and quick skip/unskip controls keep everything simple.
                </p>
              </article>
              <article className="rounded-2xl border border-white/20 bg-white/5 p-6">
                <h3 className="text-2xl font-bold">Real Local Impact</h3>
                <p className="mt-3 text-white/80">
                  Your clean, reusable textiles are routed into nonprofit channels where they can be used quickly.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section id="impact" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-6 md:grid-cols-3">
            <article className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--dc-orange)]">Case Study</p>
              <h3 className="mt-3 text-2xl font-bold">Apartment Rollout</h3>
              <p className="mt-3 text-[var(--dc-gray-700)]">
                Properties introduced monthly pickup across multiple buildings without adding on-site staff workload.
              </p>
            </article>
            <article className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--dc-orange)]">Case Study</p>
              <h3 className="mt-3 text-2xl font-bold">Neighborhood Adoption</h3>
              <p className="mt-3 text-[var(--dc-gray-700)]">
                Clear reminders and simple bag instructions led to faster adoption and stronger monthly participation.
              </p>
            </article>
            <article className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--dc-orange)]">Case Study</p>
              <h3 className="mt-3 text-2xl font-bold">Textile Diversion + Giving</h3>
              <p className="mt-3 text-[var(--dc-gray-700)]">
                Monthly pickup reduced usable textile waste while increasing recurring donations to nonprofit partners.
              </p>
            </article>
          </div>
        </section>

        <section className="bg-[var(--dc-gray-100)] py-16 sm:py-20">
          <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-2">
            <article className="rounded-3xl bg-white p-8 shadow-sm">
              <h2 className="text-3xl font-bold">Frequently Asked Questions</h2>
              <div className="mt-5 space-y-4 text-[var(--dc-gray-700)]">
                <p>
                  <span className="font-bold text-black">How often are pickups?</span> Pickups are monthly by
                  default, with future flexibility for additional services.
                </p>
                <p>
                  <span className="font-bold text-black">What does it cost?</span> Launch pricing is currently
                  $5/month per household with account tools and reminders included.
                </p>
                <p>
                  <span className="font-bold text-black">How do I know if my address qualifies?</span> Use the
                  postal checker above and we will confirm active service or waitlist status in seconds.
                </p>
              </div>
            </article>

            <article className="rounded-3xl bg-black p-8 text-white shadow-sm">
              <h2 className="text-3xl font-bold">Ready to Start Monthly Pickup?</h2>
              <p className="mt-4 text-white/85">
                Join the Knoxville launch and make donating part of your routine. If your address is outside the
                active zone, join the waitlist and we will notify you first when expansion opens.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="rounded-xl bg-[var(--dc-orange)] px-5 py-3 font-bold text-white transition hover:bg-[var(--dc-orange-strong)]"
                >
                  Create My Account
                </Link>
                <Link
                  href="/waitlist"
                  className="rounded-xl border border-white/30 px-5 py-3 font-bold text-white transition hover:bg-white hover:text-black"
                >
                  Join Waitlist
                </Link>
              </div>
            </article>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/10 bg-white py-8">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
          <p className="text-sm text-[var(--dc-gray-700)]">
            DonateCrate | Making donating simple for neighborhoods and apartment communities.
          </p>
          <p className="text-sm text-[var(--dc-gray-700)]">Knoxville, TN | Zip 37922 Launch</p>
        </div>
      </footer>
    </div>
  );
}
