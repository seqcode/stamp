import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createSession, destroySession } from "@/lib/auth/session";
import { withRateLimit } from "@/lib/auth/rateLimit";
import { connectDB } from "@/lib/db/mongoose";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

// Warn at startup if the default password hasn't been changed
if (ADMIN_PASSWORD === "change-me-in-production") {
  console.warn(
    "WARNING: ADMIN_PASSWORD is set to the default value. " +
      "Change it immediately before deploying to production!"
  );
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 attempts per 15 minutes per IP (brute-force protection)
    const rateLimited = await withRateLimit(request, "admin-auth", {
      windowMs: 15 * 60 * 1000,
      maxRequests: 10,
    });
    if (rateLimited) return rateLimited;

    await connectDB();

    const { password } = await request.json();

    if (!ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Admin access is not configured." },
        { status: 503 }
      );
    }

    // Reject default password in production
    if (
      process.env.NODE_ENV === "production" &&
      ADMIN_PASSWORD === "change-me-in-production"
    ) {
      return NextResponse.json(
        {
          error:
            "Admin password must be changed in production. Update ADMIN_PASSWORD in your environment.",
        },
        { status: 503 }
      );
    }

    // Timing-safe comparison
    const expected = Buffer.from(ADMIN_PASSWORD);
    const provided = Buffer.from(password || "");

    const isValid =
      expected.length === provided.length &&
      timingSafeEqual(expected, provided);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid password." },
        { status: 401 }
      );
    }

    // Create a cryptographic session (replaces static "authenticated" cookie)
    const { sessionToken, csrfToken } = await createSession();

    const response = NextResponse.json({ success: true, csrfToken });
    response.cookies.set("stamp-admin", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60, // 24 hours
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get("stamp-admin")?.value;
    if (token) {
      await destroySession(token);
    }
    const response = NextResponse.json({ success: true });
    response.cookies.delete("stamp-admin");
    return response;
  } catch {
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
