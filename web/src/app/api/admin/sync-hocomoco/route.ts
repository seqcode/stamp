import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { syncHocomoco } from "@/lib/hocomoco/sync";
import { isAdmin, validateCsrf } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  try {
    await connectDB();

    const body = await request.json().catch(() => ({}));
    const collection = body.collection === "H14CORE-CLUSTERED"
      ? "H14CORE-CLUSTERED" as const
      : "H14CORE" as const;

    const result = await syncHocomoco(collection);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        error: `HOCOMOCO sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 }
    );
  }
}
