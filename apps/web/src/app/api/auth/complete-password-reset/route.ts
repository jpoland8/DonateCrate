import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const bodySchema = z.object({
  tokenHash: z.string().min(20),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Use a valid reset link and an 8+ character password." }, { status: 400 });
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
      { error: verifyError?.message || "This reset link is no longer valid. Please request another one." },
      { status: 400 },
    );
  }

  const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const { error: updateError } = await adminClient.auth.admin.updateUserById(verified.user.id, {
    password: parsed.data.password,
  });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Password updated. Sign in with your new password.",
  });
}
