# DonateCrate MVP-to-Scale Spec

## 1) Product Goal

Build a neighborhood/apartment donation pickup service that operates like trash/recycling:
- predictable monthly pickup cadence,
- high route density (close-by households),
- simple signup + recurring billing,
- easy "request pickup" and reminders,
- nonprofit drop-off accountability.

Primary business constraint: **avoid sparse customers spread far apart**.

## 1.1 Current Decisions (Locked)

- Launch market: Knoxville, TN.
- Initial service anchor: zip code `37922`.
- Zone style: radius-based service zones.
- Base plan price: `$5/month`.
- Pricing management: editable from admin (using Stripe price versioning).
- Pickup cadence: monthly by default, with architecture for future flexibility.
- Driver model at launch: employee drivers only.

## 2) Core Operating Model

### Service Unit
- `Service Zone`: a geo-bounded area (MVP: zip anchor + radius) with a required minimum density.
- `Pickup Day`: one or more fixed monthly pickup days per zone.

### Customer Experience
1. User checks address eligibility.
2. If zone is active, user subscribes and picks plan/start date.
3. User receives reminders before monthly pickup.
4. User confirms "ready for pickup" (or skips month).
5. Driver picks up bags/crates and marks completion.

### Growth Constraint
- Only allow immediate signup when address is in an `Active Zone`.
- Addresses outside active zones go to `Waitlist` + referral capture.
- Automatically activate zone when waitlist thresholds are reached.

## 3) MVP Scope (Build First)

### Customer App/Web
- Address checker with eligibility result:
  - `Active` -> proceed to signup/payment.
  - `Pending` -> join waitlist + referral link.
- Account page:
  - next pickup date,
  - "Request pickup this cycle" toggle,
  - "Skip this month",
  - payment method management,
  - referral status and credits.

### Ops Admin
- Zone management:
  - create/edit zones,
  - define monthly pickup schedule,
  - view density metrics.
- Driver dispatch board:
  - route by zone and date,
  - assign driver/vehicle,
  - live status counts (scheduled, picked up, missed).
- Manual override tools:
  - force schedule,
  - waive/issue credit,
  - retry notifications.

### Driver App (can be lightweight first)
- Daily route list in stop order.
- One-tap status per stop: `picked_up`, `not_ready`, `no_access`, `rescheduled`.
- Optional proof photo.

## 4) Critical Systems

## 4.1 Service Area + Density Engine
- Use geocoding at signup (Google/Mapbox/Loqate).
- Store lat/lng and zone assignment.
- Launch config (MVP default):
  - anchor zip: `37922`,
  - default radius: `3 miles` (admin configurable),
  - expansion pattern: add nearby zip anchors with their own radius and thresholds.
- Activation rules (example):
  - apartment: 30+ units in same complex, or
  - neighborhood: 40 subscribed households within 2 miles.
- Show users real-time progress bar for pending zones.

## 4.2 Dispatch + Route Optimization
- Inputs:
  - confirmed pickups for date,
  - stop time estimate,
  - driver shift duration,
  - vehicle capacity.
- Route generation:
  - start with heuristic (nearest-neighbor + time window constraints),
  - upgrade later to OR-Tools/Mapbox Optimization API.
- Re-optimization triggers:
  - same-day cancellations,
  - overflow capacity,
  - driver call-out.
- Driver model in MVP:
  - employee profiles only (`employee_id`, shift window, vehicle assignment).
  - contractor/partner org support deferred as a future provider type.

## 4.3 Notifications (Email + SMS)
- Provider options:
  - Email: SendGrid/Postmark.
  - SMS: Twilio.
- Required message types:
  - signup confirmation,
  - billing receipt/failure,
  - pickup reminder (72h + 24h),
  - day-of ETA window,
  - completed pickup confirmation,
  - missed pickup follow-up.
- User controls:
  - channel preference,
  - quiet hours,
  - STOP/opt-out compliance for SMS.

## 4.4 Payments (Stripe)
- Use Stripe Billing subscriptions (monthly plan).
- Launch plan starts at `$5/month`.
- Admin-adjustable pricing rule:
  - Stripe prices are immutable; admin creates a new active price version.
  - New signups use latest active price.
  - Existing subscribers stay on old price unless migration is explicitly run.
- Core flow:
  - create customer,
  - attach payment method,
  - create subscription,
  - webhook-driven state sync.
