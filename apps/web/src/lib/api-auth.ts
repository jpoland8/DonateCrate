import { createClient } from "@/lib/supabase/server";

export async function getAuthenticatedContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id,email,role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile) return null;

  return {
    supabase,
    user,
    profile,
  };
}
