# DonateCrate Web App

Next.js app containing:
- public marketing site (`/`),
- customer dashboard shell (`/app`),
- admin panel shell (`/admin`),
- eligibility API starter (`/api/eligibility/check`).

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env template:

```bash
cp .env.example .env.local
```

3. Fill `.env.local` values:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

4. Run:

```bash
npm run dev
```

## Stripe Sandbox (Local Webhooks)

Use Stripe CLI to forward sandbox events to local app:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Set the returned signing secret (`whsec_...`) as `STRIPE_WEBHOOK_SECRET` in `.env.local`.

## Seed Demo Data

Use this to seed auth users and portal test data:

```bash
npm run seed:demo
```

Default seeded credentials:
- `admin@donatecrate.app` / `DonateCrate!123`
- `sarah@donatecrate.app` / `DonateCrate!123`
- `mike@donatecrate.app` / `DonateCrate!123`
- `driver1@donatecrate.app` / `DonateCrate!123`

## Database

Core schema migration is in:
- `../../supabase/migrations/20260225110000_init_donatecrate.sql`
