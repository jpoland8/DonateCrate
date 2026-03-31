/**
 * Cloudflare Worker entry point.
 *
 * Wraps the OpenNext-generated worker to add a `scheduled` handler for
 * Cloudflare Cron Triggers. Each cron expression maps to an internal
 * API route that is called via the WORKER_SELF_REFERENCE service binding.
 *
 * Cron schedule:
 *   - Every 5 minutes  → /api/cron/process   (drain notification queue)
 *   - Daily at 8am UTC → /api/cron/reminders  (queue pickup reminders)
 *   - Sundays 3am UTC  → /api/cron/cleanup    (data retention pruning)
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — generated after `opennextjs-cloudflare build`
import baseWorker from "./.open-next/worker.js";

interface CronEnv {
  WORKER_SELF_REFERENCE: { fetch: typeof fetch };
  CRON_SECRET?: string;
  [key: string]: unknown;
}

const CRON_ROUTES: Record<string, string> = {
  "*/5 * * * *": "/api/cron/process",
  "0 8 * * *": "/api/cron/reminders",
  "0 3 * * sun": "/api/cron/cleanup",
};

export default {
  ...baseWorker,

  async scheduled(
    event: { cron: string },
    env: CronEnv,
    ctx: { waitUntil: (p: Promise<unknown>) => void }
  ): Promise<void> {
    const route = CRON_ROUTES[event.cron];
    if (!route) {
      console.warn(`[cron] Unknown cron expression: ${event.cron}`);
      return;
    }

    ctx.waitUntil(
      env.WORKER_SELF_REFERENCE.fetch(
        new Request(`http://localhost${route}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${env.CRON_SECRET ?? ""}`,
          },
        })
      ).then(async (res) => {
        const body = await res.text();
        console.log(`[cron] ${route} → ${res.status}`, body.slice(0, 200));
      }).catch((err) => {
        console.error(`[cron] ${route} failed:`, err);
      })
    );
  },
};