- Required webhooks:
  - `invoice.paid`,
  - `invoice.payment_failed`,
  - `customer.subscription.updated`,
  - `customer.subscription.deleted`,
  - `checkout.session.completed` (if using Checkout).
- Dunning policy:
  - retry schedule for failed payments,
  - temporary grace period,
  - auto-pause after N failures.

## 4.5 Referrals / Affiliate-lite
- MVP: customer referral credits (double-sided incentive).
- Mechanism:
  - each user gets unique referral code/link,
  - referred friend completes first paid month,
  - both accounts receive 1 free month credit.
- Fraud controls:
  - one credit per payment instrument,
  - anti-self-referral checks,
  - credit cap per quarter.
- Defer full influencer affiliate payouts until core ops are stable.

## 5) Suggested Data Model (High Level)

Primary entities:
- `users`
- `addresses`
- `service_zones`
- `zone_memberships`
- `subscriptions`
- `pickup_cycles` (monthly windows)
- `pickup_requests` (requested/skip/ready states)
- `pickup_stops`
- `routes`
- `drivers`
- `pricing_plans` (versioned, one active plan per market/zone at a time)
- `pickup_policies` (monthly default now; supports future add-on frequency/rules)
- `notification_events`
- `referrals`
- `credits_ledger`
- `nonprofit_dropoffs`

Key design choice: keep a `credits_ledger` table for all billing/referral adjustments to stay auditable.

## 6) State Machines (Important)

### Subscription
`trialing -> active -> past_due -> paused -> canceled`

### Monthly Pickup Participation
`unknown -> requested -> confirmed -> picked_up | not_ready | missed -> closed`

### Zone Lifecycle
`pending -> launching -> active -> paused`

Explicit state machines reduce edge-case bugs as you scale.

## 7) Operational KPIs (Launch Dashboard)

- Zone density: active subscribers per square mile.
- Route efficiency: stops/hour, miles/stop, pickup success rate.
- Unit economics: revenue per stop, cost per stop, margin by zone.
- Reliability: on-time reminder rate, failed notification rate.
- Growth: waitlist-to-active conversion, referral conversion rate.
- Retention: monthly churn, skips per user.

## 8) Rollout Plan (90 Days)

### Phase 1 (Weeks 1-3): Foundations
- Implement zone-based eligibility and waitlist.
- Launch Stripe subscriptions + webhook sync.
- Build pickup request/skip flow.
- Implement core reminder notifications.

### Phase 2 (Weeks 4-7): Ops Reliability
- Admin dispatch board and driver stop status app.
- Basic route optimization and reassignment.
- KPI dashboard v1.

### Phase 3 (Weeks 8-12): Growth Engine
- Referral credits with fraud checks.
- Zone activation automation from waitlist thresholds.
- A/B test reminder timing and referral offers.

## 9) Recommended Tech Architecture

- Backend: Node.js (NestJS/Express) or Rails (pick team strength).
- DB: Postgres + PostGIS for geo queries.
- Queue/Jobs: BullMQ/SQS for notifications and route jobs.
- Frontend: Next.js app (customer + admin), lightweight driver PWA.
- Integrations:
  - Stripe Billing,
  - Twilio SMS,
  - SendGrid/Postmark email,
  - Maps/Geocoding provider.

Non-negotiable: webhook processing must be idempotent.

## 10) Risks and Mitigations

- Low density in early markets:
  - enforce waitlist-first outside active zones.
- Driver variability:
  - standardized stop status reasons and SLA alerts.
- Payment churn:
  - pre-dunning reminders + smart retries.
- Notification deliverability:
  - domain warmup, suppression list hygiene, SMS compliance.

## 11) Immediate Build Checklist

1. Seed Knoxville `37922` zone with radius-based eligibility.
2. Create Stripe `$5/month` launch price and webhook mapping.
3. Build admin pricing version controls (new signups only by default).
4. Build eligibility + waitlist + signup flow.
5. Build monthly pickup request/skip flow with extensible pickup policy model.
6. Add notifications (72h/24h/day-of + completion).
7. Build minimal dispatch + employee driver completion workflow.
8. Add referral credits after billing is stable.

## 12) Decisions Needed From You

1. Confirm the default launch radius for zip `37922` (currently set to `3 miles` as a starting assumption).
2. Set minimum threshold for activating adjacent expansion zones.
