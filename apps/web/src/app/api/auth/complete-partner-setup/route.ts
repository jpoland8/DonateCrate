import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const bodySchema = z.object({
  tokenHash: z.string().min(20),
  password: z.string().min(8),
  fullName: z.string().min(2),
  phone: z.string().min(7),
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Use a valid setup link, password, full name, and phone number." }, { status: 400 });
  }

  const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: verified, error: verifyError } = await anonClient.auth.verifyOtp({
    token_hash: parsed.data.tokenHash,
    type: "recovery",
  });

  if (verifyError || !verified.user?.id) {
    return NextResponse.json(
      { error: verifyError?.message || "This setup link is no longer valid. Ask for a new invite." },
      { status: 400 },
    );
  }

  const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const { error: passwordError } = await adminClient.auth.admin.updateUserById(verified.user.id, {
    password: parsed.data.password,
  });

  if (passwordError) {
    return NextResponse.json({ error: passwordError.message }, { status: 500 });
  }

  const { error: profileError } = await adminClient
    .from("users")
    .update({
      full_name: parsed.data.fullName.trim(),
      phone: parsed.data.phone.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("auth_user_id", verified.user.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Account setup complete. Sign in with your new password to open the partner portal.",
  });
}
