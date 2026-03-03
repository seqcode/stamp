import { Motif } from "@/lib/db/models/Motif";
import { ReferenceDatabase } from "@/lib/db/models/ReferenceDatabase";
import { parseCisbpPwm, parseTfInformation } from "./parser";
import type { CisbpMotifInfo } from "./parser";
import type { Types } from "mongoose";
import AdmZip from "adm-zip";
import { Readable } from "stream";
import * as readline from "readline";
import unzipper from "unzipper";

export interface CisbpSyncResult {
  totalMotifs: number;
  totalStored: number;
  species: string[];
  errors: string[];
}

const CISBP_BASE_URL =
  "https://cisbp.ccbr.utoronto.ca/data/3_00/DataFiles/Bulk_downloads/EntireDataset";

const CISBP_URL_PATTERN =
  "https://cisbp.ccbr.utoronto.ca/TFnewreport.php?searchTF={id}";

/**
 * Sync CIS-BP motifs by downloading directly from the CIS-BP server.
 * Uses streaming ZIP extraction to avoid loading large files into memory as strings.
 */
export async function syncCisbpFromWeb(): Promise<CisbpSyncResult> {
  // ── Download & parse TF_Information (streaming, line-by-line) ────────────
  console.log("Downloading CIS-BP TF_Information_all_motifs.txt.zip...");
  const tfRes = await fetch(
    `${CISBP_BASE_URL}/TF_Information_all_motifs.txt.zip`
  );
  if (!tfRes.ok) {
    throw new Error(
      `Failed to download TF_Information: ${tfRes.status} ${tfRes.statusText}`
    );
  }
  if (!tfRes.body) {
    throw new Error("TF_Information response has no body");
  }

  // Convert the Web ReadableStream to a Node.js Readable for unzipper
  const tfNodeStream = Readable.fromWeb(
    tfRes.body as Parameters<typeof Readable.fromWeb>[0]
  );
  const tfInfoMap = await parseTfInfoFromZipStream(tfNodeStream);
  console.log(`Parsed ${tfInfoMap.size} TF entries`);

  // ── Download & process PWMs (streaming) ──────────────────────────────────
  console.log("Downloading CIS-BP PWMs.zip...");
  const pwmRes = await fetch(`${CISBP_BASE_URL}/PWMs.zip`);
  if (!pwmRes.ok) {
    throw new Error(
      `Failed to download PWMs: ${pwmRes.status} ${pwmRes.statusText}`
    );
  }
  if (!pwmRes.body) {
    throw new Error("PWMs response has no body");
  }

  const pwmNodeStream = Readable.fromWeb(
    pwmRes.body as Parameters<typeof Readable.fromWeb>[0]
  );
  return storeCisbpMotifsFromStream(pwmNodeStream, tfInfoMap);
}

/**
 * Import CIS-BP motifs from an uploaded ZIP file that contains both
 * TF_Information.txt and a pwms/ directory (legacy upload path).
 * Only suitable for smaller, user-uploaded ZIPs.
 */
export async function syncCisbp(zipBuffer: Buffer): Promise<CisbpSyncResult> {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  const tfInfoEntry = entries.find(
    (e) =>
      !e.isDirectory &&
      (e.entryName.endsWith("TF_Information.txt") ||
        e.entryName.endsWith("TF_Information_all_motifs.txt"))
  );
  if (!tfInfoEntry) {
    throw new Error(
      "Could not find TF_Information.txt in the ZIP file. " +
        "Please upload a CIS-BP bulk download ZIP."
    );
  }

  const tfInfoMap = parseTfInformation(
    tfInfoEntry.getData().toString("utf-8")
  );
  console.log(`Parsed ${tfInfoMap.size} motif entries from TF_Information`);

  const pwmEntries = entries.filter(
    (e) =>
      !e.isDirectory &&
      e.entryName.endsWith(".txt") &&
      e.entryName !== tfInfoEntry.entryName &&
      (e.entryName.includes("pwms/") ||
        e.entryName.includes("pwms_all_motifs/") ||
        !e.entryName.includes("/"))
  );
  console.log(`Found ${pwmEntries.length} PWM files`);

  return storeCisbpMotifs(tfInfoMap, pwmEntries);
}

// ── Streaming helpers (used by syncCisbpFromWeb) ─────────────────────────────

/**
 * Stream a ZIP from a Node.js Readable, find the first .txt entry,
 * and parse it as a TF_Information file line by line.
 */
