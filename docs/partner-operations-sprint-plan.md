# DonateCrate Partner Operations Sprint Plan

## Goal

Add a partner-operated fulfillment model without breaking the current DonateCrate-operated employee-driver flow.

This rollout keeps DonateCrate as the platform owner for:
- subscriptions and billing
- customer-facing reminder copy
- pricing and revenue policy
- platform-wide support and messaging controls

It adds scoped nonprofit capabilities for:
- assigned market and zone operations
- pickup calendar management within platform guardrails
- route execution and stop updates
- partner branding for receipts and selected partner-visible surfaces

## Foundations Landed In This Slice

- additive user roles:
  - `partner_manager`
  - `partner_operator`
- nonprofit partner records
- partner memberships
- zone operation model metadata:
  - `donatecrate_operated`
  - `partner_operated`
- route-level partner metadata
- partner branding records
- partner receipt template records
- partner custom-domain connection records for receipt sending

Current employee-driver features remain the source of truth for live routing and dispatch.

## Non-Breaking Rules

- Keep every new schema change additive and nullable unless the current code is updated in the same sprint.
- Do not change existing customer billing flows while partner ops are being introduced.
- Do not grant partner roles access to the current admin workspace by accident.
- Reuse the existing route, pickup request, and notification systems before introducing parallel partner-only versions.
- Any new partner capability must ship behind role checks and partner scoping.

## Sprint 1: Data Model and Access Guardrails

- Goal:
  - create the partner data model and permission scaffolding without changing user-facing behavior
- Scope:
  - add nonprofit, membership, branding, receipt-template, and domain-connection tables
  - add zone and route fields for partner operation metadata
  - extend role handling for partner users
  - centralize access helpers so unfinished partner roles do not inherit admin screens
- Done criteria:
  - current customer, admin, and driver flows still work
  - migrations are forward-only
  - partner roles exist but have no accidental elevated UI access

## Sprint 2: Partner Management in Admin

- Goal:
  - let DonateCrate admins configure nonprofit partners without exposing partner UI yet
- Scope:
  - admin CRUD for nonprofit partners
  - partner membership assignment
  - zone assignment and operation model toggles
  - partner payout model configuration
  - partner branding and receipt settings forms
- API targets:
  - new `/api/admin/partners`
  - new `/api/admin/partners/[partnerId]/members`
  - extend `/api/admin/zones`
- Done criteria:
  - admin can create a partner and assign it to a zone
  - admin can mark a zone as `partner_operated`
  - no customer-facing behavior changes yet unless the zone is explicitly configured

## Sprint 3: Partner Portal v1

- Goal:
  - give nonprofit users a constrained operations workspace
- Scope:
  - partner login landing
  - partner-scoped overview for their zones only
  - subscriber list with minimum required fields only:
    - name
    - address
    - phone
    - pickup participation state
  - no subscription cancellation, renewal, or billing access
- UI guidance:
  - do not fork the full admin UI
  - build a narrower portal with partner-safe navigation
- Done criteria:
  - partner users can see only their own zones and members
  - billing, pricing, referrals, and platform messaging remain hidden

## Sprint 4: Pickup Calendar and Route Operations

- Goal:
  - let partner-operated zones run pickups without changing DonateCrate-operated zones
- Scope:
  - partner-managed pickup date proposal or scheduling, based on `partner_pickup_date_override_allowed`
  - route visibility for partner-operated routes only
  - stop status updates by partner users
  - route assignment model extension:
    - `employee_driver`
    - `partner_team`
- API targets:
  - extend pickup-cycle APIs with partner scope
  - extend route APIs with partner ownership and fulfillment mode
  - extend stop status APIs for partner operators
- Done criteria:
  - partner users can operate their assigned route day
  - DonateCrate driver tools keep working for employee-run zones

## Sprint 5: Notifications and Customer Experience

- Goal:
  - make customer communications partner-aware without surrendering message control
- Scope:
  - show "fulfilled by [partner]" in customer overview for partner-operated zones
  - use DonateCrate-managed reminder templates with partner name interpolation
  - add completion messaging that distinguishes receipt responsibility:
    - partner-issued
    - platform-sent on behalf of partner
    - manual follow-up
- Done criteria:
  - customers know who fulfills their zone
  - reminder copy remains centrally controlled by DonateCrate
  - receipt expectations are explicit

## Sprint 6: Branded Receipts and Domain Connection

- Goal:
  - support branded donation receipts with a partner-owned domain or subdomain
- Product model:
  - DonateCrate sends receipts on behalf of the nonprofit
  - the nonprofit controls brand assets and sender identity within guardrails
- Scope:
  - partner branding settings:
    - display name
    - logo
    - primary/secondary colors
    - receipt footer and signature
  - domain connection flow:
    - domain entry
    - DNS verification
    - mail-from or return-path setup
    - status checks
  - receipt template rendering using partner branding
- Recommended delivery approach:
  - allow a subdomain first, such as `receipts.partner.org`
  - verify domain ownership with DNS
  - use a provider like Postmark or Resend for domain verification and sending
  - keep template structure locked while allowing partner branding fields
- Done criteria:
  - partner can configure receipt branding
  - partner can connect a verified domain
  - receipts can be sent as DonateCrate infrastructure on behalf of the nonprofit

## Domain Connection Notes

- Best first version:
  - partner adds a subdomain dedicated to receipts
  - DonateCrate provides DNS records
  - platform verifies domain ownership and sender alignment
- Why this is safer:
  - easier DNS support than root-domain takeover
  - isolates receipt traffic and protects nonprofit main email reputation
  - cleaner rollback if verification fails
- Minimum statuses:
  - `pending`
  - `pending_dns`
  - `verified`
  - `failed`
  - `disabled`
- Required provider capabilities:
  - SPF/DKIM support
  - bounce handling
  - webhook events for deliverability
  - sender signature verification

## Permissions Matrix

- `admin`
  - full partner setup and payout controls
  - full zone and messaging controls
- `partner_manager`
  - manage partner branding and receipt settings
  - view assigned subscribers and routes
  - manage partner team members
  - no subscription billing or platform copy control
- `partner_operator`
  - execute route-day operations
  - update stops and pickup statuses
  - view only operational member data
  - no branding, payout, or team-management controls
- `driver`
  - unchanged current employee route workflow
- `customer`
  - unchanged customer workflow with future partner attribution in partner-operated zones

## Regression Checklist

- Verify login redirects still send only `admin` and `driver` to `/admin`.
- Verify existing route generation still defaults to `employee_driver`.
- Verify existing zones continue to default to `donatecrate_operated`.
- Verify customer overview still works when no partner is assigned.
- Verify admin user-role updates still work for current roles.
- Verify RLS does not expose partner data to unrelated authenticated users.

## Suggested Build Order

1. Merge the schema and access foundation.
2. Build admin partner management.
3. Build partner-scoped auth and portal shell.
4. Extend pickup-cycle and route flows for partner-operated zones.
5. Add partner-aware customer messaging.
6. Add branded receipt delivery and domain verification.

## Open Decisions

1. Should partner users see member email addresses, or only phone plus address?
2. Should partner pickup dates be fully editable, or only proposed for admin approval?
3. Should revenue share be per active subscriber, per completed stop, or monthly fixed-plus-variable?
4. Should receipts be generated immediately on pickup completion, or after an admin/partner review step?
5. Should the first branded-domain version support only one sending domain per partner?
