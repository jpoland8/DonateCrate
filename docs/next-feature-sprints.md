# DonateCrate Next Feature Sprints

## Completed Sprint Set 1
- Conversion funnel clarity and signup continuity.
- Customer cycle-state visibility and profile completeness cues.
- Admin dispatch readiness, route preview, and assignment guardrails.
- Reliability groundwork: correlation IDs plus richer Stripe and notification event state.

## Sprint F: Quality Gates + Platform Hygiene
- Add a runnable automated test path for pure business logic.
- Fix lint so it evaluates source files rather than generated `.open-next` output.
- Remove known frontend hook violations that currently block meaningful lint review.
- Document the new execution baseline and remaining gaps.

## Sprint G: Driver Operations
- Driver portal for route check-in, stop notes, and completion scans.
- Proof-of-pickup photo support on stops.
- Route status timeline in admin.
- Stop-level exception reasons (no bag, no access, reschedule).

## Sprint H: Messaging Automation
- Background jobs for reminder sends and retries.
- Admin retry actions for failed notifications.
- Pickup reminder cadence (T-3 days, T-1 day, day-of).
- Billing and pickup event timeline views in admin.

## Sprint I: Growth + Neighborhood Expansion
- Ambassador landing pages for apartments and HOAs with tracked attribution.
- Zone heatmap for demand density and route viability.
- Referral leaderboard and monthly bonus campaigns.
- Waitlist-to-zone conversion reporting for launch decisions.
