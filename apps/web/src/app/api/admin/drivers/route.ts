import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";

const bodySchema = z.object({
  userEmail: z.string().email(),
  employeeId: z.string().min(3),
});

export async function GET() {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await ctx.supabase
    .from("drivers")
    .select("id,employee_id,active,user_id,users!inner(email,full_name)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drivers: data ?? [] });
}

export async function POST(request: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const { supabase } = ctx;
  const { data: targetUser, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("email", parsed.data.userEmail.toLowerCase())
    .maybeSingle();

  if (userError || !targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("drivers")
    .upsert(
      {
        user_id: targetUser.id,
        employee_id: parsed.data.employeeId,
        active: true,
      },
      { onConflict: "user_id" },
    )
    .select("id,employee_id,active")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, driver: data });
}