async function parseTfInfoFromZipStream(
  zipStream: NodeJS.ReadableStream
): Promise<Map<string, CisbpMotifInfo>> {
  const directory = zipStream.pipe(
    unzipper.Parse({ forceStream: true })
  );

  for await (const rawEntry of directory) {
    const entry = rawEntry as unzipper.Entry;
    if (!entry.path.endsWith(".txt")) {
      entry.autodrain();
      continue;
    }
    return await parseTfInfoLines(entry);
  }

  throw new Error("TF_Information .txt not found inside downloaded archive");
}

/**
 * Parse a TF_Information file from a Node.js readable stream, line by line,
 * without ever creating a single large string in memory.
 *
 * Only rows with TF_Status === "D" (directly measured) are included,
 * so species labels accurately reflect direct binding evidence.
 */
async function parseTfInfoLines(
  stream: NodeJS.ReadableStream
): Promise<Map<string, CisbpMotifInfo>> {
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const result = new Map<string, CisbpMotifInfo>();

  let firstLine = true;
  let tfIdCol = -1,
    tfNameCol = -1,
    speciesCol = -1,
    familyCol = -1,
    motifIdCol = -1,
    msourceCol = -1,
    statusCol = -1;

  for await (const line of rl) {
    if (firstLine) {
      const header = line.split("\t");
      tfIdCol = header.indexOf("TF_ID");
      tfNameCol = header.indexOf("TF_Name");
      speciesCol = header.indexOf("TF_Species");
      familyCol = header.indexOf("Family_ID");
      motifIdCol = header.indexOf("Motif_ID");
      msourceCol = header.indexOf("MSource_Identifier");
      statusCol = header.indexOf("TF_Status");
      firstLine = false;
      continue;
    }

    if (motifIdCol === -1) continue;
    const parts = line.split("\t");
    if (parts.length <= motifIdCol) continue;

    // Only include directly-measured motif–species associations
    if (statusCol >= 0) {
      const status = parts[statusCol]?.trim();
      if (status !== "D") continue;
    }

    const motifId = parts[motifIdCol]?.trim();
    if (!motifId || motifId === "." || motifId === "") continue;
    if (result.has(motifId)) continue;

    result.set(motifId, {
      tfId: parts[tfIdCol]?.trim() || "",
      tfName: tfNameCol >= 0 ? parts[tfNameCol]?.trim() || "" : "",
      species: speciesCol >= 0 ? parts[speciesCol]?.trim() || "" : "",
      family: familyCol >= 0 ? parts[familyCol]?.trim() || "" : "",
      motifId,
      msourceId: msourceCol >= 0 ? parts[msourceCol]?.trim() || "" : "",
    });
  }

  return result;
}

/**
 * Stream a PWMs ZIP and store each motif to MongoDB in batches.
 * Each individual PWM file is small (~1 KB), so buffering per entry is safe.
 */
