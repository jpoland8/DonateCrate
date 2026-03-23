# DonateCrate Domain Cutover Checklist

This is the final pass to run as soon as public DNS delegates `donatecrate.com` to Cloudflare.

## Target State

- `donatecrate.com` -> Astro marketing site
- `www.donatecrate.com` -> Astro marketing site
- `app.donatecrate.com` -> account/app worker

## Readiness Checks

Run these first:

```bash
dig +short NS donatecrate.com
dig +short donatecrate.com
dig +short www.donatecrate.com
dig +short app.donatecrate.com
```

Expected:

- nameservers show the Cloudflare pair
- apex resolves through Cloudflare
- `www` resolves to the Pages project
- `app` resolves to the `web` worker

## Product Bindings

In Cloudflare:

- Pages project `donatecrate-site`
  - attach `donatecrate.com`
  - attach `www.donatecrate.com` if desired
- Worker `web`
  - attach `app.donatecrate.com`

## Live Verification

Check:

```bash
curl -I https://donatecrate.com
curl -I https://www.donatecrate.com
curl -I https://app.donatecrate.com
```

Expected:

- apex returns the marketing site
- `www` returns the marketing site or a redirect to apex
- `app` returns the account app, not the Pages site

## Stripe Webhook Switch

After `app.donatecrate.com` is live, create the final Stripe webhook endpoint:

- `https://app.donatecrate.com/api/webhooks/stripe`

Events:

- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`

Then update the worker secret:

- `STRIPE_WEBHOOK_SECRET`

After verification, the temporary `workers.dev` webhook endpoint can be removed from Stripe.

## Cache Purge

After the domain is serving correctly through Cloudflare:

- purge Cloudflare cache for the zone
- verify fresh HTML for both domains

## Smoke Test

1. Open `https://donatecrate.com`
2. Click `Login`
3. Confirm it points to `https://app.donatecrate.com/login?next=/app`
4. Complete signup from the public site
5. Confirm billing checkout returns to `https://app.donatecrate.com/app`
6. Confirm root `https://app.donatecrate.com/` stays on the account app entry, not the marketing redirect
