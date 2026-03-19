# DonateCrate Coordinator Plan

## Current State Snapshot

- Platform foundation exists in one Next.js app with Supabase migrations, auth helpers, billing endpoints, pickup APIs, and an admin workspace.
- The current codebase already covers the first pass of epics 1-3 and part of epics 4-6.
- The biggest gaps are now flow clarity, lifecycle completion, operational reliability, and test coverage.

## Dependency Map

### Core dependency chain

1. Supabase schema, auth, and RLS underpin every authenticated route and all admin/customer data access.
2. Eligibility and waitlist determine whether a visitor enters signup or expansion capture.
3. Signup and billing activation gate access to the customer portal and pickup actions.
4. Pickup cycle creation must exist before customer request/skip actions can produce operationally useful data.
5. Confirmed pickup requests feed route generation, driver assignment, and customer timeline updates.
6. Stripe, Twilio, and webhook processing feed billing state, reminders, and support visibility.
7. Reviewer workstream trails each merge tranche and blocks promotion when regressions or missing tests are found.

### Surface-level dependency map by workstream

- Data/platform
  - Enables `customer funnel`, `customer app`, `admin/ops`, and `integrations/reliability`.
  - Owns schema changes needed for pricing versioning, cycle defaults, auditability, and notification retries.
- Customer funnel
  - Depends on `data/platform` for zone state, waitlist storage, user creation, and pricing lookup.
  - Feeds `customer app` with cleaner account setup and better-qualified subscribers.
- Customer app
  - Depends on `data/platform` for profile, subscription, pickup cycle, and referral reads/writes.
  - Depends on `integrations/reliability` for payment state, reminders, and event consistency.
- Admin/ops
  - Depends on `data/platform` for cycle, zone, driver, route, and subscription data integrity.
  - Depends on `customer app` adoption because route density and ops tooling are only useful with real participation.
- Integrations/reliability
  - Depends on `data/platform` for durable event storage and retry state.
  - Supports `customer funnel`, `customer app`, and `admin/ops` with payment sync, messaging, and observability.
- Reviewer
  - Reviews all five delivery workstreams, with priority on migrations, auth/RLS, billing, route generation, and end-user state transitions.

## Coordination Rules

- No shared edits across active delivery agents.
- Shared files are reserved for the reviewer only until a workstream branch merges.
- Work should land in thin slices that are individually lintable and easy to demo.
- UI changes should reduce ambiguity for the end user before adding surface-area complexity.

## Next 5 Parallelizable Tasks

### 1. Funnel clarity and conversion hardening

- Workstream: `customer funnel`
- Why now: the homepage, eligibility result, signup, and checkout handoff are the first visible drop-off points.
- Scope:
  - clarify homepage CTA hierarchy and service expectations
  - convert active eligibility result from generic "Continue to Signup" into a tighter onboarding path
  - prefill signup from waitlist/eligibility context where available
  - add post-checkout success state and billing activation confirmation
- Owned files:
  - `apps/web/src/app/page.tsx`
  - `apps/web/src/components/marketing/eligibility-widget.tsx`
  - `apps/web/src/app/signup/page.tsx`
  - `apps/web/src/app/signup/signup-form.tsx`
  - `apps/web/src/app/app/payment-wall.tsx`
- Inputs:
  - existing eligibility API
  - current `$5/month` launch plan
  - launch zone defaults from `service_zones`
- Deliverable:
  - a clearer visitor-to-account-to-billing funnel with less guesswork and stronger plan confirmation
- Done criteria:
  - user can move from address check to account creation with obvious next steps
  - active-zone copy matches launch behavior
  - payment wall explains blocked state and recovery path

### 2. Customer pickup lifecycle completion

- Workstream: `customer app`
- Why now: customer value is still underspecified after billing; pickup participation should feel complete and trustworthy.
- Scope:
  - expand customer overview with current cycle cutoff, current selection, and last action timestamp
  - add explicit requested/skipped/unskipped feedback and clearer monthly status language
  - tighten profile and onboarding continuity so missing address/phone data is surfaced before pickup actions
  - add lightweight customer timeline messaging for upcoming pickup
- Owned files:
  - `apps/web/src/app/app/page.tsx`
  - `apps/web/src/app/app/customer-actions.tsx`
  - `apps/web/src/app/api/customer/overview/route.ts`
  - `apps/web/src/app/app/profile/page.tsx`
  - `apps/web/src/app/app/onboarding/profile-form.tsx`
- Inputs:
  - `pickup_cycles`
  - `pickup_requests`
  - `subscriptions`
  - notification preference state
- Deliverable:
  - a customer dashboard that explains exactly what will happen this cycle
- Done criteria:
  - current cycle state is visible without needing admin help
  - request/skip actions are confirmed in-place
  - missing profile requirements are obvious before a failed action

### 3. Admin dispatch tranche: route detail and actionability