async function storeCisbpMotifsFromStream(
  zipStream: NodeJS.ReadableStream,
  tfInfoMap: Map<string, CisbpMotifInfo>
): Promise<CisbpSyncResult> {
  const slug = "cisbp";
  let refDb = await ReferenceDatabase.findOne({ slug });
  if (!refDb) {
    refDb = new ReferenceDatabase({
      name: "CIS-BP",
      slug,
      source: "cisbp",
      description: "Catalog of Inferred Sequence Binding Preferences",
      version: "Build 3.00",
      urlPattern: CISBP_URL_PATTERN,
      taxonGroups: [],
      isActive: true,
    });
    await refDb.save();
  } else {
    await ReferenceDatabase.updateOne(
      { _id: refDb._id },
      { version: "Build 3.00", urlPattern: CISBP_URL_PATTERN }
    );
  }

  const dbId = refDb._id as Types.ObjectId;
  await Motif.deleteMany({ databaseRef: dbId });

  const result: CisbpSyncResult = {
    totalMotifs: 0,
    totalStored: 0,
    species: [],
    errors: [],
  };

  const speciesSet = new Set<string>();
  const batchSize = 100;
  const motifDocs: Record<string, unknown>[] = [];

  const directory = zipStream.pipe(unzipper.Parse({ forceStream: true }));

  for await (const rawEntry of directory) {
    const entry = rawEntry as unzipper.Entry;
    const filePath = entry.path;

    if (!filePath.endsWith(".txt")) {
      entry.autodrain();
      continue;
    }

    const fileName = filePath.split("/").pop() || "";
    const motifId = fileName.replace(/\.txt$/, "");
    result.totalMotifs++;

    try {
      // Individual PWM files are tiny (~1 KB); buffering each is safe
      const content = await entry.buffer();
      const pfm = parseCisbpPwm(content.toString("utf-8"));
      if (!pfm) continue;

      const info = tfInfoMap.get(motifId);
      const species = info?.species || "Unknown";
      const tfName = info?.tfName || motifId;
      speciesSet.add(species);

      motifDocs.push({
        databaseRef: dbId,
        matrixId: motifId,
        baseId: info?.tfId || null,
        name: tfName,
        dbSource: "CIS-BP",
        group: species,
        family: info?.family || null,
        species: [],
        pfm,
        uniprotIds: [],
      });

      if (motifDocs.length >= batchSize) {
        await Motif.insertMany(motifDocs);
        result.totalStored += motifDocs.length;
        motifDocs.length = 0;
        if (result.totalStored % 1000 === 0) {
          console.log(`CIS-BP: stored ${result.totalStored} motifs so far...`);
        }
      }
    } catch (err) {
      result.errors.push(
        `Failed to parse ${motifId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  if (motifDocs.length > 0) {
    await Motif.insertMany(motifDocs);
    result.totalStored += motifDocs.length;
  }

  result.species = Array.from(speciesSet).sort();

  const motifCount = await Motif.countDocuments({ databaseRef: dbId });
  const storedGroups = await Motif.distinct("group", { databaseRef: dbId });

  await ReferenceDatabase.updateOne(
    { _id: dbId },
    { lastSyncedAt: new Date(), motifCount, taxonGroups: storedGroups }
  );

  console.log(
    `CIS-BP sync complete: ${result.totalStored} motifs from ${result.species.length} species, ${result.errors.length} errors`
  );

  return result;
}

// ── AdmZip-based storage (used by syncCisbp upload path) ─────────────────────

async function storeCisbpMotifs(
  tfInfoMap: Map<string, CisbpMotifInfo>,
  pwmEntries: AdmZip.IZipEntry[]
): Promise<CisbpSyncResult> {
  const result: CisbpSyncResult = {
    totalMotifs: pwmEntries.length,
    totalStored: 0,
    species: [],
    errors: [],
  };

  const slug = "cisbp";
  let refDb = await ReferenceDatabase.findOne({ slug });
  if (!refDb) {
    refDb = new ReferenceDatabase({
      name: "CIS-BP",
      slug,
      source: "cisbp",
      description: "Catalog of Inferred Sequence Binding Preferences",
      version: "Build 3.00",
      urlPattern: CISBP_URL_PATTERN,
      taxonGroups: [],
      isActive: true,
    });
    await refDb.save();
  } else {
    await ReferenceDatabase.updateOne(
      { _id: refDb._id },
      { version: "Build 3.00", urlPattern: CISBP_URL_PATTERN }
    );
  }

  const dbId = refDb._id as Types.ObjectId;
  await Motif.deleteMany({ databaseRef: dbId });

  const speciesSet = new Set<string>();
  const batchSize = 100;
  const motifDocs: Record<string, unknown>[] = [];

  for (const entry of pwmEntries) {
    const fileName = entry.entryName.split("/").pop() || "";
    const motifId = fileName.replace(/\.txt$/, "");

    try {
      const pfm = parseCisbpPwm(entry.getData().toString("utf-8"));
      if (!pfm) continue;

      const info = tfInfoMap.get(motifId);
      const species = info?.species || "Unknown";
      const tfName = info?.tfName || motifId;
      speciesSet.add(species);

      motifDocs.push({
        databaseRef: dbId,
        matrixId: motifId,
        baseId: info?.tfId || null,
        name: tfName,
        dbSource: "CIS-BP",
        group: species,
        family: info?.family || null,
        species: [],
        pfm,
        uniprotIds: [],
      });

      if (motifDocs.length >= batchSize) {
        await Motif.insertMany(motifDocs);
        result.totalStored += motifDocs.length;
        motifDocs.length = 0;
      }
    } catch (err) {
      result.errors.push(
        `Failed to parse ${motifId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  if (motifDocs.length > 0) {
    await Motif.insertMany(motifDocs);
    result.totalStored += motifDocs.length;
  }

  result.species = Array.from(speciesSet).sort();

  const motifCount = await Motif.countDocuments({ databaseRef: dbId });
  const storedGroups = await Motif.distinct("group", { databaseRef: dbId });

  await ReferenceDatabase.updateOne(
    { _id: dbId },
    { lastSyncedAt: new Date(), motifCount, taxonGroups: storedGroups }
  );

  console.log(
    `CIS-BP sync complete: ${result.totalStored} motifs from ${result.species.length} species, ${result.errors.length} errors`
  );

  return result;
}
