# Supabase Auth Ops

## What is live now

- `auth.users` signup is linked to `public.users` via trigger `on_auth_user_created`.
- RLS is enabled on core DonateCrate tables.
- Customer access is scoped to own records; admin access uses `public.users.role = 'admin'`.

## Promote first admin

After signing in once with your email, run this SQL in Supabase SQL Editor:

```sql
update public.users
set role = 'admin',
    updated_at = now()
where email = 'you@example.com';
```

## Verify migrations

From repo root:

```bash
supabase migration list --workdir /Users/jakepoland/donatecrate
```

Expected remote entries:
- `20260225110000`
- `20260225113000`
