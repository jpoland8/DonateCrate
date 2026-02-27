import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

const envPath = path.resolve(process.cwd(), '.env.local');
loadEnv(envPath);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const demoUsers = [
  { email: 'admin@donatecrate.app', password: 'DonateCrate!123', role: 'admin', fullName: 'DonateCrate Admin' },
  { email: 'jake@donatecrate.com', password: 'TempPass123!', role: 'admin', fullName: 'Jake DonateCrate' },
  { email: 'sarah@donatecrate.app', password: 'DonateCrate!123', role: 'customer', fullName: 'Sarah Parker' },
  { email: 'mike@donatecrate.app', password: 'DonateCrate!123', role: 'customer', fullName: 'Mike Johnson' },
  { email: 'driver1@donatecrate.app', password: 'DonateCrate!123', role: 'driver', fullName: 'Driver One' },
];

async function ensureAuthUser(user) {
  const { data: existingList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = existingList?.users?.find((u) => u.email?.toLowerCase() === user.email.toLowerCase());
  if (existing) return existing;

  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { full_name: user.fullName },
  });
  if (error) throw error;
  return data.user;
}

async function seed() {
  const seeded = [];
  for (const user of demoUsers) {
    const authUser = await ensureAuthUser(user);

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .upsert(
        {
          auth_user_id: authUser.id,
          email: user.email,
          full_name: user.fullName,
          role: user.role,
          phone: '865-555-0100',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'auth_user_id' },
      )
      .select('id,email,role')
      .single();

    if (profileError) throw profileError;
    seeded.push({ ...user, userId: profile.id });
  }

  const customerUsers = seeded.filter((u) => u.role === 'customer');
  const driverUser = seeded.find((u) => u.role === 'driver');

  const { data: zone } = await supabase
    .from('service_zones')
    .select('id,code')
    .eq('code', 'knoxville-37922')
    .single();

  const { data: activePlan } = await supabase
    .from('pricing_plans')
    .select('id')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  for (const customer of customerUsers) {
    await supabase.from('addresses').upsert(
      {
        user_id: customer.userId,
        address_line1: customer.email.includes('sarah') ? '1210 Cedar Bluff Rd' : '2000 Northshore Dr',
        city: 'Knoxville',
        state: 'TN',
        postal_code: '37922',
        lat: 35.8736,
        lng: -84.1764,
      },
      { onConflict: 'user_id,address_line1,postal_code' },
    );

    await supabase.from('zone_memberships').upsert(
      {
        user_id: customer.userId,
        zone_id: zone.id,
        status: 'active',
      },
      { onConflict: 'user_id,zone_id' },
    );

    await supabase.from('subscriptions').upsert(
      {
        user_id: customer.userId,
        pricing_plan_id: activePlan.id,
        stripe_customer_id: `cus_demo_${customer.userId.slice(0, 8)}`,
        stripe_subscription_id: `sub_demo_${customer.userId.slice(0, 8)}`,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_subscription_id' },
    );
  }

  const month = new Date();
  month.setDate(1);
  const pickupDate = new Date();
  pickupDate.setDate(pickupDate.getDate() + 10);

  const { data: cycle } = await supabase
    .from('pickup_cycles')
    .upsert(
      {
        zone_id: zone.id,
        cycle_month: month.toISOString().slice(0, 10),
        pickup_date: pickupDate.toISOString().slice(0, 10),
        request_cutoff_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
      },
      { onConflict: 'zone_id,cycle_month' },
    )
    .select('id')
    .single();

  for (const customer of customerUsers) {
    await supabase.from('pickup_requests').upsert(
      {
        user_id: customer.userId,
        pickup_cycle_id: cycle.id,
        status: customer.email.includes('sarah') ? 'requested' : 'confirmed',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,pickup_cycle_id' },
    );

    await supabase.from('notification_preferences').upsert(
      {
        user_id: customer.userId,
        email_enabled: true,
        sms_enabled: true,
      },
      { onConflict: 'user_id' },
    );

    await supabase.from('affiliate_codes').upsert(
      {
        user_id: customer.userId,
        code: `DC${customer.userId.replace(/-/g, '').slice(0, 6).toUpperCase()}`,
      },
      { onConflict: 'user_id' },
    );
  }

  if (customerUsers.length >= 2) {
    const referrer = customerUsers[0];
    const referred = customerUsers[1];
    const referralCode = `DC${referrer.userId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
    const { data: existingReferral } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_user_id', referred.userId)
      .maybeSingle();

    if (existingReferral?.id) {
      await supabase
        .from('referrals')
        .update({
          referrer_user_id: referrer.userId,
          referral_code: referralCode,
          status: 'credited',
        })
        .eq('id', existingReferral.id);
    } else {
      await supabase.from('referrals').insert({
        referrer_user_id: referrer.userId,
        referred_user_id: referred.userId,
        referral_code: referralCode,
        status: 'credited',
      });
    }
  }

  if (driverUser) {
    await supabase.from('drivers').upsert(
      {
        user_id: driverUser.userId,
        employee_id: 'DRV-001',
        active: true,
      },
      { onConflict: 'user_id' },
    );
  }

  const { data: driver } = await supabase.from('drivers').select('id').eq('employee_id', 'DRV-001').maybeSingle();

  const { data: route } = await supabase
    .from('routes')
    .insert({
      zone_id: zone.id,
      pickup_cycle_id: cycle.id,
      driver_id: driver?.id ?? null,
      status: driver?.id ? 'assigned' : 'draft',
    })
    .select('id')
    .single();

  const { data: requestRows } = await supabase
    .from('pickup_requests')
    .select('id')
    .eq('pickup_cycle_id', cycle.id)
    .order('created_at', { ascending: true });

  if (requestRows?.length) {
    await supabase.from('pickup_stops').upsert(
      requestRows.map((row, index) => ({
        route_id: route.id,
        pickup_request_id: row.id,
        stop_order: index + 1,
        status: index === 0 ? 'scheduled' : 'picked_up',
        completed_at: index === 0 ? null : new Date().toISOString(),
      })),
      { onConflict: 'route_id,stop_order' },
    );
  }

  await supabase.from('waitlist_entries').upsert(
    [
      {
        full_name: 'Alex Tenant',
        email: 'alex.waitlist@example.com',
        phone: '865-555-0111',
        address_line1: '120 Main St',
        city: 'Knoxville',
        state: 'TN',
        postal_code: '37919',
        status: 'pending',
      },
      {
        full_name: 'Jordan Neighbor',
        email: 'jordan.waitlist@example.com',
        phone: '865-555-0222',
        address_line1: '220 Parkside Dr',
        city: 'Knoxville',
        state: 'TN',
        postal_code: '37909',
        status: 'contacted',
      },
    ],
    { onConflict: 'email,postal_code' },
  );

  console.log('Seed complete. Demo credentials:');
  for (const user of demoUsers) {
    console.log(`- ${user.email} / ${user.password} (${user.role})`);
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
