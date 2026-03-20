# Public Release QA

## Sprint QA-1: Secure Auth Redirects
- `done` sanitize `next` parameters before login redirects
- `done` sanitize magic-link callback destinations
- `done` add regression tests for redirect safety

## Sprint QA-2: Funnel Branch Repair
- `done` preserve signup state when falling back to waitlist
- `done` make the waitlist-active-address branch actionable with a signup CTA
- `done` preserve referral code through signup and waitlist handoffs

## Sprint QA-3: Referral and Signup Hardening
- `done` route shared referral links to signup instead of waitlist
- `done` make invalid referral codes non-blocking during signup
- `done` keep query params intact on public `/signup` even if client-side JS fails

## Sprint QA-4: Prelaunch Coverage
- `done` add redirect safety tests
- `done` verify both `apps/site` and `apps/web` still build cleanly
- `done` verify `apps/web` test suite passes
- `done` verify `apps/web` lint passes

## Manual Prelaunch Checklist
- Check the public address search on desktop and mobile.
- Verify active-address flow lands on signup with address fields prefilled.
- Verify inactive-address signup offers a waitlist continuation without losing contact info.
- Verify waitlist with an active address offers a signup continuation instead of a dead-end error.
- Verify referral links land on site `/signup` and still populate worker signup with `ref`.
- Verify customer and admin sidebar collapse behaves like a real icon rail.
- Verify Twilio status is `Verified` in admin communication settings.
- Verify Resend email status changes from `Setup needed` to `Verified` after Resend secrets are added.

## Remaining External Dependency
- Resend still needs to be configured on the `web` worker before email delivery can be considered production-ready.
