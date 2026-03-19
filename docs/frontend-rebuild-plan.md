# DonateCrate Frontend Rebuild Plan

## Objective

Redo the DonateCrate frontend as two clearly separated products:

- `apps/site`: a new Astro marketing frontend focused on conversion, search/eligibility, storytelling, and brand.
- `apps/web`: the authenticated account stack for auth, customer app, admin, driver tools, and API routes.

This keeps the public site fast and expressive without destabilizing the operational product surface that already exists.

## Audit

### Current strengths

- Eligibility, signup, login, billing handoff, customer portal, admin, and API logic already work in one place.
- The public homepage has a usable CTA path and a working address-check widget.
- The account stack already has real customer/admin flows, route tools, billing, and messaging primitives.

### Current frontend problems

- Marketing, auth, customer, admin, and backend concerns all live in one Next app, so every public design change carries platform risk.
- The public visual system is thin: one token layer, generic card patterns, standard layout rhythm, and limited brand expression.
- The homepage copy is serviceable but not persuasive enough for a premium-feeling launch product.
- The search experience is technically functional but still feels like a plain form, not the core decision tool on the page.
- Login and signup are visually disconnected from the public story and do not feel like part of a cohesive product.
- Customer and admin shells are usable but still read like utility software rather than a polished service brand.
- Shared CSS is carrying public and internal themes together, which will get worse as the brand surface grows.

### UX clarity gaps to address

- What DonateCrate is, who it is for, and what happens each month should be obvious in the first screen.
- Search should communicate certainty, address quality, and next steps faster.
- Signup should feel like a guided continuation of the eligibility result, not a separate tool.
- Account surfaces should prioritize calm, status-oriented dashboards over generic tabbed utilities.
- Admin surfaces should read as an operations console with stronger visual hierarchy and fewer ambiguous actions.

## Target Architecture

### App split

- `apps/site`
  - Astro app for public pages
  - home, how it works, accepted items, neighborhoods, FAQ, landing pages, waitlist, contact
  - island-based interactive search/eligibility experience
  - shared brand tokens, art direction, motion, editorial layouts
- `apps/web`
  - Next app for login, signup, auth callback, billing, customer app, admin, driver tools, API routes
  - keeps Supabase SSR/auth, route handlers, Stripe, Twilio, and admin/customer logic

### Boundary rules

- `apps/site` owns all unauthenticated brand pages and top-of-funnel content.
- `apps/web` owns all authenticated surfaces and all API endpoints.
- `apps/site` consumes `apps/web` APIs for eligibility, waitlist, and selected pre-auth actions unless a small shared backend package is extracted later.
- Shared brand tokens/components should live in a dedicated package only after the visual system stabilizes; do not prematurely centralize.

### Routing model

- Public URLs move to Astro where practical:
  - `/`
  - `/how-it-works`
  - `/what-we-take`
  - `/faq`
  - `/neighborhoods`
  - `/waitlist`
- Account URLs stay in Next:
  - `/login`
  - `/signup`
  - `/app`
  - `/admin`
  - `/auth/*`
  - `/api/*`

### Search and eligibility approach

- Preserve the current address lookup and eligibility decision path.
- Rebuild it as a first-class “Service Check” experience with:
  - stronger input hierarchy and clearer prediction states
  - accepted-items and service-area cues near the search bar
  - saved query context into signup and waitlist
  - better result states for `active`, `pending`, and `unserviceable`
  - optional neighborhood-first browsing for visitors who do not want to enter a full street address immediately

## Design Direction

### Brand posture

- Premium utility, not nonprofit boilerplate.
- Modern, civic, warm, and operationally trustworthy.
- Feels more like a high-end local service brand than a generic SaaS dashboard.

### Visual system goals

- Bold typography with more distinct editorial contrast between marketing and account surfaces.
- Rich backgrounds and layered composition instead of mostly flat cards.
- Stronger visual identity around the orange crate concept, route rhythm, curbside pickup, and recurring donation habit.
- Motion used for reveal, guidance, and trust, not decoration.
- Mobile-first layouts that still feel intentional on desktop.

### Recommended style split

- `apps/site`
  - expressive type pairing
  - art-directed sections
  - stronger illustration/photography treatment
  - highly polished search module
- `apps/web`
  - cleaner, calmer, denser system UI
  - more structured dashboards
  - higher readability and action clarity
  - consistent status components and timeline patterns

## What Must Be Preserved

