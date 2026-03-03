import { Motif } from "@/lib/db/models/Motif";
import { ReferenceDatabase } from "@/lib/db/models/ReferenceDatabase";
import { parseMemePwms } from "./parser";
import type { Types } from "mongoose";

export interface VierstraSyncResult {
  totalMotifs: number;
  totalStored: number;
  families: string[];
  errors: string[];
}

const VIERSTRA_MEME_URL =
  "https://resources.altius.org/~jvierstra/projects/motif-clustering-v2.0beta/consensus_pwms.meme";

/**
 * Sync Vierstra clustered motif archetypes by downloading the MEME file
 * from the Altius Institute resource server.
 */
export async function syncVierstra(): Promise<VierstraSyncResult> {
  console.log("Downloading Vierstra consensus_pwms.meme...");
  console.log(`URL: ${VIERSTRA_MEME_URL}`);

  const res = await fetch(VIERSTRA_MEME_URL);
  if (!res.ok) {
    throw new Error(
      `Failed to download Vierstra MEME file: ${res.status} ${res.statusText}`
    );
  }

  const content = await res.text();
  console.log(`Downloaded ${content.length} bytes`);

  // Parse MEME format
  const motifRecords = parseMemePwms(content);
  console.log(`Parsed ${motifRecords.length} archetype motifs`);

  if (motifRecords.length === 0) {
    throw new Error("No motifs found in Vierstra MEME file");
  }

  // ── Find or create the ReferenceDatabase record ───────────────────────────
  const slug = "vierstra-clustered";
  const projectUrl =
    "https://resources.altius.org/~jvierstra/projects/motif-clustering-v2.0beta/";
  let refDb = await ReferenceDatabase.findOne({ slug });
  if (!refDb) {
    // Also check for old slug in case of rename
    refDb = await ReferenceDatabase.findOne({ slug: "vierstra-archetypes" });
  }
  if (!refDb) {
    refDb = new ReferenceDatabase({
      name: "Vierstra clustered",
      slug,
      source: "vierstra",
      description:
        "Non-redundant TF motif clustering v2.0 — consensus archetype models (Vierstra et al.)",
      version: "2.0",
      urlPattern: projectUrl,
      taxonGroups: [],
      isActive: true,
    });
    await refDb.save();
  } else {
    await ReferenceDatabase.updateOne(
      { _id: refDb._id },
      { slug, name: "Vierstra clustered", version: "2.0", urlPattern: projectUrl }
    );
  }

  const dbId = refDb._id as Types.ObjectId;

  // Remove old motifs for a full replace
  await Motif.deleteMany({ databaseRef: dbId });

  // ── Store motifs in batches, grouped by TF family ─────────────────────────
  const result: VierstraSyncResult = {
    totalMotifs: motifRecords.length,
    totalStored: 0,
    families: [],
    errors: [],
  };

  const familySet = new Set<string>();
  const batchSize = 100;
  const motifDocs: Record<string, unknown>[] = [];

  for (const rec of motifRecords) {
    familySet.add(rec.family);

    motifDocs.push({
      databaseRef: dbId,
      matrixId: rec.archetypeId,
      name: rec.tfNames,
      dbSource: "Vierstra",
      group: rec.family,
      tfClass: null,
      family: rec.family,
      species: [],
      pfm: rec.pfm,
      uniprotIds: [],
    });

    if (motifDocs.length >= batchSize) {
      await Motif.insertMany(motifDocs);
      result.totalStored += motifDocs.length;
      motifDocs.length = 0;
    }
  }

  // Flush remaining batch
  if (motifDocs.length > 0) {
    await Motif.insertMany(motifDocs);
    result.totalStored += motifDocs.length;
  }

  result.families = Array.from(familySet).sort();

  // ── Update ReferenceDatabase statistics ────────────────────────────────────
  const motifCount = await Motif.countDocuments({ databaseRef: dbId });
  const storedGroups = await Motif.distinct("group", { databaseRef: dbId });

  await ReferenceDatabase.updateOne(
    { _id: dbId },
    { lastSyncedAt: new Date(), motifCount, taxonGroups: storedGroups }
  );

  console.log(
    `Vierstra sync complete: ${result.totalStored} archetypes from ${result.families.length} families, ${result.errors.length} errors`
  );

  return result;
}
