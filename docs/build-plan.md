# DonateCrate Build Plan

## 1) Product Surfaces

Build one unified platform with three role-based experiences:
- Public website (marketing + eligibility + signup funnel).
- Customer dashboard (subscription, pickups, referrals, billing).
- Admin panel (zones, dispatch, drivers, pricing, support, reporting).

All three should run from one codebase with shared components and a shared design system.

## 2) Visual + Brand Direction

Brand foundation:
- Primary: DonateCrate orange.
- Neutrals: black + white.

Design principles:
- High contrast, clean composition, bold typography, strong spacing rhythm.
- Motion used intentionally (hero reveal, state transitions, route-status updates).
- Minimal but premium UI: fewer elements, clearer hierarchy, fast interaction.

Initial design tokens (can be tuned after sampling logo source files):
- `--dc-orange: #ff6a00`
- `--dc-black: #0b0b0b`
- `--dc-white: #ffffff`
- `--dc-gray-900: #171717`
- `--dc-gray-100: #f5f5f5`

## 3) Recommended Architecture

Frontend:
- Next.js (App Router, TypeScript).
- Tailwind + custom token layer for brand consistency.
- Component system in `ui/` shared by marketing, customer, admin.

Backend:
- Next.js server routes for app APIs.
- Background jobs for reminders, route generation, webhook processing.

Data + Auth:
- Supabase Postgres as system of record.
- Supabase Auth (email/password + magic link to start).
- Row Level Security for customer/admin data isolation.

Payments:
- Stripe Billing subscriptions (`$5/month` launch plan).
- Webhook sync for billing state changes.
- Admin-managed pricing versioning.

Messaging:
- Twilio (SMS).
- Postmark or SendGrid (email).

Maps + Routing:
- Geocoding provider (Mapbox or Google).
- Route optimization v1 heuristic; v2 optimization API.

## 4) App Structure

Route groups:
- `(marketing)` for homepage, how it works, FAQ, eligibility checker.
- `(app)` for authenticated customer dashboard.
- `(admin)` for internal operations.

Core modules:
- Eligibility + Zones.
- Subscriptions + Billing.
- Pickup Cycles + Requests.
- Dispatch + Routes + Driver assignments.
- Notifications.
- Referrals + Credit Ledger.
- Reporting.

## 5) Supabase Data Blueprint (MVP)

Tables:
- `users`
- `addresses`
- `service_zones`
- `zone_memberships`
- `subscriptions`
- `pricing_plans`
- `pickup_cycles`
- `pickup_requests`
- `pickup_stops`
- `routes`
- `drivers`
- `notification_events`
- `referrals`
- `credits_ledger`

Security model:
- Customer sees only own account records.
- Admin role can manage all operational records.
- Service role handles system jobs/webhooks.

## 6) Delivery Plan

### Phase 0 (Week 1): Platform Setup
- Initialize Next.js monorepo-style app structure.
- Configure Supabase project, migrations, and RLS baseline.
- Configure Stripe sandbox, Twilio sandbox, email provider sandbox.
- Add CI checks (typecheck, lint, tests, migration checks).

Exit criteria:
- Local dev + staging environments are reproducible.
- Auth works and DB migrations run cleanly.

### Phase 1 (Weeks 2-3): Marketing Site + Signup Funnel
- Build homepage and high-conversion CTA flow.
- Build eligibility checker for Knoxville `37922` radius zone.
- Build waitlist path for out-of-zone users.
- Build checkout + subscription activation.

Exit criteria:
- New user can go from landing page to paid subscription.

### Phase 2 (Weeks 4-5): Customer Dashboard MVP
- Account home: next pickup date, status, notifications.
- Pickup actions: request this cycle, skip this month.
- Billing panel: payment method, invoices, status.
- Referral panel: share link + credits summary.

Exit criteria:
- Subscriber can fully self-serve without manual ops intervention.

### Phase 3 (Weeks 6-7): Admin Panel MVP
- Zone management: radius, thresholds, schedule.
- Driver management: employee records and shifts.
- Dispatch board: generate routes and assign drivers.
- Manual support actions: credit adjustment, pickup override.

Exit criteria:
- Ops can run monthly pickups without external spreadsheets.

### Phase 4 (Weeks 8-9): Driver Workflow + Notifications
- Mobile-friendly driver route view.
- Stop status updates (`picked_up`, `not_ready`, `no_access`, `rescheduled`).
- Reminder/event notification pipelines (72h, 24h, day-of, completion).

Exit criteria:
- End-to-end pickup cycle runs with status traceability.

### Phase 5 (Weeks 10-12): Hardening + Growth
- Referral credit automation on qualifying payment.
- KPI dashboard (density, pickup success, churn, cost per stop).
- Performance tuning and observability alerts.
- Security review + backup/restore drill.

Exit criteria:
- Platform is ready for controlled scale beyond first launch zone.

## 7) Non-Functional Requirements

- Reliability:
  - idempotent webhooks and job retries.
  - audit trail for billing, pickups, credits.
- Performance:
  - eligibility check p95 under 500ms after cache warm.
- Security:
  - strict RLS, signed webhooks, secrets rotation policy.
- UX quality:
  - mobile-first customer and driver flows.
  - consistent branded UI with measurable conversion goals.

## 8) Team Execution Model

Workstreams that run in parallel:
- Product/Design: UX flows, design system, copy.
- Platform/Data: Supabase schema, auth, RLS, migrations.
- Core App: customer and marketing routes.
- Ops Tooling: admin + driver workflows.
- Integrations: Stripe, Twilio, email, maps.

Cadence:
- Weekly planning.
- Mid-week demo.
- End-of-week ship + metrics review.

## 9) Immediate Next Build Tasks

1. Finalize radius default (`3 miles` currently assumed) and zone activation threshold.
2. Create technical repo scaffold (Next.js + Supabase + Stripe wiring).
3. Implement Supabase schema v1 and RLS policies.
4. Build eligibility endpoint + landing page checker component.
5. Build Stripe checkout + webhook sync.

## 10) Definition of MVP Complete

MVP is complete when:
- A Knoxville `37922` resident can subscribe at `$5/month`.
- Customer can request/skip monthly pickup from dashboard.
- Admin can generate/assign routes and track stop outcomes.
- Notifications and billing events are reliable and auditable.
