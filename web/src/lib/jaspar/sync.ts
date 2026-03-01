import { Motif } from "@/lib/db/models/Motif";
import { ReferenceDatabase } from "@/lib/db/models/ReferenceDatabase";
import { fetchMatrixList, fetchMatrixDetail } from "./client";
import type { Types } from "mongoose";

interface SyncOptions {
  collection?: string;
  taxonGroups?: string[];
  fullSync?: boolean;
}

interface SyncResult {
  totalFetched: number;
  totalStored: number;
  errors: string[];
}

/**
 * Sync JASPAR matrices to the local MongoDB database.
 */
export async function syncJaspar(options: SyncOptions = {}): Promise<SyncResult> {
  const { collection = "CORE", taxonGroups, fullSync = false } = options;
  const result: SyncResult = { totalFetched: 0, totalStored: 0, errors: [] };

  // Find or create the reference database record
  const slug = `jaspar-${collection.toLowerCase()}`;
  let refDb = await ReferenceDatabase.findOne({ slug });

  if (!refDb) {
    refDb = new ReferenceDatabase({
      name: `JASPAR ${collection}`,
      slug,
      source: "jaspar",
      description: `JASPAR ${collection} transcription factor binding profiles`,
      jasparCollection: collection,
      version: "2024",
      urlPattern: "https://jaspar.elixir.no/matrix/{id}",
      taxonGroups: [],
      isActive: true,
    });
    await refDb.save();
  }

  const dbId = refDb._id as Types.ObjectId;

  // If full sync, clear existing motifs for this database
  if (fullSync) {
    await Motif.deleteMany({ databaseRef: dbId });
  }

  // Fetch matrix list
  const groups = taxonGroups || [undefined as unknown as string];
  for (const group of groups) {
    try {
      console.log(
        `Fetching JASPAR ${collection} matrices${group ? ` for ${group}` : ""}...`
      );

      const matrices = await fetchMatrixList({
        collection,
        taxGroup: group || undefined,
      });

      result.totalFetched += matrices.length;
      console.log(`Found ${matrices.length} matrices${group ? ` in ${group}` : ""}`);

      // Fetch details and store in batches
      const batchSize = 10;
      for (let i = 0; i < matrices.length; i += batchSize) {
        const batch = matrices.slice(i, i + batchSize);

        const details = await Promise.all(
          batch.map(async (m) => {
            try {
              return await fetchMatrixDetail(m.matrix_id);
            } catch (err) {
              result.errors.push(
                `Failed to fetch ${m.matrix_id}: ${err instanceof Error ? err.message : String(err)}`
              );
              return null;
            }
          })
        );

        const validDetails = details.filter(Boolean);

        for (const detail of validDetails) {
          if (!detail) continue;

          try {
            await Motif.findOneAndUpdate(
              { databaseRef: dbId, matrixId: detail.matrix_id },
              {
                databaseRef: dbId,
                matrixId: detail.matrix_id,
                baseId: detail.base_id,
                version: detail.version,
                name: detail.name,
                dbSource: "JASPAR",
                group: detail.tax_group,
                jasparCollection: detail.collection,
                taxGroup: detail.tax_group,
                tfClass: detail.class,
                family: detail.family,
                species: detail.species,
                pfm: detail.pfm,
                uniprotIds: detail.uniprot_ids,
              },
              { upsert: true, new: true }
            );
            result.totalStored++;
          } catch (err) {
            result.errors.push(
              `Failed to store ${detail.matrix_id}: ${err instanceof Error ? err.message : String(err)}`
            );
          }
        }

        // Progress logging
        if ((i + batchSize) % 100 === 0) {
          console.log(
            `Progress: ${Math.min(i + batchSize, matrices.length)}/${matrices.length}`
          );
        }

        // Rate limit
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (err) {
      result.errors.push(
        `Failed to fetch ${group || "all"}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Update reference database stats
  const motifCount = await Motif.countDocuments({ databaseRef: dbId });
  const storedTaxonGroups = await Motif.distinct("group", { databaseRef: dbId });

  await ReferenceDatabase.updateOne(
    { _id: dbId },
    {
      lastSyncedAt: new Date(),
      motifCount,
      taxonGroups: storedTaxonGroups,
      version: "2024",
      urlPattern: "https://jaspar.elixir.no/matrix/{id}",
    }
  );

  console.log(
    `Sync complete: ${result.totalStored} stored, ${result.errors.length} errors`
  );

  return result;
}
