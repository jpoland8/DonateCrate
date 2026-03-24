import { NextResponse } from "next/server";
import { z } from "zod";
import { buildAuthCallbackLink } from "@/lib/auth-links";
import { sendBrandedEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/urls";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const supabase = createSupabaseAdminClient();
  const { data: userProfile, error: userError } = await supabase
    .from("users")
    .select("full_name")
    .eq("email", email)
    .maybeSingle();

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  if (!userProfile) {
    return NextResponse.json({
      ok: true,
      message: "If that email is in DonateCrate, a reset link is on the way.",
    });
  }

  const redirectTo = `${getAppUrl()}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo,
    },
  });

  if (linkError || !linkData.properties?.hashed_token) {
    return NextResponse.json({ error: linkError?.message ?? "Could not generate a recovery link." }, { status: 500 });
  }

  const actionLink = buildAuthCallbackLink({
    tokenHash: linkData.properties.hashed_token,
    type: "recovery",
    nextPath: "/reset-password",
  });

  await sendBrandedEmail({
    eventType: "auth_password_reset",
    recipient: { email, fullName: userProfile.full_name },
    metadata: {
      reset_link: actionLink,
    },
  });

  return NextResponse.json({
    ok: true,
    message: "If that email is in DonateCrate, a reset link is on the way.",
  });
}
