import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { syncCisbpFromWeb, syncCisbp } from "@/lib/cisbp/sync";

function isAdmin(request: NextRequest): boolean {
  return request.cookies.get("stamp-admin")?.value === "authenticated";
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const contentType = request.headers.get("content-type") || "";

    // Multipart upload (legacy/fallback path)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("zipFile") as File | null;
      if (!file || file.size === 0) {
        return NextResponse.json(
          { error: "No ZIP file provided." },
          { status: 400 }
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await syncCisbp(buffer);
      return NextResponse.json({ success: true, result });
    }

    // JSON body — download directly from CIS-BP server
    const result = await syncCisbpFromWeb();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        error: `CIS-BP sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 }
    );
  }
}
