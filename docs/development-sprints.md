# DonateCrate Sprint Plan

## Sprint Cadence

- Sprint length: 2 weeks
- Start date: Monday, March 2, 2026
- Demo: second Thursday of each sprint
- Release: second Friday of each sprint
- Planning: following Monday morning

## Current State (As of February 25, 2026)

- Web app scaffold is running (marketing, customer shell, admin shell).
- Supabase project is linked and migrations are pushed.
- Supabase auth (magic link) and baseline RLS are in place.
- Brand-aligned landing page is live in code.

## Sprint 1 (March 2 - March 13, 2026): Eligibility + Onboarding

Goal:
- Convert visitors into either active eligible signups or high-quality waitlist records.

Scope:
- Implement address capture and geocode pipeline.
- Evaluate service eligibility against `service_zones` radius rules.
- Persist waitlist entries for out-of-zone users.
- Build onboarding flow for customer profile completion.

Acceptance criteria:
- Address checker returns `active | pending | unserviceable` with deterministic logic.
- Waitlist captures `name`, `email`, `phone`, `address`, `referral_code`.
- User profile in `public.users` is complete after first login.

Dependencies:
- Geocoding provider key.
- Final default radius and pending-zone activation threshold.

## Sprint 2 (March 16 - March 27, 2026): Billing + Subscription State

Goal:
- Launch paid subscription flow with Stripe as source of truth.

Scope:
- Stripe Checkout session API.
- Stripe webhook processor with idempotency table.
- Subscription status reconciliation into `subscriptions`.
- Customer billing panel (status + basic billing actions).

Acceptance criteria:
- New user can complete checkout and become `active`.
- `invoice.payment_failed` updates status and creates a notification event.
- Webhooks can be replayed without duplicate side effects.

Dependencies:
- Stripe product/price setup finalized (`$5/month` initial price).

## Sprint 3 (March 30 - April 10, 2026): Pickup Cycle Operations

Goal:
- Run monthly pickup intent capture reliably.

Scope:
- Admin creates monthly `pickup_cycles`.
- Customer can request pickup or skip current cycle.
- Request cutoff enforcement.
- Basic reminder scheduling jobs (72h, 24h, day-of placeholders).

Acceptance criteria:
- One full cycle can be created and managed end-to-end.
- Customer state transitions are auditable.
- Late requests are blocked after cutoff.

Dependencies:
- Notification provider accounts provisioned.

## Sprint 4 (April 13 - April 24, 2026): Dispatch + Driver Tools

Goal:
- Enable operations to execute pickup day without spreadsheet fallback.

Scope:
- Route generation v1 (heuristic ordering).
- Employee driver assignment.
- Driver mobile workflow for stop status updates.
- Admin stop timeline and exception queue.

Acceptance criteria:
- Admin can generate routes for a cycle and assign drivers.
- Driver can update `picked_up | not_ready | no_access | rescheduled`.
- Failed stops are visible for follow-up.

Dependencies:
- Employee driver roster and shift definitions.

## Sprint 5 (April 27 - May 8, 2026): Notifications + Support Console

Goal:
- Improve reliability and reduce manual customer support load.

Scope:
- Twilio SMS and transactional email integration.
- Notification delivery logging and retries.
- Admin support actions:
  - manual pickup override,
  - account credit issuance,
  - communication resend.

Acceptance criteria:
- Notifications have delivery state tracking.
- Retry mechanism works for transient failures.
- Manual support actions write auditable ledger/events.

Dependencies:
- Sender domains/numbers configured and verified.

## Sprint 6 (May 11 - May 22, 2026): Referrals + KPI Dashboard

Goal:
- Activate growth loop and operational performance visibility.

Scope:
- Referral code generation and apply flow.
- Credit posting after qualifying referred payment.
- Anti-abuse checks (self-referral + payment instrument dedupe).
- KPI dashboard:
  - active subscribers,
  - zone density,
  - pickup completion rate,
  - referral conversion,
  - churn.

Acceptance criteria:
- Double-sided referral credit works and is ledger-backed.
- KPI dashboard is populated from production data tables.

Dependencies:
- Stripe webhook events stable in production-like environment.

## Backlog Immediately After Sprint 6

- Route optimization v2 (distance/time-aware optimizer).
- Zone auto-activation engine from waitlist density.
- Optional add-on pickups beyond monthly baseline.
- Driver app offline mode.
- Vercel production hardening and staged rollout controls.

## Non-Negotiable Engineering Rules

- Idempotent webhook/event processors.
- RLS-enabled tables remain protected and test-covered.
- Every sprint includes:
  - migration scripts,
  - rollback path,
  - smoke test checklist,
  - one-day bugfix buffer.

## Next Planning Meeting Output (Required)

Before Sprint 1 starts, lock:
1. Geocoding provider choice.
2. Launch radius value for zip `37922`.
3. Adjacent-zone activation threshold.
4. Stripe live pricing object IDs.
5. Notification provider selection (SendGrid/Postmark + Twilio).
