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

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

const demoUsers = [
  { email: 'admin@donatecrate.app', password: 'DonateCrate!123', role: 'admin', fullName: 'DonateCrate Admin' },
  { email: 'jake@donatecrate.com', password: 'TempPass123!', role: 'admin', fullName: 'Jake DonateCrate' },
  {
    email: 'partner.manager@hopefoundation.org',
    password: 'DonateCrate!123',
    role: 'partner_manager',
    fullName: 'Patricia Hope',
    phone: '865-555-0301',
  },
  {
    email: 'partner.operator@hopefoundation.org',
    password: 'DonateCrate!123',
    role: 'partner_operator',
    fullName: 'Oscar Field',
    phone: '865-555-0302',
  },
  {
    email: 'sarah@donatecrate.app',
    password: 'DonateCrate!123',
    role: 'customer',
    fullName: 'Sarah Parker',
    phone: '865-555-0101',
    address: { address_line1: '1210 Cedar Bluff Rd', city: 'Knoxville', state: 'TN', postal_code: '37922' },
  },
  {
    email: 'mike@donatecrate.app',
    password: 'DonateCrate!123',
    role: 'customer',
    fullName: 'Mike Johnson',
    phone: '865-555-0102',
    address: { address_line1: '2000 Northshore Dr', city: 'Knoxville', state: 'TN', postal_code: '37922' },
  },
  {
    email: 'lisa@donatecrate.app',
    password: 'DonateCrate!123',
    role: 'customer',
    fullName: 'Lisa Carter',
    phone: '865-555-0103',
    address: { address_line1: '9621 Westland Dr', city: 'Knoxville', state: 'TN', postal_code: '37922' },
  },
  {
    email: 'evan@donatecrate.app',
    password: 'DonateCrate!123',
    role: 'customer',
    fullName: 'Evan Brooks',
    phone: '865-555-0104',
    address: { address_line1: '9430 South Northshore Dr', city: 'Knoxville', state: 'TN', postal_code: '37922' },
  },
  {
    email: 'nina@donatecrate.app',
    password: 'DonateCrate!123',
    role: 'customer',
    fullName: 'Nina Foster',
    phone: '865-555-0105',
    address: { address_line1: '150 Major Reynolds Pl', city: 'Knoxville', state: 'TN', postal_code: '37922' },
  },
  {
    email: 'ryan@donatecrate.app',
    password: 'DonateCrate!123',
    role: 'customer',
    fullName: 'Ryan Turner',
    phone: '865-555-0106',
    address: { address_line1: '11124 Turkey Dr', city: 'Knoxville', state: 'TN', postal_code: '37934' },
  },
  {
    email: 'amber.partner@donatecrate.app',
    password: 'DonateCrate!123',
    role: 'customer',
    fullName: 'Amber Mills',
    phone: '865-555-0311',
    address: { address_line1: '8811 Kingston Pike', city: 'Knoxville', state: 'TN', postal_code: '37923' },
  },
  {
    email: 'noah.partner@donatecrate.app',
    password: 'DonateCrate!123',
    role: 'customer',
    fullName: 'Noah Bennett',
    phone: '865-555-0312',
    address: { address_line1: '140 N Peters Rd', city: 'Knoxville', state: 'TN', postal_code: '37923' },
  },
  {
    email: 'zoe.partner@donatecrate.app',
    password: 'DonateCrate!123',
    role: 'customer',
    fullName: 'Zoe Franklin',
    phone: '865-555-0313',
    address: { address_line1: '9156 Middlebrook Pike', city: 'Knoxville', state: 'TN', postal_code: '37931' },
  },
  { email: 'driver1@donatecrate.app', password: 'DonateCrate!123', role: 'driver', fullName: 'Driver One' },
];

const demoZone = {
  code: 'test-sandbox-knoxville',
  name: 'TEST - Knoxville Sandbox',
  anchor_postal_code: '37922',
  demo_only: true,
  radius_miles: 3,
  min_active_subscribers: 1,
  status: 'active',
};

const partnerZone = {
  code: 'partner-hope-west-knox',
  name: 'Partner - Hope Foundation West Knox',
  anchor_postal_code: '37923',
  demo_only: true,
  radius_miles: 4,
  min_active_subscribers: 1,
  status: 'active',
  operation_model: 'partner_operated',
  partner_pickup_date_override_allowed: true,
  partner_notes: 'Seeded partner-operated zone for nonprofit portal testing.',
};

const partnerOrg = {
  code: 'hope-foundation',
  name: 'Hope Foundation',
  legal_name: 'Hope Foundation of Knoxville',
  support_email: 'support@hopefoundation.org',
  support_phone: '865-555-0300',
  receipt_mode: 'platform_on_behalf',
  payout_model: 'inventory_only',
  platform_share_bps: 10000,
  partner_share_bps: 0,
  notes: 'Demo nonprofit partner for local testing.',
};

