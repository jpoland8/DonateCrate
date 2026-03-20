# DonateCrate Next Feature Sprints

## Current Baseline

- `apps/site` now exists as the Astro marketing frontend.
- `apps/web` remains the account stack for auth, customer app, admin, driver tools, and API routes.
- Public search now depends on the working Next API surface plus explicit CORS for the Astro origin.
- Login and signup already have a first-pass redesign, but the customer and admin stacks are still visually behind the new public direction.

## Coordination Rules

- Do not let multiple delivery agents edit the same files in the same sprint.
- Keep `apps/site` and `apps/web` work separate unless a sprint is explicitly about handoff behavior.
- Keep API changes narrow and additive where possible; avoid schema churn unless a sprint requires it.
- Reviewer work should gate search, signup, billing, pickup-state, and dispatch changes.

## Sprint J: Public Frontend Polish

- Goal:
  - make the Astro site feel premium, cohesive, and customer-facing across all public pages
- Scope:
  - refine homepage layout, copy, spacing, responsive behavior, and search result presentation
  - redesign accepted-items, FAQ, neighborhoods, and waitlist sections with stronger brand clarity
  - tighten mobile nav/header/footer and public page consistency
- Owned files:
  - `apps/site/src/pages/index.astro`
  - `apps/site/src/pages/how-it-works.astro`
  - `apps/site/src/pages/what-we-take.astro`
  - `apps/site/src/pages/neighborhoods.astro`
  - `apps/site/src/pages/faq.astro`
  - `apps/site/src/pages/waitlist.astro`
  - `apps/site/src/layouts/SiteLayout.astro`
  - `apps/site/src/styles/global.css`
- Done criteria:
  - public pages feel like one product, not one good homepage plus fallback pages
  - mobile and desktop layouts both read cleanly
  - copy is customer-facing and free of product/dev phrasing

## Sprint K: Search and Funnel Conversion

- Goal:
  - turn address search into a confident, high-conversion entry point
- Scope:
  - improve autocomplete loading, failure, selected-address, and eligibility states
  - add richer `active`, `pending`, and `unserviceable` result modules
  - tighten signup and waitlist handoff from public search
  - add result-state analytics hooks or event logging stubs
- Owned files:
  - `apps/site/src/components/marketing/ServiceCheckIsland.tsx`
  - `apps/site/src/components/marketing/WaitlistFormIsland.tsx`
  - `apps/web/src/app/api/places/autocomplete/route.ts`
  - `apps/web/src/app/api/places/details/route.ts`
  - `apps/web/src/app/api/eligibility/check/route.ts`
  - `apps/web/src/app/api/waitlist/join/route.ts`
- Done criteria:
  - search is reliable from `apps/site`
  - every eligibility result has one obvious next step
  - waitlist and signup preserve address context cleanly

## Sprint L: Account Entry and Onboarding

- Goal:
  - make the first authenticated steps feel as polished as the new frontend
- Scope:
  - refine login and signup UI
  - improve billing handoff, success, and recovery states
  - tighten the onboarding path from account creation into profile completion and billing activation
  - reduce duplicate or unclear instructions across signup, onboarding, and payment-wall states
- Owned files:
  - `apps/web/src/components/auth/auth-shell.tsx`
  - `apps/web/src/app/login/page.tsx`
  - `apps/web/src/app/login/sign-in-form.tsx`
  - `apps/web/src/app/signup/page.tsx`
  - `apps/web/src/app/signup/signup-form.tsx`
  - `apps/web/src/app/app/payment-wall.tsx`
  - `apps/web/src/app/app/onboarding/profile-form.tsx`
- Done criteria:
  - the public-to-account handoff feels continuous
  - new users understand what to do next after account creation
  - billing blocked/success/canceled states are visually and verbally clear

## Sprint M: Customer Dashboard Overhaul

- Goal:
  - make the member app feel calm, legible, and habit-forming
- Scope:
  - redesign the customer shell and overview information hierarchy
  - improve monthly cycle visibility, pickup actions, profile status, and referral clarity
  - unify cards, status banners, and timeline patterns
  - tighten mobile behavior across `/app`
- Owned files:
  - `apps/web/src/components/portal/customer-shell.tsx`
  - `apps/web/src/app/app/page.tsx`
  - `apps/web/src/app/app/customer-actions.tsx`
  - `apps/web/src/app/app/customer-portal-tools.tsx`
  - `apps/web/src/app/app/profile/page.tsx`
  - `apps/web/src/app/api/customer/overview/route.ts`
- Done criteria:
  - members can understand current cycle state at a glance
  - pickup actions feel trustworthy and immediate
  - the app reads like a product, not an internal utility

## Sprint N: Admin IA and Dispatch UX

- Goal:
  - make the admin stack operationally clear and visually coherent
