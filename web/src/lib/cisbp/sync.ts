import { Motif } from "@/lib/db/models/Motif";
import { ReferenceDatabase } from "@/lib/db/models/ReferenceDatabase";
import { parseCisbpPwm, parseTfInformation } from "./parser";
import type { CisbpMotifInfo } from "./parser";
import type { Types } from "mongoose";
import AdmZip from "adm-zip";

export interface CisbpSyncResult {
  totalMotifs: number;
  totalStored: number;
  species: string[];
  errors: string[];
}

const CISBP_BASE_URL =
  "https://cisbp.ccbr.utoronto.ca/data/3_00/DataFiles/Bulk_downloads/EntireDataset";

/**
 * Sync CIS-BP motifs by downloading directly from the CIS-BP server.
 * Downloads TF_Information_all_motifs.txt.zip and PWMs.zip automatically.
 */
export async function syncCisbpFromWeb(): Promise<CisbpSyncResult> {
  // ── Download & parse TF_Information ──────────────────────────────────────
  console.log("Downloading CIS-BP TF_Information_all_motifs.txt.zip...");
  const tfRes = await fetch(`${CISBP_BASE_URL}/TF_Information_all_motifs.txt.zip`);
  if (!tfRes.ok) {
    throw new Error(
      `Failed to download TF_Information: ${tfRes.status} ${tfRes.statusText}`
    );
  }
  const tfZipBuffer = Buffer.from(await tfRes.arrayBuffer());
  const tfZip = new AdmZip(tfZipBuffer);
  const tfEntry = tfZip.getEntries().find(
    (e) => !e.isDirectory && e.entryName.endsWith(".txt")
  );
  if (!tfEntry) {
    throw new Error("TF_Information .txt not found inside downloaded archive");
  }
  const tfInfoMap = parseTfInformation(tfEntry.getData().toString("utf-8"));
  console.log(`Parsed ${tfInfoMap.size} TF entries`);

  // ── Download & extract PWMs ───────────────────────────────────────────────
  console.log("Downloading CIS-BP PWMs.zip...");
  const pwmRes = await fetch(`${CISBP_BASE_URL}/PWMs.zip`);
  if (!pwmRes.ok) {
    throw new Error(
      `Failed to download PWMs: ${pwmRes.status} ${pwmRes.statusText}`
    );
  }
  const pwmZipBuffer = Buffer.from(await pwmRes.arrayBuffer());
  const pwmZip = new AdmZip(pwmZipBuffer);
  const pwmEntries = pwmZip
    .getEntries()
    .filter((e) => !e.isDirectory && e.entryName.endsWith(".txt"));
  console.log(`Found ${pwmEntries.length} PWM files in archive`);

  return storeCisbpMotifs(tfInfoMap, pwmEntries);
}

/**
 * Import CIS-BP motifs from an uploaded ZIP file that contains both
 * TF_Information.txt and a pwms/ directory (legacy upload path).
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

// ── Shared storage logic ────────────────────────────────────────────────────

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

  // Find or create the reference database record
  const slug = "cisbp";
  let refDb = await ReferenceDatabase.findOne({ slug });
  if (!refDb) {
    refDb = new ReferenceDatabase({
      name: "CIS-BP",
      slug,
      source: "cisbp",
      description: "Catalog of Inferred Sequence Binding Preferences",
      version: "Build 3.00",
      urlPattern: "http://cisbp.ccbr.utoronto.ca/TFreport.php?searchTF={id}",
      taxonGroups: [],
      isActive: true,
    });
    await refDb.save();
  }

  const dbId = refDb._id as Types.ObjectId;

  // Full replace on each sync
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
