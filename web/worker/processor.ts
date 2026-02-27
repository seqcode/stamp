import { Job as BullJob } from "bullmq";
import fs from "fs";
import path from "path";
import { Job as JobModel } from "../src/lib/db/models/Job";
import { Motif } from "../src/lib/db/models/Motif";
import { toStampTransfac } from "../src/lib/motif/converter";
import { selectScoreDistFile } from "../src/lib/stamp/scoreDistSelector";
import { runStamp } from "../src/lib/stamp/runner";
import {
  parseTreeFile,
  parseMatchPairs,
  parseMatchedTransfac,
  parsePairwiseScores,
  parseFBP,
  parseMultipleAlignment,
} from "../src/lib/stamp/parser";
import type { StampJobData } from "../src/lib/queue/jobs";
import type { JobResults } from "../src/types";

const JOBS_DATA_DIR = process.env.JOBS_DATA_DIR || "/tmp/stamp-jobs";

export async function processStampJob(job: BullJob<StampJobData>): Promise<void> {
  const { jobId, motifs, params, matching, email } = job.data;

  console.log(`Processing job ${jobId}: ${motifs.length} motifs`);

  // Update status to running
  await JobModel.updateOne({ jobId }, { status: "running" });

  const jobDir = path.join(JOBS_DATA_DIR, jobId);
  const outputPrefix = path.join(jobDir, "out");

  try {
    // Create job directory
    fs.mkdirSync(jobDir, { recursive: true });

    // Write input motifs to TRANSFAC file
    const inputFile = path.join(jobDir, "input.transfac");
    const transfacContent = toStampTransfac(motifs);
    fs.writeFileSync(inputFile, transfacContent, "utf-8");

    // Select score distribution file
    const scoreDistFile = selectScoreDistFile(params);

    // Prepare match database file if matching is enabled
    let matchFile: string | undefined;
    if (matching.enabled && matching.taxonGroups.length > 0) {
      matchFile = path.join(jobDir, "reference.transfac");
      await generateReferenceDb(matchFile, matching.taxonGroups);
    } else if (matching.enabled && matching.customDbFileKey) {
      matchFile = matching.customDbFileKey;
    }

    // Store file paths
    await JobModel.updateOne(
      { jobId },
      {
        files: {
          inputTransfac: inputFile,
          scoreDistFile,
          matchDbFile: matchFile || null,
          outputPrefix,
          resultsDir: jobDir,
        },
      }
    );

    // Run STAMP
    const result = await runStamp({
      inputFile,
      scoreDistFile,
      params,
      outputPrefix,
      matchFile,
      matchTop: matching.topMatches,
    });

    if (result.exitCode !== 0 && result.stderr) {
      throw new Error(`STAMP exited with code ${result.exitCode}: ${result.stderr}`);
    }

    // Update status to processing results
    await JobModel.updateOne({ jobId }, { status: "processing_results" });

    // Parse results
    const treeNewick = parseTreeFile(outputPrefix);
    const matchPairs = parseMatchPairs(outputPrefix);
    const pairwiseScores = parsePairwiseScores(result.stdout);
    const fbpProfile = parseFBP(outputPrefix);
    const multipleAlignmentRaw = parseMultipleAlignment(result.stdout);

    // Build input motif lookup for query matrices
    const inputMotifMap = new Map<string, number[][]>();
    for (const m of motifs) {
      inputMotifMap.set(m.name, m.matrix);
    }

    // Build multiple alignment with original matrices
    const multipleAlignment = multipleAlignmentRaw
      ? multipleAlignmentRaw.map((entry) => ({
          name: entry.name,
          alignedSequence: entry.alignedSequence,
          originalMatrix: inputMotifMap.get(entry.name) || [],
        }))
      : null;

    // Enrich match results with motif matrices
    const matchedMotifs = parseMatchedTransfac(outputPrefix);
    for (const matchResult of matchPairs) {
      for (const entry of matchResult.matches) {
        const matrix = matchedMotifs.get(entry.name);
        if (matrix) {
          entry.matchMotifMatrix = matrix;
        }
        // Also attach the query motif matrix
        entry.queryMotifMatrix = inputMotifMap.get(matchResult.queryName) || null;
      }
    }

    // Store input motifs for display
    const inputMotifsForResults = motifs.map((m) => ({
      name: m.name,
      matrix: m.matrix,
    }));

    const results: JobResults = {
      treeNewick,
      matchPairs,
      pairwiseScores,
      fbpProfile,
      multipleAlignment,
      inputMotifs: inputMotifsForResults,
      stampStdout: result.stdout,
    };

    // Store results and mark complete
    await JobModel.updateOne(
      { jobId },
      {
        status: "complete",
        completedAt: new Date(),
        results,
      }
    );

    // Send email notification if configured
    if (email) {
      try {
        await sendEmailNotification(jobId, email);
      } catch (emailErr) {
        console.error(`Failed to send email for job ${jobId}:`, emailErr);
      }
    }

    console.log(`Job ${jobId} completed successfully`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Job ${jobId} failed:`, errorMsg);

    await JobModel.updateOne(
      { jobId },
      {
        status: "failed",
        error: errorMsg,
      }
    );

    throw error;
  }
}

/**
 * Generate a TRANSFAC reference database file from MongoDB motifs.
 */
async function generateReferenceDb(
  outputPath: string,
  taxonGroups: string[]
): Promise<void> {
  const motifs = await Motif.find({ taxGroup: { $in: taxonGroups } }).lean();

  if (motifs.length === 0) {
    throw new Error(
      `No motifs found for taxon groups: ${taxonGroups.join(", ")}. ` +
        "Please sync the JASPAR database first via the admin panel."
    );
  }

  const lines: string[] = [];
  for (const motif of motifs) {
    lines.push(`DE\t${motif.name}\t`);
    const length = motif.pfm.A.length;
    for (let pos = 0; pos < length; pos++) {
      lines.push(
        `${pos}\t${motif.pfm.A[pos]}\t${motif.pfm.C[pos]}\t${motif.pfm.G[pos]}\t${motif.pfm.T[pos]}\tN`
      );
    }
    lines.push("XX");
  }

  fs.writeFileSync(outputPath, lines.join("\n") + "\n", "utf-8");
}

async function sendEmailNotification(
  jobId: string,
  email: string
): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;
  if (!smtpHost) return; // Email not configured

  // Dynamic import to avoid loading nodemailer when not needed
  const nodemailer = await import("nodemailer");
  const publicUrl = process.env.PUBLIC_URL || "http://localhost:3000";

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(process.env.SMTP_PORT) || 587,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "noreply@stamp.example.com",
    to: email,
    subject: `STAMP Analysis Complete - Job ${jobId}`,
    text:
      `Your STAMP analysis job has completed.\n\n` +
      `View results: ${publicUrl}/jobs/${jobId}\n\n` +
      `Results will be available for 7 days.`,
    html:
      `<p>Your STAMP analysis job has completed.</p>` +
      `<p><a href="${publicUrl}/jobs/${jobId}">View Results</a></p>` +
      `<p><small>Results will be available for 7 days.</small></p>`,
  });
}
