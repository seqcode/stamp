import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { syncHocomoco } from "@/lib/hocomoco/sync";

function isAdmin(request: NextRequest): boolean {
  return request.cookies.get("stamp-admin")?.value === "authenticated";
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
