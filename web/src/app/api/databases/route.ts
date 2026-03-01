import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { ReferenceDatabase } from "@/lib/db/models/ReferenceDatabase";

export async function GET() {
  try {
    await connectDB();

    const databases = await ReferenceDatabase.find({ isActive: true })
      .sort({ source: 1, name: 1 })
      .lean();

    const result = databases.map((db) => ({
      slug: db.slug,
      name: db.name,
      source: db.source,
      version: db.version || null,
      motifCount: db.motifCount,
      taxonGroups: db.taxonGroups,
      lastSyncedAt: db.lastSyncedAt,
    }));

    return NextResponse.json({ databases: result });
  } catch (error) {
    console.error("Failed to fetch databases:", error);
    return NextResponse.json(
      { error: "Failed to fetch databases." },
      { status: 500 }
    );
  }
}
