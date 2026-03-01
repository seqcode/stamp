import { Motif } from "@/lib/db/models/Motif";
import { ReferenceDatabase } from "@/lib/db/models/ReferenceDatabase";
import { parseAnnotationLine } from "./parser";
import type { Types } from "mongoose";
import { Readable } from "stream";
import * as readline from "readline";

export interface HocomocoSyncResult {
  totalMotifs: number;
  totalStored: number;
  groups: string[];
  errors: string[];
}

const HOCOMOCO_BASE_URL =
  "https://hocomoco14.autosome.org/final_bundle/hocomoco14";

type HocomocoCollection = "H14CORE" | "H14CORE-CLUSTERED";

const COLLECTION_META: Record<
  HocomocoCollection,
  { slug: string; name: string; description: string }
> = {
  H14CORE: {
    slug: "hocomoco-core",
    name: "HOCOMOCO CORE",
    description:
      "HOCOMOCO v14 CORE — curated collection of human and mouse TF binding models",
  },
  "H14CORE-CLUSTERED": {
    slug: "hocomoco-clustered",
    name: "HOCOMOCO Clustered",
    description:
      "HOCOMOCO v14 CORE-CLUSTERED — non-redundant subset of TF binding models",
  },
};

/**
 * Sync HOCOMOCO motifs by streaming the annotation JSONL directly from
 * the HOCOMOCO server.  The JSONL contains everything we need: matrix data,
 * TF name, species, TF classification, and quality.
 */
export async function syncHocomoco(
  collection: HocomocoCollection = "H14CORE"
): Promise<HocomocoSyncResult> {
  const meta = COLLECTION_META[collection];
  const annotationUrl = `${HOCOMOCO_BASE_URL}/${collection}/${collection}_annotation.jsonl`;

  console.log(`Downloading HOCOMOCO ${collection} annotation...`);
  console.log(`URL: ${annotationUrl}`);

  const res = await fetch(annotationUrl);
  if (!res.ok) {
    throw new Error(
      `Failed to download HOCOMOCO annotation: ${res.status} ${res.statusText}`
    );
  }
  if (!res.body) {
    throw new Error("HOCOMOCO annotation response has no body");
  }

  // ── Find or create the ReferenceDatabase record ───────────────────────────
  let refDb = await ReferenceDatabase.findOne({ slug: meta.slug });
  if (!refDb) {
    refDb = new ReferenceDatabase({
      name: meta.name,
      slug: meta.slug,
      source: "hocomoco",
      description: meta.description,
      version: "14",
      urlPattern: "https://hocomoco14.autosome.org/motif/{id}",
      taxonGroups: [],
      isActive: true,
    });
    await refDb.save();
  } else {
    await ReferenceDatabase.updateOne(
      { _id: refDb._id },
      {
        version: "14",
        urlPattern: "https://hocomoco14.autosome.org/motif/{id}",
      }
    );
  }

  const dbId = refDb._id as Types.ObjectId;

  // Remove old motifs for a full replace
  await Motif.deleteMany({ databaseRef: dbId });

  // ── Stream annotation JSONL line-by-line ───────────────────────────────────
  const nodeStream = Readable.fromWeb(
    res.body as Parameters<typeof Readable.fromWeb>[0]
  );
  const rl = readline.createInterface({
    input: nodeStream,
    crlfDelay: Infinity,
  });

  const result: HocomocoSyncResult = {
    totalMotifs: 0,
    totalStored: 0,
    groups: [],
    errors: [],
  };

  const groupSet = new Set<string>();
  const batchSize = 100;
  const motifDocs: Record<string, unknown>[] = [];

  for await (const line of rl) {
    const record = parseAnnotationLine(line);
    if (!record) continue;

    result.totalMotifs++;
    groupSet.add(record.species);

    motifDocs.push({
      databaseRef: dbId,
      matrixId: record.motifId,
      name: record.tfName,
      dbSource: "HOCOMOCO",
      group: record.species,
      tfClass: record.tfClass,
      family: record.family,
      species: [],
      pfm: record.pfm,
      uniprotIds: [],
    });

    if (motifDocs.length >= batchSize) {
      await Motif.insertMany(motifDocs);
      result.totalStored += motifDocs.length;
      motifDocs.length = 0;
      if (result.totalStored % 500 === 0) {
        console.log(
          `HOCOMOCO: stored ${result.totalStored} motifs so far...`
        );
      }
    }
  }

  // Flush remaining batch
  if (motifDocs.length > 0) {
    await Motif.insertMany(motifDocs);
    result.totalStored += motifDocs.length;
  }

  result.groups = Array.from(groupSet).sort();

  // ── Update ReferenceDatabase statistics ────────────────────────────────────
  const motifCount = await Motif.countDocuments({ databaseRef: dbId });
  const storedGroups = await Motif.distinct("group", { databaseRef: dbId });

  await ReferenceDatabase.updateOne(
    { _id: dbId },
    { lastSyncedAt: new Date(), motifCount, taxonGroups: storedGroups }
  );

  console.log(
    `HOCOMOCO ${collection} sync complete: ${result.totalStored} motifs from ${result.groups.length} groups, ${result.errors.length} errors`
  );

  return result;
}
