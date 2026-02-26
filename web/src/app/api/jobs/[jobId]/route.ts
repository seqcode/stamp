import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Job } from "@/lib/db/models/Job";

export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    await connectDB();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const job = await Job.findOne({ jobId: params.jobId }).lean() as any;

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    return NextResponse.json({
      jobId: job.jobId,
      status: job.status,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      input: {
        motifCount: job.input?.motifs?.length || 0,
        fileName: job.input?.fileName,
        motifNames: job.input?.motifs?.map(
          (m: { name: string }) => m.name
        ),
      },
      params: job.params,
      matching: job.matching,
      results: job.results,
      error: job.error,
    });
  } catch (error) {
    console.error("Job fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
