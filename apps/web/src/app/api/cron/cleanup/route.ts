import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Cron endpoint: data retention cleanup.
 *
 * Runs the prune_old_notification_events and prune_old_webhook_events
 * database functions to clean up stale transactional data.
 *
 * Authenticate with CRON_SECRET query parameter or Authorization header.
 * Schedule: weekly (e.g., Sundays at 3am UTC)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret") || request.headers.get("authorization")?.replace("Bearer ", "");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const results: Record<string, number | string> = {};

  // Prune old notification events
  try {
    const { data, error } = await supabase.rpc("prune_old_notification_events");
    if (error) {
      results.notification_events = `error: ${error.message}`;
    } else {
      results.notification_events = typeof data === "number" ? data : 0;
    }
  } catch (err) {
    results.notification_events = `error: ${err instanceof Error ? err.message : "Unknown"}`;
  }

  // Prune old webhook events
  try {
    const { data, error } = await supabase.rpc("prune_old_webhook_events");
    if (error) {
      results.webhook_events = `error: ${error.message}`;
    } else {
      results.webhook_events = typeof data === "number" ? data : 0;
    }
  } catch (err) {
    results.webhook_events = `error: ${err instanceof Error ? err.message : "Unknown"}`;
  }

  return NextResponse.json({
    ok: true,
    pruned: results,
    timestamp: new Date().toISOString(),
  });
}