- Workstream: `admin/ops`
- Why now: admin breadth exists, but route execution still needs tighter operational flow.
- Scope:
  - improve logistics tab around route preview, route assignment, and stop-level clarity
  - expose cycle participation health by zone/date before route generation
  - add support-facing labels for failed or incomplete stop outcomes
  - tighten admin UX language so operations staff can act without reading code-level concepts
- Owned files:
  - `apps/web/src/app/admin/page.tsx`
  - `apps/web/src/app/admin/admin-workspace.tsx`
  - `apps/web/src/app/api/admin/routes/route.ts`
  - `apps/web/src/app/api/admin/routes/preview/route.ts`
  - `apps/web/src/app/api/admin/routes/assign-driver/route.ts`
  - `apps/web/src/app/api/admin/pickup-requests/route.ts`
- Inputs:
  - active cycles
  - confirmed pickup requests
  - driver roster
  - zone configuration
- Deliverable:
  - an ops flow that goes from cycle demand to assigned routes with fewer ambiguous states
- Done criteria:
  - admin can identify which cycle is ready for route generation
  - route preview is understandable at stop level
  - assignment states are visible after action

### 4. Billing and notification reliability tranche

- Workstream: `integrations/reliability`
- Why now: billing state is the system gate, and reminder delivery is currently more foundational than complete.
- Scope:
  - harden Stripe webhook side effects into reusable handlers
  - add internal notification job primitives and retry-ready event statuses
  - wire billing failure and pickup reminder events to auditable records
  - add correlation IDs / structured response metadata for critical operational APIs
- Owned files:
  - `apps/web/src/app/api/webhooks/stripe/route.ts`
  - `apps/web/src/app/api/notifications/preferences/route.ts`
  - `apps/web/src/app/api/admin/communications/sms/route.ts`
  - `apps/web/src/lib/referrals.ts`
  - `apps/web/src/lib/api-auth.ts`
  - `apps/web/src/lib/pickup-defaults.ts`
- Inputs:
  - `stripe_webhook_events`
  - `notification_events`
  - Twilio config
  - subscription and pickup cycle tables
- Deliverable:
  - more reliable event processing with clearer operational observability
- Done criteria:
  - webhook behavior is easier to extend without duplicated side effects
  - failed-payment and reminder event records are traceable
  - critical APIs emit enough metadata for debugging

### 5. Schema/test tranche for next merge wave

- Workstream: `data/platform`
- Why now: feature work above should not add more application logic without schema guardrails and verifiable checks.
- Scope:
  - add the minimum schema support for notification retries, pickup timeline auditing, and pricing version metadata
  - document migration intent and operational expectations
  - establish the first automated test harness for pure business logic and route handlers
- Owned files:
  - `supabase/migrations/*new migration*`
  - `docs/execution-backlog.md`
  - `docs/next-feature-sprints.md`
  - test scaffold files under `apps/web`
- Inputs:
  - current migrations
  - webhook and pickup lifecycle requirements
  - reviewer findings from the first four task branches
- Deliverable:
  - a safer foundation for the next tranche of customer/admin/integration work
- Done criteria:
  - migration is forward-only and scoped
  - docs reflect actual sequencing
  - at least one repeatable automated test path exists

## Agent Briefs

### Agent 1: Data/Platform

- Scope:
  - schema support for retryable notifications, pickup audit events, and pricing version metadata
  - preserve strict RLS assumptions and avoid broad policy churn unless required
- Owned files:
  - `supabase/migrations/*new migration*`
  - `docs/execution-backlog.md`
  - `docs/next-feature-sprints.md`
- Inputs:
  - current migration set
  - Stripe and pickup lifecycle needs from integration/customer workstreams
- Deliverable:
  - one migration tranche and matching docs update
- Done criteria:
  - migration runs cleanly
  - no existing policy regressions introduced
  - data changes are narrow and justified

### Agent 2: Customer Funnel

- Scope:
  - sharpen homepage messaging, eligibility outcomes, signup continuity, and payment-wall clarity
  - reduce vague CTA language and dead-end states
- Owned files:
  - `apps/web/src/app/page.tsx`
  - `apps/web/src/components/marketing/eligibility-widget.tsx`
  - `apps/web/src/app/signup/page.tsx`
  - `apps/web/src/app/signup/signup-form.tsx`
  - `apps/web/src/app/app/payment-wall.tsx`
- Inputs:
  - active zone rules
  - current price and launch assumptions
  - auth registration API
- Deliverable:
  - a tighter visitor-to-paid-member path
- Done criteria:
  - next step is obvious on every eligibility state
  - signup requires less re-entry
  - blocked billing state is understandable

### Agent 3: Customer App

- Scope:
  - improve cycle-state visibility, pickup controls, profile completeness cues, and member confidence
  - keep logic focused on monthly pickup behavior, not future ad-hoc complexity
- Owned files:
  - `apps/web/src/app/app/page.tsx`
  - `apps/web/src/app/app/customer-actions.tsx`
  - `apps/web/src/app/api/customer/overview/route.ts`
  - `apps/web/src/app/app/profile/page.tsx`
  - `apps/web/src/app/app/onboarding/profile-form.tsx`
