import { execFile } from "child_process";
import { promisify } from "util";
import type { StampParams } from "@/types";

const execFileAsync = promisify(execFile);

function getStampBinary() {
  return process.env.STAMP_BINARY || "stamp";
}
function getJobTimeout() {
  return Number(process.env.JOB_TIMEOUT_MS) || 300000;
}

export interface StampRunOptions {
  inputFile: string;
  scoreDistFile: string;
  params: StampParams;
  outputPrefix: string;
  matchFile?: string;
  matchTop?: number;
}

export interface StampRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute the STAMP binary with the given parameters.
 * Uses execFile (not exec) to avoid shell injection.
 */
export async function runStamp(
  options: StampRunOptions
): Promise<StampRunResult> {
  const args = buildArgs(options);

  const binaryPath = getStampBinary();
  const timeout = getJobTimeout();

  try {
    const { stdout, stderr } = await execFileAsync(binaryPath, args, {
      timeout,
      maxBuffer: 50 * 1024 * 1024, // 50MB output buffer
    });

    return { stdout, stderr, exitCode: 0 };
  } catch (error: unknown) {
    const err = error as {
      stdout?: string;
      stderr?: string;
      code?: number | string;
      killed?: boolean;
    };

    if (err.killed) {
      throw new Error(
        `STAMP process was killed (timeout after ${timeout / 1000}s)`
      );
    }

    return {
      stdout: err.stdout || "",
      stderr: err.stderr || "",
      exitCode: typeof err.code === "number" ? err.code : 1,
    };
  }
}

/**
 * Build command-line arguments for the STAMP binary.
 * See src/main.cpp for the complete list of flags.
 */
function buildArgs(options: StampRunOptions): string[] {
  const { inputFile, scoreDistFile, params, outputPrefix } = options;
  const args: string[] = [];

  // Required arguments
  args.push("-tf", inputFile);
  args.push("-sd", scoreDistFile);
  args.push("-out", outputPrefix);

  // Column comparison metric
  args.push("-cc", params.columnMetric);

  // Alignment method
  args.push("-align", params.alignmentMethod);

  // Gap penalties (only for gapped methods)
  if (params.alignmentMethod !== "SWU") {
    args.push("-go", params.gapOpen.toString());
    args.push("-ge", params.gapExtend.toString());
  }

  // Overlap alignment
  if (params.overlapAlign) {
    args.push("-overlapalign");
  } else {
    args.push("-nooverlapalign");
  }

  // Forward only
  if (params.forwardOnly) {
    args.push("-forwardonly");
  }

  // Multiple alignment
  args.push("-ma", params.multipleAlignment);

  // Tree building
  args.push("-tree", params.treeMethod);

  // Webmode: structured stdout output with all results in delimited sections
  args.push("-webmode");

  // Similarity matching
  if (options.matchFile) {
    args.push("-match", options.matchFile);
    if (options.matchTop) {
      args.push("-match_top", options.matchTop.toString());
    }
  }

  return args;
}
