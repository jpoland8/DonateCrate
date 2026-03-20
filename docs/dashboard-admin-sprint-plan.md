# DonateCrate Dashboard + Admin Sprint Plan

## Objective

Upgrade the authenticated product so the customer dashboard feels habit-forming and calm, and the admin panel feels like a clear operations console rather than a dense internal tool.

## Workstreams

### Sprint DA-1: Shell and Navigation Clarity

- Customer
  - improve sidebar framing, monthly guidance, and mobile header behavior
  - make the portal feel like a member product, not a generic utility shell
- Admin
  - improve sidebar framing, top-level ops guidance, and navigation comprehension
  - clarify which tabs are strategic vs dispatch vs support
- Owned files
  - `apps/web/src/components/portal/customer-shell.tsx`
  - `apps/web/src/components/portal/admin-shell.tsx`
- Done criteria
  - both shells explain what the user can do here
  - navigation feels more intentional on mobile and desktop

### Sprint DA-2: Customer Overview Hierarchy

- Scope
  - tighten header messaging
  - make cycle state, next action, and reminders easier to parse
  - reduce generic explanatory cards in favor of clearer status framing
- Owned files
  - `apps/web/src/app/app/page.tsx`
  - `apps/web/src/app/app/customer-actions.tsx`
  - `apps/web/src/app/app/customer-portal-tools.tsx`
  - `apps/web/src/app/api/customer/overview/route.ts`
- Done criteria
  - member can answer “What do I do this month?” immediately
  - pickup state and reminders are visible without hunting

### Sprint DA-3: Billing and Onboarding Continuity

- Scope
  - improve payment wall, onboarding profile form, and account setup language
  - tighten transition from signup to billing to pickup readiness
- Owned files
  - `apps/web/src/app/app/payment-wall.tsx`
  - `apps/web/src/app/app/onboarding/profile-form.tsx`
- Done criteria
  - a new user understands the last blocked step and what it unlocks

### Sprint DA-4: Admin Overview and Dispatch Readability

- Scope
  - reorganize admin overview and logistics sections
  - make cycle readiness, route status, and assignment order easier to understand
  - reduce ambiguous labels and dense card clutter
- Owned files
  - `apps/web/src/app/admin/admin-workspace.tsx`
  - `apps/web/src/app/admin/page.tsx`
- Done criteria
  - ops can identify what is ready, what is blocked, and what needs action

### Sprint DA-5: Admin Communication and Exception Visibility

- Scope
  - improve notification history, failed-event visibility, and support language
  - make route and pickup exceptions easier to scan
- Owned files
  - `apps/web/src/app/admin/admin-workspace.tsx`
  - `apps/web/src/lib/notification-labels.ts`
- Done criteria
  - failed communication and exception states are understandable at a glance

## Merge Order

1. DA-1
2. DA-3
3. DA-2
4. DA-4
5. DA-5

## Review Checkpoints

- Checkpoint 1
  - shell clarity and mobile nav review
- Checkpoint 2
  - onboarding and billing continuity review
- Checkpoint 3
  - customer “this month” comprehension review
- Checkpoint 4
  - admin logistics and cycle-readiness usability review
- Checkpoint 5
  - communication and exception visibility review

## Execution Status

- Completed
  - DA-1 shell and navigation clarity in `customer-shell.tsx` and `admin-shell.tsx`
  - DA-2 customer hierarchy pass in `/app`, `customer-actions.tsx`, `customer-portal-tools.tsx`, and `/api/customer/overview`
  - DA-3 billing and onboarding continuity in `payment-wall.tsx` and `profile-form.tsx`
  - DA-4 admin overview and dispatch readability in `admin/page.tsx` and `admin-workspace.tsx`
  - DA-5 communication and exception visibility in `admin-workspace.tsx` and `notification-labels.ts`
- Adjustments made during execution
  - folded the newer route-map and Google Maps handoff work into DA-4 so dispatch messaging stayed consistent
  - expanded DA-5 into retry-state logic and tests so failures are classified as retryable vs blocked, not just relabeled in UI
