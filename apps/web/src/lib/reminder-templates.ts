import type { SupabaseClient } from "@supabase/supabase-js";

export type ReminderTemplates = {
  sms_72h: string;
  sms_24h: string;
  sms_day_of: string;
  email_subject_72h: string;
  email_subject_24h: string;
  email_subject_day_of: string;
  email_intro_72h: string;
  email_intro_24h: string;
  email_intro_day_of: string;
  email_body_72h: string;
  email_body_24h: string;
  email_body_day_of: string;
  // Enabled flags — default true if not set
  enabled_sms_72h?: boolean;
  enabled_sms_24h?: boolean;
  enabled_sms_day_of?: boolean;
  enabled_email_72h?: boolean;
  enabled_email_24h?: boolean;
  enabled_email_day_of?: boolean;
};

const DEFAULTS: ReminderTemplates = {
  sms_72h:
    "DonateCrate reminder: your pickup is coming up on {{pickup_date}}{{pickup_window_suffix}}. Start filling your bag now so it is ready for route day.",
  sms_24h:
    "DonateCrate reminder: your pickup is tomorrow, {{pickup_date}}{{pickup_window_suffix}}. Place your bag out before route time.",
  sms_day_of:
    "DonateCrate reminder: pickup day is here. Place your DonateCrate bag out for collection today, {{pickup_date}}{{pickup_window_suffix}}.",
  email_subject_72h: "Your DonateCrate pickup is coming up",
  email_subject_24h: "Your DonateCrate pickup is tomorrow",
  email_subject_day_of: "Pickup day is here",
  email_intro_72h: "Your next monthly pickup is getting close.",
  email_intro_24h: "Your bag should be ready by tomorrow.",
  email_intro_day_of: "Today is pickup day for your DonateCrate bag.",
  email_body_72h:
    "We are scheduled to stop by on {{pickup_date}}. Keep your orange bag ready and place it out before route time.",
  email_body_24h:
    "We are scheduled to stop by tomorrow, {{pickup_date}}. Make sure your orange bag is packed and placed out before route time.",
  email_body_day_of:
    "Today is the day! Place your orange bag out for collection. We will be by on {{pickup_date}}.",
};

export function getDefaultTemplates(): ReminderTemplates {
  return { ...DEFAULTS };
}

export async function loadReminderTemplates(supabase: SupabaseClient): Promise<ReminderTemplates> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "reminder_templates")
      .maybeSingle();

    if (data?.value && typeof data.value === "object") {
      return { ...DEFAULTS, ...(data.value as Partial<ReminderTemplates>) };
    }
  } catch {
    // Fall through to defaults
  }
  return { ...DEFAULTS };
}

export function isReminderEnabled(templates: ReminderTemplates, channel: "sms" | "email", cadence: "72h" | "24h" | "day_of"): boolean {
  const key = `enabled_${channel}_${cadence}` as keyof ReminderTemplates;
  const value = templates[key];
  // Default to true if the flag is not explicitly set
  return value !== false;
}

export function renderTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}
