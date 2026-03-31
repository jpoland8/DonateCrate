/**
 * Simple in-memory rate limiter for API routes.
 *
 * Uses a sliding window approach with configurable window size and max requests.
 * Since Cloudflare Workers are stateless across invocations in production,
 * this primarily protects against bursts within a single worker instance.
 * For distributed rate limiting, use Cloudflare Rate Limiting rules or KV.
 *
 * Usage in an API route:
 *   import { rateLimit } from "@/lib/rate-limit";
 *
 *   const limiter = rateLimit({ windowMs: 60_000, max: 30 });
 *
 *   export async function GET(request: Request) {
 *     const limited = limiter.check(request);
 *     if (limited) return limited; // Returns 429 response
 *     // ... handle request
 *   }
 */

import { NextResponse } from "next/server";

type RateLimitConfig = {
  /** Time window in milliseconds (default: 60_000 = 1 minute) */
  windowMs?: number;
  /** Max requests per window per key (default: 60) */
  max?: number;
  /** Custom key extractor. Defaults to IP address or "anonymous" */
  keyFn?: (request: Request) => string;
};

type Entry = {
  timestamps: number[];
};

const store = new Map<string, Entry>();

// Periodic cleanup of expired entries (every 5 minutes)
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 300_000;

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  const cutoff = now - windowMs * 2;
  for (const [key, entry] of store) {
    const latest = entry.timestamps[entry.timestamps.length - 1] ?? 0;
    if (latest < cutoff) {
      store.delete(key);
    }
  }
}

function getClientIp(request: Request): string {
  // Cloudflare Workers
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;

  // Standard proxies
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "anonymous";
}

export function rateLimit(config: RateLimitConfig = {}) {
  const { windowMs = 60_000, max = 60, keyFn } = config;

  return {
    /**
     * Check if the request is rate-limited.
     * Returns a 429 NextResponse if limited, or null if allowed.
     */
    check(request: Request): NextResponse | null {
      cleanup(windowMs);

      const key = keyFn ? keyFn(request) : getClientIp(request);
      const now = Date.now();
      const windowStart = now - windowMs;

      let entry = store.get(key);
      if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
      }

      // Remove timestamps outside the window
      entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

      if (entry.timestamps.length >= max) {
        const retryAfter = Math.ceil((entry.timestamps[0] + windowMs - now) / 1000);
        return NextResponse.json(
          { error: "Too many requests. Please try again shortly." },
          {
            status: 429,
            headers: {
              "Retry-After": String(retryAfter),
              "X-RateLimit-Limit": String(max),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": String(Math.ceil((entry.timestamps[0] + windowMs) / 1000)),
            },
          },
        );
      }

      entry.timestamps.push(now);

      return null; // Not rate-limited
    },
  };
}

/** Pre-configured limiters for common use cases */
export const apiLimiter = rateLimit({ windowMs: 60_000, max: 60 });
export const authLimiter = rateLimit({ windowMs: 60_000, max: 10 });
export const adminLimiter = rateLimit({ windowMs: 60_000, max: 120 });
