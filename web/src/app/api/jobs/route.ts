import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Job } from "@/lib/db/models/Job";
import { generateJobId } from "@/lib/utils/idGenerator";
import { jobSubmitSchema } from "@/lib/utils/validation";
import { parseMotifs } from "@/lib/motif/parsers";
import { enqueueStampJob } from "@/lib/queue/jobs";
import { DEFAULT_PARAMS } from "@/types";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    // Parse form data (supports both JSON and multipart)
    const contentType = request.headers.get("content-type") || "";
    let motifText = "";
    let fileName: string | null = null;
    let bodyParams: Record<string, unknown> = {};

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("motifFile") as File | null;
      motifText = (formData.get("motifText") as string) || "";
      const paramsJson = formData.get("params") as string;
      const matchingJson = formData.get("matching") as string;
      const email = formData.get("email") as string | null;

      if (file && file.size > 0) {
        motifText = await file.text();
        fileName = file.name;
      }

      bodyParams = {
        motifText,
        params: paramsJson ? JSON.parse(paramsJson) : {},
        matching: matchingJson ? JSON.parse(matchingJson) : {},
        email: email || null,
      };
    } else {
      bodyParams = await request.json();
      motifText = (bodyParams.motifText as string) || "";
    }

    // Validate input
    const validated = jobSubmitSchema.parse(bodyParams);

    if (!motifText || motifText.trim() === "") {
      return NextResponse.json(
        { error: "No motif data provided. Please paste or upload motif data." },
        { status: 400 }
      );
    }

    // Check file size (10MB limit)
    if (motifText.length > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Input exceeds 10MB limit." },
        { status: 400 }
      );
    }

    // Parse motifs
    let parseResult;
    try {
      parseResult = parseMotifs(motifText);
    } catch (parseError) {
      return NextResponse.json(
        {
          error:
            parseError instanceof Error
              ? parseError.message
              : "Failed to parse motif input.",
        },
        { status: 400 }
      );
    }

    const { motifs, detectedFormat } = parseResult;

    // Merge params with defaults
    const params = { ...DEFAULT_PARAMS, ...validated.params };
    const matching = {
      enabled: validated.matching.enabled,
      taxonGroups: validated.matching.taxonGroups,
      topMatches: validated.matching.topMatches,
      customDbFileKey: validated.matching.customDbFileKey,
    };

    // Create job
    const jobId = generateJobId();
    const job = new Job({
      jobId,
      status: "queued",
      input: {
        motifs: motifs.map((m) => ({
          name: m.name,
          matrix: m.matrix,
          format: detectedFormat,
        })),
        rawText: motifText.length < 1024 * 1024 ? motifText : null, // Only store raw text if < 1MB
        fileName,
      },
      params,
      matching,
      email: validated.email,
    });

    await job.save();

    // Enqueue job
    await enqueueStampJob({
      jobId,
      motifs,
      params,
      matching,
      email: validated.email || null,
    });

    return NextResponse.json({
      jobId,
      motifCount: motifs.length,
      detectedFormat,
    });
  } catch (error) {
    console.error("Job submission error:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input parameters.", details: error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
