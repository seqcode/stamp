import type { StampParams } from "@/types";
import path from "path";
import fs from "fs";

function getScoreDistsDir() {
  return process.env.SCORE_DISTS_DIR || path.resolve(process.cwd(), "../ScoreDists");
}

/**
 * Select the correct score distribution file based on STAMP parameters.
 *
 * File naming pattern: JaspRand_{METRIC}_{ALIGN}[_go{X}_ge{Y}][_oa][_eo].scores
 *
 * For SWU (ungapped), no gap params: JaspRand_PCC_SWU.scores
 * For gapped methods: JaspRand_PCC_SWA_go1.0_ge0.5.scores
 * _oa suffix = overlap align, _eo suffix = extend overlap
 */
export function selectScoreDistFile(params: StampParams): string {
  const { columnMetric, alignmentMethod, gapOpen, gapExtend, overlapAlign } =
    params;

  let filename = `JaspRand_${columnMetric}_${alignmentMethod}`;

  if (alignmentMethod === "SWU") {
    // Ungapped — no gap parameters in filename
    filename += ".scores";
  } else {
    // Gapped methods (SWA, SW, NW) include gap penalties
    const goStr = formatNumber(gapOpen);
    const geStr = formatNumber(gapExtend);
    filename += `_go${goStr}_ge${geStr}`;

    if (overlapAlign) {
      filename += "_oa";
    }

    filename += ".scores";
  }

  const filePath = path.join(getScoreDistsDir(), filename);

  // Check if the exact file exists
  if (fs.existsSync(filePath)) {
    return filePath;
  }

  // Try without _oa suffix if not found with it
  if (overlapAlign && alignmentMethod !== "SWU") {
    const altFilename = filename.replace("_oa.scores", ".scores");
    const altPath = path.join(getScoreDistsDir(), altFilename);
    if (fs.existsSync(altPath)) {
      return altPath;
    }
  }

  // Try with _oa suffix if not found without it
  if (!overlapAlign && alignmentMethod !== "SWU") {
    const altFilename = filename.replace(".scores", "_oa.scores");
    const altPath = path.join(getScoreDistsDir(), altFilename);
    if (fs.existsSync(altPath)) {
      return altPath;
    }
  }

  throw new Error(
    `No score distribution file found for parameters: ` +
      `metric=${columnMetric}, alignment=${alignmentMethod}, ` +
      `gapOpen=${gapOpen}, gapExtend=${gapExtend}. ` +
      `Expected: ${filename}`
  );
}

/**
 * Format a number for the filename.
 * Integers stay as integers (e.g., 1000), decimals keep one place (e.g., 1.0)
 */
function formatNumber(n: number): string {
  if (Number.isInteger(n) && n >= 100) {
    return n.toString();
  }
  // Check if it matches the file naming (e.g., 1.0, 0.5)
  return n.toFixed(1).replace(/\.0$/, ".0");
}

/**
 * List all available score distribution files.
 */
export function listAvailableScoreDists(): string[] {
  if (!fs.existsSync(getScoreDistsDir())) {
    return [];
  }
  return fs
    .readdirSync(getScoreDistsDir())
    .filter((f) => f.endsWith(".scores"))
    .sort();
}
