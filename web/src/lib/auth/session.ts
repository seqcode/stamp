import crypto from "crypto";
import { getRedisConnection } from "@/lib/queue/bullmq";
import type { NextRequest } from "next/server";

const SESSION_PREFIX = "stamp-session:";
const SESSION_TTL = 86400; // 24 hours in seconds

export interface SessionData {
  csrfToken: string;
}

/**
 * Create a new admin session with a cryptographically random token.
 * Stores session data (including CSRF token) in Redis with a 24-hour TTL.
 */
export async function createSession(): Promise<{
  sessionToken: string;
  csrfToken: string;
}> {
  const redis = getRedisConnection();
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const csrfToken = crypto.randomBytes(32).toString("hex");

  await redis.set(
    `${SESSION_PREFIX}${sessionToken}`,
    JSON.stringify({ csrfToken } satisfies SessionData),
    "EX",
    SESSION_TTL
  );

  return { sessionToken, csrfToken };
}

/**
 * Validate a session token and return the associated data, or null if invalid.
 */
export async function validateSession(
  token: string
): Promise<SessionData | null> {
  if (!token || token.length !== 64) return null;
  const redis = getRedisConnection();
  const raw = await redis.get(`${SESSION_PREFIX}${token}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

/**
 * Destroy a session by deleting it from Redis.
 */
export async function destroySession(token: string): Promise<void> {
  const redis = getRedisConnection();
  await redis.del(`${SESSION_PREFIX}${token}`);
}

/**
 * Check whether the incoming request has a valid admin session.
 * Replaces the previous static cookie check.
 */
export async function isAdmin(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("stamp-admin")?.value;
  if (!token) return false;
  const session = await validateSession(token);
  return session !== null;
}

/**
 * Validate that the request has both a valid session AND a matching CSRF token.
 * Use this for all state-changing (POST/DELETE) admin routes.
 */
export async function validateCsrf(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("stamp-admin")?.value;
  if (!token) return false;
  const session = await validateSession(token);
  if (!session) return false;

  const csrfHeader = request.headers.get("X-CSRF-Token");
  if (!csrfHeader) return false;

  // Timing-safe comparison to prevent token leakage
  const expected = Buffer.from(session.csrfToken);
  const provided = Buffer.from(csrfHeader);
  return (
    expected.length === provided.length &&
    crypto.timingSafeEqual(expected, provided)
  );
}
