/**
 * Parser for HOCOMOCO v14 annotation JSONL files.
 *
 * Each line in the annotation JSONL is a self-contained JSON object with all
 * motif data: matrix values (PCM/PFM), TF name, species, TF classification,
 * and quality rating.
 */

export interface HocomocoMotifRecord {
  motifId: string;
  tfName: string;
  quality: string;
  species: string; // "Human" or "Mouse"
  tfClass: string | null;
  family: string | null;
  pfm: { A: number[]; C: number[]; G: number[]; T: number[] };
}

/**
 * Parse a single line from an H14CORE or H14CORE-CLUSTERED annotation JSONL.
 *
 * Expected JSON fields per line:
 *   name            – motif ID (e.g. "AHR.H14CORE.0.P.B")
 *   tf              – TF gene symbol (e.g. "AHR")
 *   quality         – "A" | "B" | "C" | "D"
 *   pcm             – position count matrix  [[A,C,G,T], ...] (row-major)
 *   pfm             – position frequency matrix [[A,C,G,T], ...] (row-major)
 *   original_motif.species – "HUMAN" | "MOUSE"
 *   masterlist_info.tfclass_class  – TF class description
 *   masterlist_info.tfclass_family – TF family name
 *
 * Returns null if the line cannot be parsed or has no matrix data.
 */
export function parseAnnotationLine(line: string): HocomocoMotifRecord | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    return null;
  }

  const motifId = obj.name as string | undefined;
  const tfName = obj.tf as string | undefined;
  if (!motifId || !tfName) return null;

  // Get matrix data – prefer PCM (counts) over PFM (frequencies)
  const pcm = obj.pcm as number[][] | undefined;
  const pfmRaw = obj.pfm as number[][] | undefined;
  const matrix = pcm || pfmRaw;
  if (!matrix || matrix.length === 0) return null;

  // Transpose from row-major [[A,C,G,T], ...] to column-major {A:[], C:[], G:[], T:[]}
  const pfm = transposePcm(matrix);
  if (!pfm) return null;

  // Species: from original_motif.species
  const originalMotif = obj.original_motif as Record<string, unknown> | undefined;
  const rawSpecies = (originalMotif?.species as string) || "";
  const species = normalizeSpecies(rawSpecies);

  // TF classification
  const masterlistInfo = obj.masterlist_info as Record<string, unknown> | undefined;
  const tfClass = (masterlistInfo?.tfclass_class as string) || null;
  const family = (masterlistInfo?.tfclass_family as string) || null;

  const quality = (obj.quality as string) || "";

  return { motifId, tfName, quality, species, tfClass, family, pfm };
}

/**
 * Transpose a row-major matrix [[A,C,G,T], ...] (one row per position)
 * to column-major { A: [...], C: [...], G: [...], T: [...] }.
 */
function transposePcm(
  rows: number[][]
): { A: number[]; C: number[]; G: number[]; T: number[] } | null {
  if (rows.length === 0) return null;

  const A: number[] = [];
  const C: number[] = [];
  const G: number[] = [];
  const T: number[] = [];

  for (const row of rows) {
    if (row.length < 4) return null;
    A.push(row[0]);
    C.push(row[1]);
    G.push(row[2]);
    T.push(row[3]);
  }

  return { A, C, G, T };
}

function normalizeSpecies(raw: string): string {
  const upper = raw.toUpperCase().trim();
  if (upper === "HUMAN") return "Human";
  if (upper === "MOUSE") return "Mouse";
  if (upper) return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return "Unknown";
}
