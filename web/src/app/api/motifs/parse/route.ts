import { NextRequest, NextResponse } from "next/server";
import { parseMotifs } from "@/lib/motif/parsers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const motifText = body.motifText as string;

    if (!motifText || motifText.trim() === "") {
      return NextResponse.json(
        { error: "No motif data provided." },
        { status: 400 }
      );
    }

    if (motifText.length > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Input exceeds 10MB limit." },
        { status: 400 }
      );
    }

    const { motifs, detectedFormat } = parseMotifs(motifText);

    return NextResponse.json({
      format: detectedFormat,
      count: motifs.length,
      motifs: motifs.map((m) => ({
        name: m.name,
        length: m.matrix.length,
        matrix: m.matrix,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to parse motif input.",
      },
      { status: 400 }
    );
  }
}