- Scope:
  - redesign admin shell navigation and top-level hierarchy
  - improve overview, people, zones, logistics, and communication tabs
  - make route/cycle/driver relationships easier to understand in UI language
  - reduce dense, low-signal card clutter
- Owned files:
  - `apps/web/src/components/portal/admin-shell.tsx`
  - `apps/web/src/app/admin/page.tsx`
  - `apps/web/src/app/admin/admin-workspace.tsx`
  - `apps/web/src/app/api/admin/routes/route.ts`
  - `apps/web/src/app/api/admin/routes/assign-driver/route.ts`
  - `apps/web/src/app/api/admin/routes/preview/route.ts`
- Done criteria:
  - ops users can understand cycles, routes, and assignments without explanation
  - admin layout is visually consistent with the upgraded brand
  - dispatch actions produce clear confirmation and error states

## Sprint O: Messaging, Reliability, and Event UX

- Goal:
  - make the communication layer visible, resilient, and understandable
- Scope:
  - surface better notification history and retry visibility in admin
  - tighten error states and retry messaging for SMS and billing events
  - improve customer-facing event/timeline language
  - add missing tests around notification job and eligibility/funnel behavior
- Owned files:
  - `apps/web/src/lib/notification-jobs.ts`
  - `apps/web/src/lib/notification-labels.ts`
  - `apps/web/src/lib/twilio.ts`
  - `apps/web/src/app/api/admin/notifications/route.ts`
  - `apps/web/src/app/api/notifications/send/route.ts`
  - `apps/web/src/app/api/admin/communications/sms/route.ts`
  - test files under `apps/web/src/lib/*test.ts`
- Done criteria:
  - retry behavior is transparent in admin
  - timeline language is understandable to both ops and customers
  - the most fragile communication paths have test coverage

## Next 5 Parallelizable Tasks

### 1. Public page consistency pass

- Workstream: frontend/brand
- Files:
  - `apps/site/src/pages/how-it-works.astro`
  - `apps/site/src/pages/what-we-take.astro`
  - `apps/site/src/pages/neighborhoods.astro`
  - `apps/site/src/pages/faq.astro`
  - `apps/site/src/pages/waitlist.astro`
- Deliverable:
  - secondary pages visually aligned with the homepage

### 2. Search state refinement

- Workstream: funnel/search
- Files:
  - `apps/site/src/components/marketing/ServiceCheckIsland.tsx`
  - `apps/site/src/components/marketing/WaitlistFormIsland.tsx`
- Deliverable:
  - improved result states, search loading, and handoff clarity

### 3. Login/signup polish

- Workstream: account entry
- Files:
  - `apps/web/src/components/auth/auth-shell.tsx`
  - `apps/web/src/app/login/*`
  - `apps/web/src/app/signup/*`
- Deliverable:
  - stronger auth and onboarding presentation

### 4. Customer shell redesign brief + first pass

- Workstream: customer app
- Files:
  - `apps/web/src/components/portal/customer-shell.tsx`
  - `apps/web/src/app/app/page.tsx`
  - `apps/web/src/app/app/customer-actions.tsx`
- Deliverable:
  - cleaner dashboard hierarchy and improved cycle presentation

### 5. Admin IA cleanup brief

- Workstream: admin/ops
- Files:
  - `apps/web/src/components/portal/admin-shell.tsx`
  - `apps/web/src/app/admin/admin-workspace.tsx`
- Deliverable:
  - revised admin navigation and content hierarchy plan

## Merge Order

1. Sprint J
2. Sprint K
3. Sprint L
4. Sprint M
5. Sprint N
6. Sprint O

## Review Checkpoints

- Checkpoint 1:
  - public page consistency, mobile review, and copy review after Sprint J
- Checkpoint 2:
  - search reliability and eligibility-state review after Sprint K
- Checkpoint 3:
  - auth, onboarding, and billing-state regression review after Sprint L
- Checkpoint 4:
  - customer lifecycle and mobile dashboard review after Sprint M
- Checkpoint 5:
  - admin dispatch usability review after Sprint N
- Checkpoint 6:
  - messaging/retry test review after Sprint O

## Current Status

- Completed
  - Sprint J
  - Sprint K
  - Sprint L
  - Sprint M
  - Sprint N
  - Sprint O
- Adjustments made since the plan was written
  - Sprint N absorbed the newer logistics clarifications already learned during the route-map and Google Maps work, so dispatch UI language now matches the real one-route-per-zone-per-cycle model.
  - Sprint O expanded from a visibility pass into retry-governance logic plus tests, because flat failed-event lists were not enough once Twilio retries and manual requeue actions were in use.
- Next planning note
  - the next sprint block should focus on secondary customer flows, deeper admin tooling, and cross-stack handoff polish rather than more first-pass layout work