async function geocodeAddress(address) {
  if (!GOOGLE_PLACES_API_KEY) return { lat: null, lng: null };
  const query = encodeURIComponent(
    `${address.address_line1}, ${address.city}, ${address.state} ${address.postal_code}, USA`,
  );
  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${GOOGLE_PLACES_API_KEY}`);
  if (!response.ok) return { lat: null, lng: null };
  const json = await response.json();
  const location = json?.results?.[0]?.geometry?.location;
  return {
    lat: typeof location?.lat === 'number' ? location.lat : null,
    lng: typeof location?.lng === 'number' ? location.lng : null,
  };
}

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
          phone: user.phone ?? '865-555-0100',
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
  const partnerZoneCustomers = customerUsers.filter((u) =>
    ['amber.partner@donatecrate.app', 'noah.partner@donatecrate.app', 'zoe.partner@donatecrate.app'].includes(u.email),
  );
  const driverUser = seeded.find((u) => u.role === 'driver');
  const partnerManagerUser = seeded.find((u) => u.role === 'partner_manager');
  const partnerOperatorUser = seeded.find((u) => u.role === 'partner_operator');

  const { data: zone, error: zoneError } = await supabase
    .from('service_zones')
    .upsert(demoZone, { onConflict: 'code' })
    .select('id,code')
    .single();
  if (zoneError) throw zoneError;

  const { data: partner, error: partnerError } = await supabase
    .from('nonprofit_partners')
    .upsert(
      {
        ...partnerOrg,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'code' },
    )
    .select('id,name,code')
    .single();
  if (partnerError) throw partnerError;

  const { data: seededPartnerZone, error: partnerZoneError } = await supabase
    .from('service_zones')
    .upsert(
      {
        ...partnerZone,
        partner_id: partner.id,
      },
      { onConflict: 'code' },
    )
    .select('id,code')
    .single();
  if (partnerZoneError) throw partnerZoneError;

  let { data: activePlan } = await supabase
    .from('pricing_plans')
    .select('id')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!activePlan?.id) {
    const { data: createdPlan, error: createdPlanError } = await supabase
      .from('pricing_plans')
      .insert({
        name: 'Monthly Essentials',
        description: 'Seeded default plan for local development and demo flows.',
        billing_interval: 'month',
        amount_cents: 2900,
        currency: 'usd',
        active: true,
      })
      .select('id')
      .single();
    if (createdPlanError) throw createdPlanError;
    activePlan = createdPlan;
  }

  for (const customer of customerUsers) {
    const sourceUser = demoUsers.find((user) => user.email === customer.email);
    const geocoded = sourceUser?.address ? await geocodeAddress(sourceUser.address) : { lat: null, lng: null };
    const addressPayload = {
      user_id: customer.userId,
      address_line1: sourceUser?.address?.address_line1 ?? '1210 Cedar Bluff Rd',
      city: sourceUser?.address?.city ?? 'Knoxville',
      state: sourceUser?.address?.state ?? 'TN',
      postal_code: sourceUser?.address?.postal_code ?? '37922',
      lat: geocoded.lat,
      lng: geocoded.lng,
    };
    const { data: existingAddress } = await supabase
      .from('addresses')
      .select('id')
      .eq('user_id', customer.userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingAddress?.id) {
      const { error: addressUpdateError } = await supabase
        .from('addresses')
        .update(addressPayload)
        .eq('id', existingAddress.id);
      if (addressUpdateError) throw addressUpdateError;
    } else {
      const { error: addressInsertError } = await supabase.from('addresses').insert(addressPayload);
      if (addressInsertError) throw addressInsertError;
    }

    const targetZoneId = partnerZoneCustomers.some((item) => item.userId === customer.userId) ? seededPartnerZone.id : zone.id;

    await supabase
      .from('zone_memberships')
      .update({ status: 'inactive' })
      .eq('user_id', customer.userId)
      .neq('zone_id', targetZoneId);

    await supabase.from('zone_memberships').upsert(
      {
        user_id: customer.userId,
        zone_id: targetZoneId,
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

  if (driverUser) {
    await supabase
      .from('zone_memberships')
      .update({ status: 'inactive' })
      .eq('user_id', driverUser.userId)
      .neq('zone_id', zone.id);

    await supabase.from('zone_memberships').upsert(
      {
        user_id: driverUser.userId,
        zone_id: zone.id,
        status: 'active',
      },
      { onConflict: 'user_id,zone_id' },
    );
  }

  if (partnerManagerUser && partnerOperatorUser) {
    for (const staffUser of [partnerManagerUser, partnerOperatorUser]) {
      await supabase.from('partner_memberships').upsert(
        {
          partner_id: partner.id,
          user_id: staffUser.userId,
          role: staffUser.role,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'partner_id,user_id' },
      );
    }
  }

  await supabase.from('partner_branding').upsert(
    {
      partner_id: partner.id,
      display_name: 'Hope Foundation',
      primary_color: '#0f766e',
      secondary_color: '#134e4a',
      accent_color: '#f59e0b',
      website_url: 'https://hopefoundation.org',
      receipt_footer: 'Thank you for supporting Hope Foundation through DonateCrate.',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'partner_id' },
  );

  const month = new Date();
  month.setDate(1);
  const pickupDate = new Date();
  pickupDate.setDate(pickupDate.getDate() + 10);
  const partnerPickupDate = new Date();
  partnerPickupDate.setDate(partnerPickupDate.getDate() + 6);

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

  const { data: partnerCycle, error: partnerCycleError } = await supabase
    .from('pickup_cycles')
    .upsert(
      {
        zone_id: seededPartnerZone.id,
        cycle_month: month.toISOString().slice(0, 10),
        pickup_date: partnerPickupDate.toISOString().slice(0, 10),
        request_cutoff_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 4).toISOString(),
        pickup_window_label: '9am - 1pm',
        scheduled_by_partner_id: partner.id,
      },
      { onConflict: 'zone_id,cycle_month' },
    )
    .select('id')
    .single();
  if (partnerCycleError) throw partnerCycleError;

  for (const customer of customerUsers) {
    const inPartnerZone = partnerZoneCustomers.some((item) => item.userId === customer.userId);
    await supabase.from('pickup_requests').upsert(
      {
        user_id: customer.userId,
        pickup_cycle_id: inPartnerZone ? partnerCycle.id : cycle.id,
        status: inPartnerZone
          ? customer.email.includes('amber') || customer.email.includes('zoe')
            ? 'requested'
            : 'confirmed'
          : customer.email.includes('sarah') || customer.email.includes('lisa') || customer.email.includes('nina')
            ? 'requested'
            : 'confirmed',
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

  const { data: existingRoutes } = await supabase
    .from('routes')
    .select('id')
    .eq('zone_id', zone.id)
    .eq('pickup_cycle_id', cycle.id);
  if (existingRoutes?.length) {
    const routeIds = existingRoutes.map((route) => route.id);
    await supabase.from('pickup_stops').delete().in('route_id', routeIds);
    await supabase.from('routes').delete().in('id', routeIds);
  }

  if (driver?.id) {
    await supabase.from('drivers').update({ active: true }).eq('id', driver.id);
  }

  if (driver?.id) {
    const { data: route, error: routeError } = await supabase
      .from('routes')
      .insert({
        zone_id: zone.id,
        pickup_cycle_id: cycle.id,
        driver_id: driver.id,
        status: 'assigned',
      })
      .select('id')
      .single();
    if (routeError) throw routeError;

    const { data: requestsForRoute, error: requestsForRouteError } = await supabase
      .from('pickup_requests')
      .select('id')
      .eq('pickup_cycle_id', cycle.id)
      .order('created_at', { ascending: true });
    if (requestsForRouteError) throw requestsForRouteError;

    if ((requestsForRoute ?? []).length > 0) {
      const stopRows = requestsForRoute.map((request, index) => ({
        route_id: route.id,
        pickup_request_id: request.id,
        stop_order: index + 1,
        status: 'scheduled',
      }));
      const { error: stopInsertError } = await supabase.from('pickup_stops').insert(stopRows);
      if (stopInsertError) throw stopInsertError;
    }
  }

  const { data: existingPartnerRoutes } = await supabase
    .from('routes')
    .select('id')
    .eq('zone_id', seededPartnerZone.id)
    .eq('pickup_cycle_id', partnerCycle.id);
  if (existingPartnerRoutes?.length) {
    const routeIds = existingPartnerRoutes.map((route) => route.id);
    await supabase.from('pickup_stops').delete().in('route_id', routeIds);
    await supabase.from('routes').delete().in('id', routeIds);
  }

  const { data: partnerRoute, error: partnerRouteError } = await supabase
    .from('routes')
    .insert({
      zone_id: seededPartnerZone.id,
      pickup_cycle_id: partnerCycle.id,
      status: 'assigned',
      partner_id: partner.id,
      fulfillment_mode: 'partner_team',
      partner_visible: true,
    })
    .select('id')
    .single();
  if (partnerRouteError) throw partnerRouteError;

  const { data: partnerRequestsForRoute, error: partnerRequestsError } = await supabase
    .from('pickup_requests')
    .select('id')
    .eq('pickup_cycle_id', partnerCycle.id)
    .order('created_at', { ascending: true });
  if (partnerRequestsError) throw partnerRequestsError;

  if ((partnerRequestsForRoute ?? []).length > 0) {
    const partnerStopRows = partnerRequestsForRoute.map((request, index) => ({
      route_id: partnerRoute.id,
      pickup_request_id: request.id,
      stop_order: index + 1,
      status: 'scheduled',
    }));
    const { error: partnerStopInsertError } = await supabase.from('pickup_stops').insert(partnerStopRows);
    if (partnerStopInsertError) throw partnerStopInsertError;
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
  console.log(`- Demo zone: ${demoZone.name} (${demoZone.code})`);
  console.log(`- Partner zone: ${partnerZone.name} (${partnerZone.code})`);
  console.log(`- Partner org: ${partnerOrg.name} (${partnerOrg.code})`);
  console.log(`- Seeded ${customerUsers.length} customer accounts with Knoxville-area addresses for route testing.`);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
