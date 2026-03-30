import { NextResponse } from "next/server";
import { z } from "zod";
import { PARTNER_TEAM_ROLES } from "@/lib/access";
import { apiLimiter } from "@/lib/rate-limit";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { syncPartnerDriverProfile } from "@/lib/partner-driver";
import { userCanAccessPartner } from "@/lib/partner-access";
import { syncUserPartnerRole } from "@/lib/partner-role-sync";
import { ensurePartnerInvitee } from "@/lib/partner-team-invite";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const createMemberSchema = z.object({
  partnerId: z.string().uuid(),
  userEmail: z.string().email(),
  role: z.enum(PARTNER_TEAM_ROLES),
});

const updateMemberSchema = z.object({
  membershipId: z.string().uuid(),
  role: z.enum(PARTNER_TEAM_ROLES).optional(),
  active: z.boolean().optional(),
});

const deleteMemberSchema = z.object({
  membershipId: z.string().uuid(),
});

function isOrganizationAdmin(role: string) {
  return role === "partner_admin";
}

export async function POST(request: Request) {
  const limited = apiLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.partnerRole !== "partner_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = createMemberSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const canAccess = await userCanAccessPartner({
    supabase: ctx.supabase,
    userId: ctx.profile.id,
    partnerId: parsed.data.partnerId,
  });
  if (!canAccess) return NextResponse.json({ error: "This partner is not assigned to your account" }, { status: 403 });

  const supabaseAdmin = createSupabaseAdminClient();
  const inviteeResult = await ensurePartnerInvitee({
    supabase: supabaseAdmin,
    partnerId: parsed.data.partnerId,
    email: parsed.data.userEmail,
    role: parsed.data.role,
  });
  if (inviteeResult.error || !inviteeResult.user) {
    return NextResponse.json({ error: inviteeResult.error?.message ?? "Could not create team member" }, { status: 500 });
  }
  const targetUser = inviteeResult.user;

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("partner_memberships")
    .upsert(
      {
        partner_id: parsed.data.partnerId,
        user_id: targetUser.id,
        role: parsed.data.role,
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "partner_id,user_id" },
    )
    .select("id,partner_id,user_id,role,active")
    .single();

  if (membershipError || !membership) {
    return NextResponse.json({ error: membershipError?.message ?? "Could not save partner membership" }, { status: 500 });
  }

  const driverSyncResult = await syncPartnerDriverProfile({
    supabase: supabaseAdmin,
    userId: targetUser.id,
  });
  if (driverSyncResult.error) {
    return NextResponse.json({ error: driverSyncResult.error.message }, { status: 500 });
  }

  const syncResult = await syncUserPartnerRole({ supabase: supabaseAdmin, userId: targetUser.id });
  if (syncResult.error) {
    return NextResponse.json({ error: syncResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    invited: inviteeResult.invited,
    warning: inviteeResult.warning,
    member: {
      id: membership.id,
      user_id: targetUser.id,
      email: targetUser.email,
      full_name: targetUser.full_name,
      phone: targetUser.phone,
      role: membership.role,
      active: membership.active,
    },
  });
}

export async function PATCH(request: Request) {
  const limited = apiLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.partnerRole !== "partner_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = updateMemberSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  if (parsed.data.role === undefined && parsed.data.active === undefined) {
    return NextResponse.json({ error: "No membership changes requested" }, { status: 400 });
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("partner_memberships")
    .select("id,partner_id,user_id,role,active,users!inner(email,full_name,phone)")
    .eq("id", parsed.data.membershipId)
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json({ error: membershipError?.message ?? "Partner membership not found" }, { status: 404 });
  }

  const canAccess = await userCanAccessPartner({
    supabase: ctx.supabase,
    userId: ctx.profile.id,
    partnerId: membership.partner_id,
  });
  if (!canAccess) return NextResponse.json({ error: "This partner is not assigned to your account" }, { status: 403 });

  const nextRole = parsed.data.role ?? membership.role;
  const nextActive = parsed.data.active ?? membership.active;
  const removesAdminAccess = isOrganizationAdmin(membership.role) && (!nextActive || nextRole !== "partner_admin");

  if (removesAdminAccess) {
    const { count, error: managerCountError } = await supabaseAdmin
      .from("partner_memberships")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", membership.partner_id)
      .eq("role", "partner_admin")
      .eq("active", true);

    if (managerCountError) return NextResponse.json({ error: managerCountError.message }, { status: 500 });
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "Each organization needs at least one active organization admin" }, { status: 400 });
    }
  }

  const { data: updatedMembership, error: updateError } = await supabaseAdmin
    .from("partner_memberships")
    .update({
      role: nextRole,
      active: nextActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", membership.id)
    .select("id,partner_id,user_id,role,active")
    .single();

  if (updateError || !updatedMembership) {
    return NextResponse.json({ error: updateError?.message ?? "Could not update partner membership" }, { status: 500 });
  }

  const driverSyncResult = await syncPartnerDriverProfile({
    supabase: supabaseAdmin,
    userId: membership.user_id,
  });
  if (driverSyncResult.error) {
    return NextResponse.json({ error: driverSyncResult.error.message }, { status: 500 });
  }

  const syncResult = await syncUserPartnerRole({ supabase: supabaseAdmin, userId: membership.user_id });
  if (syncResult.error) {
    return NextResponse.json({ error: syncResult.error.message }, { status: 500 });
  }

  const user = Array.isArray(membership.users) ? membership.users[0] : membership.users;
  return NextResponse.json({
    ok: true,
    member: {
      id: updatedMembership.id,
      user_id: updatedMembership.user_id,
      email: user?.email ?? "",
      full_name: user?.full_name ?? null,
      phone: user?.phone ?? null,
      role: updatedMembership.role,
      active: updatedMembership.active,
    },
  });
}

export async function DELETE(request: Request) {
  const limited = apiLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.partnerRole !== "partner_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = deleteMemberSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("partner_memberships")
    .select("id,partner_id,user_id,role,active")
    .eq("id", parsed.data.membershipId)
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json({ error: membershipError?.message ?? "Partner membership not found" }, { status: 404 });
  }

  const canAccess = await userCanAccessPartner({
    supabase: ctx.supabase,
    userId: ctx.profile.id,
    partnerId: membership.partner_id,
  });
  if (!canAccess) return NextResponse.json({ error: "This partner is not assigned to your account" }, { status: 403 });

  if (isOrganizationAdmin(membership.role) && membership.active) {
    const { count, error: managerCountError } = await supabaseAdmin
      .from("partner_memberships")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", membership.partner_id)
      .eq("role", "partner_admin")
      .eq("active", true);

    if (managerCountError) return NextResponse.json({ error: managerCountError.message }, { status: 500 });
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "Each organization needs at least one active organization admin" }, { status: 400 });
    }
  }

  const { error: deleteError } = await supabaseAdmin.from("partner_memberships").delete().eq("id", membership.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const driverSyncResult = await syncPartnerDriverProfile({
    supabase: supabaseAdmin,
    userId: membership.user_id,
  });
  if (driverSyncResult.error) {
    return NextResponse.json({ error: driverSyncResult.error.message }, { status: 500 });
  }

  const syncResult = await syncUserPartnerRole({ supabase: supabaseAdmin, userId: membership.user_id });
  if (syncResult.error) {
    return NextResponse.json({ error: syncResult.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deletedMembershipId: membership.id });
}
