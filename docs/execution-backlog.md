# DonateCrate Execution Backlog

## Launch Defaults (Current)

- Market: Knoxville, TN (`37922` anchor zone).
- Zone model: radius-based eligibility (default `3 miles`, configurable in admin).
- Price: `$5/month`.
- Driver type: employee.
- Pickup policy: monthly now, extendable for future optional pickups.

## Epic 1: Zone Eligibility + Waitlist

### Stories
- As a visitor, I can enter my address and see if service is active.
- As a visitor outside service area, I can join a waitlist and get updates.
- As ops, I can configure activation thresholds per zone.

### API
- `POST /eligibility/check`
- `POST /waitlist/join`
- `GET /zones/:id/progress`

### Acceptance Criteria
- Address is normalized and geocoded.
- Response clearly returns `active`, `pending`, or `unserviceable`.
- Waitlist captures referral code when present.

## Epic 2: Billing + Subscription Lifecycle (Stripe)

### Stories
- As a user, I can start a monthly subscription.
- As a user, I can update payment method.
- As ops, subscription status is synced from Stripe webhooks.
- As ops, I can change launch pricing from the admin panel without code deploys.

### API
- `POST /billing/checkout-session` (or SetupIntent flow)
- `POST /billing/portal-session`
- `POST /webhooks/stripe`

### Acceptance Criteria
- Webhook events are idempotent.
- `invoice.payment_failed` triggers user notification.
- Account status in app matches Stripe source of truth.
- Admin price changes create a new Stripe price and mark it active for new signups.

## Epic 3: Monthly Pickup Participation

### Stories
- As a subscriber, I can mark "pickup requested" for this cycle.
- As a subscriber, I can skip this month.
- As ops, I can see cycle participation status per zone.
- As product, we can later enable add-on pickup options without replacing the monthly model.

### API
- `GET /pickup/cycle/current`
- `POST /pickup/request`
- `POST /pickup/skip`

### Acceptance Criteria
- Requests close at configurable cutoff time before pickup day.
- Users receive confirmation after request/skip action.
- Participation states are auditable by cycle.
- Data model supports both recurring monthly cycles and future ad-hoc pickup requests.

## Epic 4: Dispatch + Driver Workflow

### Stories
- As ops, I can generate routes for confirmed stops by zone/date.
- As ops, I can assign a driver to a route.
- As driver, I can complete stop outcomes in one tap.
- As ops, I can manage employee driver records and shift windows.

### API
- `POST /dispatch/routes/generate`
- `POST /dispatch/routes/:id/assign-driver`
- `POST /driver/stops/:id/status`

### Acceptance Criteria
- Route generation prevents over-capacity assignments.
- Driver stop statuses update customer-visible timeline.
- Failed stops are flagged for follow-up automation.
- Driver assignment is limited to employee drivers in MVP.

## Epic 5: Notifications

### Stories
- As a subscriber, I receive reminders before pickup.
- As a subscriber, I receive completion or miss notifications.
- As ops, I can retry failed sends.

### API
- `POST /notifications/send` (internal/job use)
- `POST /notifications/preferences`

### Acceptance Criteria
- 72h + 24h + day-of reminders are scheduled.
- SMS STOP and channel preferences are respected.
- Delivery events are logged per message.

## Epic 6: Referrals + Credits

### Stories
- As a subscriber, I can share my referral link.
- As a referred user, I receive offer during signup.
- As both users, we get credits after qualifying payment.

### API
- `GET /referrals/me`
- `POST /referrals/apply-code`
- `POST /referrals/qualify` (internal webhook/job)

### Acceptance Criteria
- Credits are applied only after referred invoice is paid.
- Credits post to auditable ledger.
- Duplicate/self-referral attempts are blocked.

## Non-Functional Requirements

- Observability:
  - structured logs with correlation IDs.
  - alerting on webhook failures and route generation failures.
- Security:
  - signed webhook verification.
  - PII encryption-at-rest fields as needed.
- Performance:
  - eligibility check p95 < 500ms after geocode cache warm.
- Reliability:
  - queue-based retries for notifications and webhook side effects.

## Recommended Build Order

1. Epic 1
2. Epic 2
3. Epic 3
4. Epic 5
5. Epic 4
6. Epic 6

## Definition of Done (MVP)

- A user in active zone can sign up, pay, request pickup, receive reminders, and get a completed pickup confirmation.
- Ops can create routes and assign drivers.
- Basic metrics exist for zone density, pickup success, and churn.