- Eligibility search and address autocomplete
- Waitlist capture
- Signup prefill from eligibility context
- Login and auth callback flow
- Billing handoff and return states
- Customer portal actions
- Admin and driver operations
- Existing APIs and database contracts unless a migration is explicitly planned

## Frontend Rebuild Program

### Sprint 0: Audit and system definition

- inventory current routes, components, dependencies, and visual debt
- define app boundaries and migration rules
- create IA, sitemap, and design principles
- choose Astro stack and baseline conventions

### Sprint 1: Astro foundation

- scaffold `apps/site`
- set up Astro config, TypeScript, Tailwind, asset pipeline, and environment handling
- establish site layout, token layer, typography, navigation, footer, motion primitives
- add shared API client helpers for eligibility and waitlist calls into `apps/web`

### Sprint 2: Public homepage and search rebuild

- rebuild homepage in Astro
- create a premium hero with a redesigned service-check module
- add stronger explanation of cycle, accepted items, and launch area
- build improved search result states and CTA continuity into signup and waitlist

### Sprint 3: Content surfaces and SEO

- build how-it-works, accepted-items, FAQ, neighborhoods, and contact/waitlist pages
- add structured metadata, OG images, and local SEO copy
- add launch-specific neighborhood landing templates

### Sprint 4: Account stack redesign

- redesign Next login and signup pages to match the new brand system
- refresh customer shell and overview experience
- improve app visual clarity around cycle status, pickup actions, and billing state
- keep customer/admin functionality intact while updating layout and component system

### Sprint 5: Admin and ops visual overhaul

- redesign admin shell, top-level information architecture, and key tables/cards
- simplify logistics, people, zones, and communication views
- improve route, cycle, and dispatch clarity with better hierarchy

### Sprint 6: Hardening and migration cleanup

- remove redundant marketing pages from `apps/web`
- verify links, redirects, env vars, analytics, and build/deploy paths
- test responsive behavior, accessibility, search UX, and conversion path integrity

## Dependency Map

1. Architecture decisions come first because file ownership changes the whole execution model.
2. Astro foundation must land before public page redesign work can parallelize.
3. Search/eligibility rebuild depends on API contract stability from the existing Next endpoints.
4. Login/signup redesign depends on final brand tokens from the public visual system.
5. Customer and admin redesign should follow after the public brand language is established, but they can begin once shared UI rules are locked.
6. Removal of marketing pages from `apps/web` happens last, after redirects and parity checks pass.

## Next 5 Parallelizable Tasks

### 1. Architecture split brief

- Workstream: platform/frontend architecture
- Scope:
  - define `apps/site` vs `apps/web` responsibilities
  - choose Astro package setup, env strategy, deployment assumptions, and API integration pattern
  - document migration constraints and redirect strategy
- Owned files:
  - `docs/frontend-rebuild-plan.md`
  - `docs/build-plan.md`
  - root workspace config files if needed later
- Deliverable:
  - approved architecture and migration rules
- Done criteria:
  - file ownership is unambiguous
  - public/account boundaries are fixed
  - deployment path is documented

### 2. Visual system and brand language

- Workstream: design system
- Scope:
  - define typography, color extensions, spacing rhythm, motion, surfaces, and image direction
  - establish public vs account design rules
  - produce component inventory for both stacks
- Owned files:
  - `docs/frontend-rebuild-plan.md`
  - future token files under `apps/site` and `apps/web`
- Deliverable:
  - a practical UI system spec, not just inspiration
- Done criteria:
  - tokens and component categories are defined
  - the public and internal looks are related but distinct

### 3. Search/eligibility experience redesign

- Workstream: customer funnel
- Scope:
  - audit current search UX and API dependencies
  - design a new “Service Check” interaction model
  - define autocomplete, result states, error handling, and CTA handoff
- Owned files:
  - `apps/web/src/components/marketing/eligibility-widget.tsx`
  - future Astro search island files under `apps/site`
- Inputs:
  - `POST /api/places/autocomplete`
  - `POST /api/places/details`
  - `POST /api/eligibility/check`
- Deliverable:
  - search UX brief and implementation-ready state model
- Done criteria:
  - every result state has a clear next action
  - data continuity into signup/waitlist is preserved

### 4. Account stack redesign brief

- Workstream: customer app/account UX
- Scope:
  - audit login, signup, customer shell, and main dashboard UX
  - define redesign principles for authenticated surfaces
  - identify which components can be refreshed without changing behavior
- Owned files:
  - `apps/web/src/app/login/*`
  - `apps/web/src/app/signup/*`
  - `apps/web/src/components/portal/customer-shell.tsx`
  - `apps/web/src/app/app/*`