- Inputs:
  - subscription status
  - current cycle and current request state
  - notification preferences
- Deliverable:
  - a more complete customer self-serve dashboard
- Done criteria:
  - customer can understand current month status immediately
  - request/skip flows confirm the resulting state
  - onboarding/profile gaps are surfaced before confusion

### Agent 4: Admin/Ops

- Scope:
  - improve dispatch workflow, route preview readability, and support/operator language
  - keep scope on existing `/admin` surface, not a new standalone tool
- Owned files:
  - `apps/web/src/app/admin/page.tsx`
  - `apps/web/src/app/admin/admin-workspace.tsx`
  - `apps/web/src/app/api/admin/routes/route.ts`
  - `apps/web/src/app/api/admin/routes/preview/route.ts`
  - `apps/web/src/app/api/admin/routes/assign-driver/route.ts`
  - `apps/web/src/app/api/admin/pickup-requests/route.ts`
- Inputs:
  - pickup cycle data
  - route data
  - driver data
  - zone settings
- Deliverable:
  - an admin logistics flow that is easier to run live
- Done criteria:
  - admin can decide when to generate routes
  - driver assignment and stop state are legible
  - operator copy avoids implementation jargon

### Agent 5: Integrations/Reliability

- Scope:
  - Stripe webhook organization, notification-event durability, retry scaffolding, and API observability
  - no large UI work unless required for debug visibility
- Owned files:
  - `apps/web/src/app/api/webhooks/stripe/route.ts`
  - `apps/web/src/app/api/notifications/preferences/route.ts`
  - `apps/web/src/app/api/admin/communications/sms/route.ts`
  - `apps/web/src/lib/referrals.ts`
  - `apps/web/src/lib/api-auth.ts`
  - `apps/web/src/lib/pickup-defaults.ts`
- Inputs:
  - Stripe event model
  - notification tables
  - current customer/admin API contracts
- Deliverable:
  - more durable event handling with clearer debugging signals
- Done criteria:
  - duplicate side effects are avoided
  - event failures are visible and retryable
  - critical handlers are easier to extend safely

### Agent 6: Reviewer

- Scope:
  - review each tranche for bugs, regressions, security issues, and missing tests
  - prioritize migrations, auth boundaries, billing state transitions, and route generation logic
- Owned files:
  - none for delivery; review comments only unless explicitly fixing approved issues
- Inputs:
  - each branch diff
  - build/lint output
  - migration notes
- Deliverable:
  - findings with severity, affected files, and missing verification
- Done criteria:
  - each merge tranche gets a clear go/no-go call
  - unresolved risk is explicit before merge

## Feature Enrichment Queue

- Add a checkout success state with "what happens next" messaging.
- Add accepted-items guidance and prep standards inside signup and customer portal, not only on the homepage.
- Add customer-visible cycle cutoff time and next reminder expectation.
- Add admin waitlist-to-zone conversion indicators so expansion decisions are easier.
- Add a route exception taxonomy that maps directly to customer communications.
- Add audit-focused event timeline views for billing and pickup history.

## Merge Order

1. `data/platform` if a migration is required by any of the first-wave branches.
2. `customer funnel` because it improves acquisition without deep cross-branch coupling.
3. `customer app` because it depends on the billing and cycle model but not on admin UI.
4. `admin/ops` after customer pickup state is clearer and current cycle semantics are settled.
5. `integrations/reliability` either before or after admin depending on whether it introduces shared schema changes; if independent, merge before admin so event traces are available during ops testing.
6. `reviewer` signs off on each tranche before the next dependency-heavy merge.

## Review Checkpoints

### Checkpoint A: Before any schema merge

- verify migration scope is minimal
- verify RLS changes are intentional
- verify no backfill assumption is hidden in app code

### Checkpoint B: After customer funnel merge

- verify signup still works end to end
- verify active/pending/waitlist states route correctly
- verify homepage CTA copy matches actual app behavior

### Checkpoint C: After customer app merge

- verify current cycle state is correct for requested, skipped, and untouched users
- verify billing-gated users do not access pickup actions incorrectly
- verify profile completeness checks do not strand existing users

### Checkpoint D: After admin/ops merge

- verify route generation still respects current request set
- verify driver assignment cannot silently fail
- verify operator labels match actual statuses stored in data

### Checkpoint E: After integrations/reliability merge

- verify Stripe dedupe still works
- verify event logging remains idempotent
- verify retry/error states are observable and not swallowed

## Immediate Coordination Notes

- Do not let the funnel agent edit customer portal files beyond `payment-wall`.
- Keep the customer app agent out of `/admin` and webhook code.
- Keep the integration agent out of page-level UI unless exposing an operational status is unavoidable.
- Route all reviewer attention first to `supabase/migrations`, Stripe webhook handling, and pickup state transitions.
