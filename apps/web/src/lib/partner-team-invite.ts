import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAuthCallbackLink } from "@/lib/auth-links";
import { sendEmail } from "@/lib/email";
import { getPartnerReceiptPresentation } from "@/lib/partner-receipt";
import { getAppUrl } from "@/lib/urls";

type AdminSupabaseClient = SupabaseClient;

type PartnerTeamRole = "partner_admin" | "partner_coordinator" | "partner_driver";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatPartnerRole(role: PartnerTeamRole) {
  if (role === "partner_admin") return "Organization Admin";
  if (role === "partner_coordinator") return "Coordinator";
  return "Driver";
}

function buildTemporaryPassword() {
  return `Dc!${crypto.randomBytes(12).toString("base64url")}`;
}

async function findAuthUserByEmail(params: {
  supabase: AdminSupabaseClient;
  email: string;
}) {
  const { supabase, email } = params;
  let page = 1;
  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return { user: null, error };
    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return { user: found, error: null };
    if (data.users.length < 200) break;
    page += 1;
  }
  return { user: null, error: null };
}

export function buildPartnerTeamInviteEmailContent(params: {
  partnerName: string;
  role: PartnerTeamRole;
  actionLink: string;
  actionType: "set_password" | "sign_in";
  recipientEmail: string;
  recipientName?: string | null;
  branding?: {
    display_name?: string | null;
    logo_url?: string | null;
    primary_color?: string | null;
    secondary_color?: string | null;
    accent_color?: string | null;
    website_url?: string | null;
    receipt_footer?: string | null;
  } | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
}) {
  const roleLabel = formatPartnerRole(params.role);
  const isSetPasswordFlow = params.actionType === "set_password";
  const presentation = getPartnerReceiptPresentation({
    partnerName: params.partnerName,
    displayName: params.branding?.display_name ?? params.partnerName,
    logoUrl: params.branding?.logo_url ?? null,
    primaryColor: params.branding?.primary_color ?? null,
    secondaryColor: params.branding?.secondary_color ?? null,
    accentColor: params.branding?.accent_color ?? null,
    websiteUrl: params.branding?.website_url ?? null,
    receiptFooter: params.branding?.receipt_footer ?? null,
    supportEmail: params.supportEmail ?? null,
    supportPhone: params.supportPhone ?? null,
  });
  const greetingName = params.recipientName?.trim()?.split(" ")[0] || "there";
  const html = `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0;background:${escapeHtml(presentation.secondaryColor)};padding:24px;font-family:Inter,Arial,sans-serif;">
    <div style="margin:0 auto;max-width:680px;overflow:hidden;border:1px solid rgba(17,24,39,.08);border-radius:28px;background:#ffffff;box-shadow:0 24px 70px rgba(17,24,39,.08);">
      <div style="padding:28px 32px;background:${escapeHtml(presentation.primaryColor)};">
        <table role="presentation" style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="vertical-align:middle;width:120px;">
              ${
                presentation.emailSafeLogoUrl
                  ? `<img src="${escapeHtml(presentation.emailSafeLogoUrl)}" alt="${escapeHtml(presentation.displayName)} logo" style="display:block;max-width:104px;max-height:104px;width:auto;height:auto;object-fit:contain;" />`
                  : `<div style="display:inline-flex;align-items:center;justify-content:center;width:92px;height:92px;border-radius:22px;background:rgba(255,255,255,.14);color:#ffffff;font-size:30px;font-weight:700;letter-spacing:.08em;">${escapeHtml(
                      presentation.wordmark,
                    )}</div>`
              }
            </td>
            <td style="vertical-align:middle;padding-left:12px;">
              <div style="color:rgba(255,255,255,.78);font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">Organization Team Invite</div>
              <h1 style="margin:10px 0 0;color:#ffffff;font-size:36px;line-height:1.05;">Join ${escapeHtml(presentation.displayName)} on DonateCrate</h1>
              <p style="margin:12px 0 0;color:rgba(255,255,255,.84);font-size:16px;line-height:1.6;">You were added as ${escapeHtml(roleLabel)}. ${escapeHtml(
                isSetPasswordFlow
                  ? "Use the secure link below to set your password, add your phone number, and finish setup."
                  : "Use the secure link below to sign in and open your workspace.",
              )}</p>
            </td>
          </tr>
        </table>
      </div>
      <div style="padding:32px;">
        <p style="margin:0 0 14px;color:#4a5565;font-size:16px;line-height:1.7;">Hi ${escapeHtml(greetingName)},</p>
        <p style="margin:0 0 14px;color:#4a5565;font-size:16px;line-height:1.7;">${escapeHtml(presentation.displayName)} added <strong>${escapeHtml(
          params.recipientEmail,
        )}</strong> to their DonateCrate organization team as <strong>${escapeHtml(roleLabel)}</strong>.</p>
        <div style="margin:0 0 22px;border-radius:20px;background:#fff7f1;padding:18px;border:1px solid #f3ded0;">
          <div style="margin:0 0 10px;color:#9a7657;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">What to do next</div>
          <div style="margin:0 0 8px;color:#181f30;font-size:16px;line-height:1.6;">1. Open the secure team link.</div>
          <div style="margin:0 0 8px;color:#181f30;font-size:16px;line-height:1.6;">2. ${escapeHtml(
            isSetPasswordFlow
              ? "Set your password and add the phone number you want on your team account."
              : "Sign in for this DonateCrate email address.",
          )}</div>
          <div style="margin:0;color:#181f30;font-size:16px;line-height:1.6;">3. You will land in the ${escapeHtml(presentation.displayName)} partner workspace.</div>
        </div>
        <a href="${escapeHtml(params.actionLink)}" style="display:inline-block;border-radius:999px;background:${escapeHtml(
          presentation.accentColor,
        )};padding:14px 22px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;box-shadow:0 10px 24px rgba(17,24,39,.14);">${escapeHtml(
          isSetPasswordFlow ? "Set up my account" : "Open my team workspace",
        )}</a>
        <p style="margin:24px 0 0;color:#4a5565;font-size:15px;line-height:1.7;">${escapeHtml(
          isSetPasswordFlow
            ? "Set your password and phone number first. Once setup is complete, sign in and you will land in the partner workspace."
            : "If you prefer to use a password later, you can sign in once with this link and then use Forgot password on the login screen.",
        )}</p>
        <p style="margin:18px 0 0;color:#677381;font-size:13px;line-height:1.6;">Questions? Contact ${escapeHtml(
          [presentation.supportEmail, presentation.supportPhone].filter(Boolean).join(" • ") || "giving@donatecrate.com",
        )}.</p>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    `Hi ${greetingName},`,
    "",
    `${presentation.displayName} added ${params.recipientEmail} to their DonateCrate organization team as ${roleLabel}.`,
    "",
    "What to do next:",
    "1. Open the secure team link.",
    isSetPasswordFlow
      ? "2. Set your password and add your phone number."
      : "2. Sign in to DonateCrate for this email address.",
    `3. You will land in the ${presentation.displayName} partner workspace.`,
    "",
    `${isSetPasswordFlow ? "Set up my account" : "Open my team workspace"}: ${params.actionLink}`,
    "",
    isSetPasswordFlow
      ? "Set your password and phone number first. Once setup is complete, sign in and you will land in the partner workspace."
      : "If you prefer to use a password later, you can sign in once with this link and then use Forgot password on the login screen.",
  ].join("\n");

  return {
    subject: isSetPasswordFlow
      ? `Set up your ${presentation.displayName} team account`
      : `Set up your ${presentation.displayName} team access`,
    text,
    html,
  };
}

export async function ensurePartnerInvitee(params: {
  supabase: AdminSupabaseClient;
  partnerId: string;
  email: string;
  role: PartnerTeamRole;
}) {
  const { supabase, partnerId, email, role } = params;
  const normalizedEmail = email.trim().toLowerCase();

  const [{ data: partnerRow, error: partnerError }, { data: existingUser, error: existingUserError }] = await Promise.all([
    supabase
      .from("nonprofit_partners")
      .select("id,name,support_email,support_phone")
      .eq("id", partnerId)
      .maybeSingle(),
    supabase
      .from("users")
      .select("id,email,full_name,phone,auth_user_id")
      .eq("email", normalizedEmail)
      .maybeSingle(),
  ]);

  if (partnerError || !partnerRow) {
    return { error: partnerError ?? new Error("Partner not found"), user: null, invited: false, warning: null };
  }
  if (existingUserError) {
    return { error: existingUserError, user: null, invited: false, warning: null };
  }

  const { data: branding } = await supabase
    .from("partner_branding")
    .select("display_name,logo_url,primary_color,secondary_color,accent_color,website_url,receipt_footer")
    .eq("partner_id", partnerId)
    .maybeSingle();

  let targetUser = existingUser;
  const shouldCreatePassword = !existingUser;
  const shouldSendInvite = true;
  let authUserId = existingUser?.auth_user_id ?? null;
  let warning: string | null = null;

  if (!targetUser) {
    const { user: existingAuthUser, error: authLookupError } = await findAuthUserByEmail({
      supabase,
      email: normalizedEmail,
    });
    if (authLookupError) {
      return { error: authLookupError, user: null, invited: false, warning: null };
    }

    if (existingAuthUser) {
      authUserId = existingAuthUser.id;
    } else {
      const { data: createdAuthUser, error: createAuthError } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password: buildTemporaryPassword(),
        email_confirm: true,
      });
      if (createAuthError) {
        return { error: createAuthError, user: null, invited: false, warning: null };
      }
      authUserId = createdAuthUser.user?.id ?? null;
    }

    const { data: createdProfile, error: createProfileError } = await supabase
      .from("users")
      .upsert(
        {
          auth_user_id: authUserId,
          email: normalizedEmail,
          full_name: null,
          phone: null,
          role: "customer",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "auth_user_id" },
      )
      .select("id,email,full_name,phone,auth_user_id")
      .single();

    if (createProfileError || !createdProfile) {
      return { error: createProfileError ?? new Error("Could not create user profile"), user: null, invited: false, warning: null };
    }
    targetUser = createdProfile;

    const { error: prefsError } = await supabase.from("notification_preferences").upsert(
      {
        user_id: createdProfile.id,
        email_enabled: true,
        sms_enabled: false,
      },
      { onConflict: "user_id" },
    );
    if (prefsError) {
      return { error: prefsError, user: null, invited: false, warning: null };
    }
  }

  if (!authUserId) {
    const { user: existingAuthUser, error: authLookupError } = await findAuthUserByEmail({
      supabase,
      email: normalizedEmail,
    });
    if (authLookupError || !existingAuthUser) {
      return { error: authLookupError ?? new Error("Could not resolve account access for this email"), user: null, invited: false, warning: null };
    }
    authUserId = existingAuthUser.id;
    await supabase.from("users").update({ auth_user_id: authUserId, updated_at: new Date().toISOString() }).eq("id", targetUser.id);
  }

  let invited = false;
  if (shouldSendInvite) {
    const actionType = shouldCreatePassword ? "recovery" : "magiclink";
    const nextPath = shouldCreatePassword ? "/partner/setup" : "/partner";
    const redirectTo = `${getAppUrl()}/auth/callback?next=${encodeURIComponent(nextPath)}`;
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: actionType,
      email: normalizedEmail,
      options: {
        redirectTo,
      },
    });

    if (linkError || !linkData.properties?.hashed_token) {
      return { error: linkError ?? new Error("Could not generate setup link"), user: null, invited: false, warning: null };
    }

    const actionLink = buildAuthCallbackLink({
      tokenHash: linkData.properties.hashed_token,
      type: actionType,
      nextPath,
    });
    const emailContent = buildPartnerTeamInviteEmailContent({
      partnerName: partnerRow.name,
      role,
      actionLink,
      actionType: shouldCreatePassword ? "set_password" : "sign_in",
      recipientEmail: normalizedEmail,
      recipientName: targetUser.full_name,
      branding,
      supportEmail: partnerRow.support_email,
      supportPhone: partnerRow.support_phone,
    });
    try {
      await sendEmail({
        to: normalizedEmail,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
      });
      invited = true;
    } catch (error) {
      warning = error instanceof Error ? error.message : "The setup email could not be sent.";
    }
  }

  return {
    error: null,
    invited,
    warning,
    user: {
      id: targetUser.id,
      email: targetUser.email,
      full_name: targetUser.full_name,
      phone: targetUser.phone,
    },
  };
}