- Deliverable:
  - account redesign scope map with protected behavior list
- Done criteria:
  - account UI work can proceed without risking auth/billing flows

### 5. Admin/ops redesign brief

- Workstream: admin/ops UX
- Scope:
  - audit admin IA and ambiguous flows
  - identify tab structure changes, information hierarchy, and table/card redesign opportunities
  - prioritize logistics, people, and overview surfaces
- Owned files:
  - `apps/web/src/components/portal/admin-shell.tsx`
  - `apps/web/src/app/admin/*`
- Deliverable:
  - admin redesign brief and merge order
- Done criteria:
  - top-level ops navigation is clearer
  - fragile operational flows are identified before visual edits begin

## Agent Briefs

### Agent 1: Frontend Architecture

- Scope:
  - define Astro + Next split, workspace shape, env handling, and redirect plan
- Owned files:
  - `docs/frontend-rebuild-plan.md`
  - future root config files only after approval
- Inputs:
  - current `apps/web` route structure
  - deploy/runtime constraints
- Deliverable:
  - architecture decision record for the split
- Done criteria:
  - no ambiguity about where future code belongs

### Agent 2: Brand and Visual System

- Scope:
  - create the visual language for both public and authenticated experiences
- Owned files:
  - `docs/frontend-rebuild-plan.md`
  - future token/theme files
- Inputs:
  - current brand colors, logo assets, product positioning
- Deliverable:
  - reusable visual rules and component categories
- Done criteria:
  - UI work can proceed without ad hoc styling decisions

### Agent 3: Public Funnel and Search

- Scope:
  - rebuild the marketing experience around a premium service-check journey
- Owned files:
  - future `apps/site/src/pages/*`
  - future `apps/site/src/components/*`
  - existing eligibility integration touchpoints
- Inputs:
  - current eligibility APIs
  - launch market and service rules
- Deliverable:
  - Astro marketing UI with improved search and conversion paths
- Done criteria:
  - visitor can go from landing to clear qualification outcome quickly

### Agent 4: Account Experience

- Scope:
  - redesign login, signup, and customer app surfaces without changing underlying business logic
- Owned files:
  - `apps/web/src/app/login/*`
  - `apps/web/src/app/signup/*`
  - `apps/web/src/components/portal/customer-shell.tsx`
  - `apps/web/src/app/app/*`
- Inputs:
  - Supabase auth flow
  - billing gating and customer overview APIs
- Deliverable:
  - a more polished, trustworthy account experience
- Done criteria:
  - auth and customer flows remain intact after visual refresh

### Agent 5: Admin and Ops Experience

- Scope:
  - redesign the internal console with stronger hierarchy and clearer workflows
- Owned files:
  - `apps/web/src/components/portal/admin-shell.tsx`
  - `apps/web/src/app/admin/*`
- Inputs:
  - current operations tasks and known confusion points
- Deliverable:
  - clearer internal IA and refreshed operational UI
- Done criteria:
  - ops staff can move through key workflows with less interpretation

### Agent 6: Reviewer

- Scope:
  - review for UI regressions, broken flow continuity, accessibility gaps, and missing tests
- Owned files:
  - none for delivery; review only
- Inputs:
  - all frontend branches
- Deliverable:
  - review findings per tranche
- Done criteria:
  - public/account split does not regress eligibility, auth, billing, or core ops flows

## Merge Order

1. Architecture split brief
2. Astro app scaffold
3. Public visual system and homepage/search rebuild
4. Supporting public content pages
5. Login/signup redesign
6. Customer app redesign
7. Admin redesign
8. Redirect cleanup and marketing-page removal from `apps/web`

## Review Checkpoints

- Checkpoint 1: architecture approval before creating `apps/site`
- Checkpoint 2: API contract review before rebuilding search
- Checkpoint 3: conversion review after Astro homepage and service-check launch
- Checkpoint 4: auth/billing regression review after login/signup refresh
- Checkpoint 5: customer lifecycle regression review after account redesign
- Checkpoint 6: ops usability review after admin redesign
- Checkpoint 7: final accessibility, responsive, and redirect audit before deprecating public pages in `apps/web`

## Recommended Immediate Approach

- Start by creating `apps/site` and moving only the public homepage into Astro.
- Keep search calling the existing Next APIs so backend behavior remains stable.
- Refresh login and signup next so the public-to-account handoff feels cohesive.
- Redesign customer and admin surfaces after the public brand language is locked.
- Remove duplicated marketing routes from `apps/web` only after parity is verified.
