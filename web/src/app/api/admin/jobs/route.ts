import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Job } from "@/lib/db/models/Job";

function isAdmin(request: NextRequest): boolean {
  return request.cookies.get("stamp-admin")?.value === "authenticated";
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const [total, queued, running, complete, failed] = await Promise.all([
    Job.countDocuments(),
    Job.countDocuments({ status: "queued" }),
    Job.countDocuments({ status: "running" }),
    Job.countDocuments({ status: "complete" }),
    Job.countDocuments({ status: "failed" }),
  ]);

  // Recent jobs
  const recentJobs = await Job.find()
    .select("jobId status createdAt completedAt input.motifs")
    .sort({ createdAt: -1 })
    .limit(20)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .lean() as any[];

  return NextResponse.json({
    stats: { total, queued, running, complete, failed },
    recentJobs: recentJobs.map((j: Record<string, any>) => ({
      jobId: j.jobId,
      status: j.status,
      createdAt: j.createdAt,
      completedAt: j.completedAt,
      motifCount: j.input?.motifs?.length || 0,
    })),
  });
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const { action, olderThanDays } = await request.json();

  if (action === "cleanup") {
    const days = olderThanDays || 7;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await Job.deleteMany({ createdAt: { $lt: cutoff } });

    return NextResponse.json({
      success: true,
      deleted: result.deletedCount,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
