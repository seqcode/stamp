import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Job } from "@/lib/db/models/Job";
import archiver from "archiver";
import fs from "fs";
import path from "path";
import { PassThrough } from "stream";

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

    if (job.status !== "complete") {
      return NextResponse.json(
        { error: "Job is not yet complete." },
        { status: 400 }
      );
    }

    if (!job.files?.resultsDir) {
      return NextResponse.json(
        { error: "No result files available." },
        { status: 404 }
      );
    }

    const resultsDir = job.files.resultsDir;
    if (!fs.existsSync(resultsDir)) {
      return NextResponse.json(
        { error: "Result files have been cleaned up." },
        { status: 404 }
      );
    }

    // Create ZIP archive
    const archive = archiver("zip", { zlib: { level: 6 } });
    const passThrough = new PassThrough();
    archive.pipe(passThrough);

    // Add result files
    const outputPrefix = path.basename(job.files.outputPrefix || "out");
    const filesToInclude = [
      { name: `${outputPrefix}.tree`, label: "tree.nwk" },
      { name: `${outputPrefix}_match_pairs.txt`, label: "match_pairs.txt" },
      { name: `${outputPrefix}_matched.transfac`, label: "matched_motifs.transfac" },
      { name: `${outputPrefix}FBP.txt`, label: "fbp_profile.txt" },
      { name: "input.transfac", label: "input.transfac" },
    ];

    for (const { name, label } of filesToInclude) {
      const filePath = path.join(resultsDir, name);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: label });
      }
    }

    // Add results summary as JSON
    if (job.results) {
      archive.append(JSON.stringify(job.results, null, 2), {
        name: "results.json",
      });
    }

    archive.finalize();

    // Convert stream to response
    const chunks: Uint8Array[] = [];
    for await (const chunk of passThrough) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="stamp-${params.jobId}.zip"`,
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
