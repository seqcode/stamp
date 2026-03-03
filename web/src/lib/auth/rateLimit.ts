import { getRedisConnection } from "@/lib/queue/bullmq";
import { NextRequest, NextResponse } from "next/server";

interface RateLimitConfig {
  /** Window duration in milliseconds (e.g. 3600000 for 1 hour). */
  windowMs: number;
  /** Maximum requests allowed within the window. */
  maxRequests: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Unix timestamp (ms) when the current window resets. */
  resetAt: number;
}

/**
 * Fixed-window rate limiter backed by Redis INCR + EXPIRE.
 * Keys are automatically scoped by the provided key string and
 * the current time window.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRedisConnection();
  const windowSec = Math.ceil(config.windowMs / 1000);
  const now = Date.now();
  const windowId = Math.floor(now / config.windowMs);
  const redisKey = `ratelimit:${key}:${windowId}`;

  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.expire(redisKey, windowSec);
  }

  const allowed = count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - count);
  const resetAt = (windowId + 1) * config.windowMs;

  return { allowed, remaining, resetAt };
}

/**
 * Extract the client IP address from the request.
 * Checks x-forwarded-for and x-real-ip headers (set by reverse proxies),
 * falling back to "unknown".
 */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.ip ||
    "unknown"
  );
}

/**
 * Rate-limit helper for use at the top of route handlers.
 *
 * Returns a 429 NextResponse if the limit is exceeded, or null if the
 * request is allowed. Usage:
 *
 * ```ts
 * const limited = await withRateLimit(request, "jobs", {
 *   windowMs: 3600000, maxRequests: 20
 * });
 * if (limited) return limited;
 * ```
 */
export async function withRateLimit(
  request: NextRequest,
  route: string,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  const result = await checkRateLimit(`${ip}:${route}`, config);

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  return null; // Allowed — proceed with the route handler
}
