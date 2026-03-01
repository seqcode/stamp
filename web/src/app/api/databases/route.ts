import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { ReferenceDatabase } from "@/lib/db/models/ReferenceDatabase";
import { Motif } from "@/lib/db/models/Motif";

export async function GET() {
  try {
    await connectDB();

    const databases = await ReferenceDatabase.find({ isActive: true })
      .sort({ source: 1, name: 1 })
      .lean();

    // Get per-group motif counts in a single aggregation
    const dbIds = databases.map((db) => db._id);
    const groupCounts = await Motif.aggregate([
      { $match: { databaseRef: { $in: dbIds } } },
      { $group: { _id: { db: "$databaseRef", group: "$group" }, count: { $sum: 1 } } },
    ]);

    // Build a lookup: dbId -> { groupName -> count }
    const countsByDb = new Map<string, Record<string, number>>();
    for (const row of groupCounts) {
      const dbKey = String(row._id.db);
      if (!countsByDb.has(dbKey)) countsByDb.set(dbKey, {});
      countsByDb.get(dbKey)![row._id.group] = row.count;
    }

    const result = databases.map((db) => {
      const dbKey = String(db._id);
      const groupCountMap = countsByDb.get(dbKey) || {};

      return {
        slug: db.slug,
        name: db.name,
        source: db.source,
        version: db.version || null,
        motifCount: db.motifCount,
        taxonGroups: db.taxonGroups,
        groupCounts: groupCountMap,
        lastSyncedAt: db.lastSyncedAt,
      };
    });

    return NextResponse.json({ databases: result });
  } catch (error) {
    console.error("Failed to fetch databases:", error);
    return NextResponse.json(
      { error: "Failed to fetch databases." },
      { status: 500 }
    );
  }
}
