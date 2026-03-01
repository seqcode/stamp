import { Job as BullJob } from "bullmq";
import fs from "fs";
import path from "path";
import { Job as JobModel } from "../src/lib/db/models/Job";
import { Motif } from "../src/lib/db/models/Motif";
import { ReferenceDatabase } from "../src/lib/db/models/ReferenceDatabase";
import { toStampTransfac } from "../src/lib/motif/converter";
import { selectScoreDistFile } from "../src/lib/stamp/scoreDistSelector";
import { runStamp } from "../src/lib/stamp/runner";
import { parseWebmodeOutput } from "../src/lib/stamp/parser";
import type { StampJobData } from "../src/lib/queue/jobs";
import type { JobResults, DatabaseSelection } from "../src/types";

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
    if (matching.enabled && matching.databases && matching.databases.length > 0) {
      matchFile = path.join(jobDir, "reference.transfac");
      await generateReferenceDb(matchFile, matching.databases);
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

    console.log(`STAMP exit code: ${result.exitCode}, stdout length: ${result.stdout.length}, stderr length: ${result.stderr.length}`);
    if (result.stdout.length < 200) {
      console.log(`STAMP stdout: ${result.stdout}`);
    } else {
      console.log(`STAMP stdout (first 200): ${result.stdout.substring(0, 200)}`);
    }
    if (result.stderr) {
      console.log(`STAMP stderr: ${result.stderr}`);
    }

    if (result.exitCode !== 0 && result.stderr) {
      throw new Error(`STAMP exited with code ${result.exitCode}: ${result.stderr}`);
    }

    // Update status to processing results
    await JobModel.updateOne({ jobId }, { status: "processing_results" });

    // Parse webmode structured output
    const parsed = parseWebmodeOutput(result.stdout);

    // Build input motif lookup for enriching match results with query matrices
    const inputMotifMap = new Map<string, number[][]>();
    for (const m of motifs) {
      inputMotifMap.set(m.name, m.matrix);
    }

    // Build URL pattern and home URL lookups from selected databases
    const urlPatternMap = new Map<string, string>();
    const dbHomeUrlMap = new Map<string, string>();
    if (matching.databases && matching.databases.length > 0) {
      const slugs = matching.databases.map((d) => d.slug);
      const refDbs = await ReferenceDatabase.find({ slug: { $in: slugs } }).lean() as Array<{ source?: string; urlPattern?: string }>;
      for (const db of refDbs) {
        if (db.source && db.urlPattern) {
          const key = db.source.toUpperCase();
          urlPatternMap.set(key, db.urlPattern);
          try {
            dbHomeUrlMap.set(key, new URL(db.urlPattern).origin);
          } catch {
            // If urlPattern isn't a valid URL, skip home URL
          }
        }
      }
    }

    // Enrich match results with query motif matrices and database metadata
    const matchPairs = parsed.matchDetails || [];
    for (const matchResult of matchPairs) {
      for (const entry of matchResult.matches) {
        entry.queryMotifMatrix = inputMotifMap.get(matchResult.queryName) || null;

        // Parse "JASPAR::MA0139.1::CTCF" three-part format to extract DB metadata
        if (entry.name && entry.name.includes("::")) {
          const parts = entry.name.split("::");
          if (parts.length >= 3) {
            const [dbSource, matrixId, ...rest] = parts;
            const displayName = rest.join("::") || matrixId;
            entry.dbSource = dbSource;
            entry.dbId = matrixId;
            entry.name = displayName;
            const sourceKey = dbSource.toUpperCase();
            const pattern = urlPatternMap.get(sourceKey);
            if (pattern) {
              entry.dbUrl = pattern.replace("{id}", matrixId);
            }
            const homeUrl = dbHomeUrlMap.get(sourceKey);
            if (homeUrl) {
              entry.dbHomeUrl = homeUrl;
            }
          } else {
            // Legacy two-part format: "MA0139.1::CTCF"
            const [matrixId, ...rest] = parts;
            const displayName = rest.join("::");
            entry.dbId = matrixId;
            entry.dbSource = "JASPAR";
            entry.dbUrl = `https://jaspar.elixir.no/matrix/${matrixId}`;
            entry.dbHomeUrl = "https://jaspar.elixir.no";
            entry.name = displayName || matrixId;
          }
        }
      }
    }

    // Store input motifs for display
    const inputMotifsForResults = motifs.map((m) => ({
      name: m.name,
      matrix: m.matrix,
    }));

    const results: JobResults = {
      treeNewick: parsed.tree,
      matchPairs,
      pairwiseScores: parsed.pairwise,
      fbpProfile: parsed.fbp,
      multipleAlignment: parsed.enhancedAlignment,
      internalProfiles: parsed.internalProfiles,
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
 * Combines motifs from all selected databases into a single file.
 */
async function generateReferenceDb(
  outputPath: string,
  databases: DatabaseSelection[]
): Promise<void> {
  // Build query: for each database selection, find motifs matching the slug and groups
  const allMotifs: Array<{ dbSource: string; matrixId: string; name: string; pfm: { A: number[]; C: number[]; G: number[]; T: number[] } }> = [];

  for (const dbSel of databases) {
    const refDb = await ReferenceDatabase.findOne({ slug: dbSel.slug }).lean() as { _id: unknown; source?: string } | null;
    if (!refDb) continue;

    const query: Record<string, unknown> = { databaseRef: refDb._id };
    if (dbSel.groups.length > 0) {
      query.group = { $in: dbSel.groups };
    }

    const motifs = await Motif.find(query).lean();
    const dbSourceLabel = refDb.source?.toUpperCase() || "UNKNOWN";
    for (const m of motifs) {
      allMotifs.push({
        dbSource: (m as Record<string, unknown>).dbSource as string || dbSourceLabel,
        matrixId: m.matrixId,
        name: m.name,
        pfm: m.pfm,
      });
    }
  }

  if (allMotifs.length === 0) {
    const dbNames = databases.map((d) => d.slug).join(", ");
    throw new Error(
      `No motifs found for selected databases: ${dbNames}. ` +
        "Please sync databases first via the admin panel."
    );
  }

  const lines: string[] = [];
  for (const motif of allMotifs) {
    // Three-part DE line: "JASPAR::MA0139.1::CTCF" — frontend parses this to extract DB info.
    const deName = `${motif.dbSource}::${motif.matrixId}::${motif.name}`;
    lines.push(`DE\t${deName}\t`);
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
