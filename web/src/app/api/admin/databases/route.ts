import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { ReferenceDatabase } from "@/lib/db/models/ReferenceDatabase";
import { syncJaspar } from "@/lib/jaspar/sync";

function isAdmin(request: NextRequest): boolean {
  return request.cookies.get("stamp-admin")?.value === "authenticated";
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const databases = await ReferenceDatabase.find().sort({ name: 1 }).lean();
  return NextResponse.json({ databases });
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const body = await request.json();
  const { action, collection, taxonGroups, fullSync } = body;

  if (action === "sync") {
    try {
      const result = await syncJaspar({
        collection: collection || "CORE",
        taxonGroups: taxonGroups?.length > 0 ? taxonGroups : undefined,
        fullSync: fullSync || false,
      });

      return NextResponse.json({
        success: true,
        result,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: `Sync failed: ${error instanceof Error ? error.message : String(error)}`,
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
