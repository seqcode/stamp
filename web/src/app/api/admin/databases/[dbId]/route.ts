import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { ReferenceDatabase } from "@/lib/db/models/ReferenceDatabase";
import { Motif } from "@/lib/db/models/Motif";
import { isAdmin, validateCsrf } from "@/lib/auth/session";

export async function GET(
  request: NextRequest,
  { params }: { params: { dbId: string } }
) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = await ReferenceDatabase.findById(params.dbId).lean() as any;
  if (!db) {
    return NextResponse.json({ error: "Database not found" }, { status: 404 });
  }

  // Get motif counts by taxon group
  const taxonCounts = await Motif.aggregate([
    { $match: { databaseRef: db._id } },
    { $group: { _id: "$taxGroup", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  return NextResponse.json({
    database: db,
    taxonCounts: taxonCounts.map((t) => ({
      taxGroup: t._id,
      count: t.count,
    })),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { dbId: string } }
) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  await connectDB();

  const db = await ReferenceDatabase.findById(params.dbId);
  if (!db) {
    return NextResponse.json({ error: "Database not found" }, { status: 404 });
  }

  // Delete all associated motifs
  await Motif.deleteMany({ databaseRef: db._id });
  await db.deleteOne();

  return NextResponse.json({ success: true });
}
