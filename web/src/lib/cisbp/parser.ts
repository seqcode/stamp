/**
 * Parse CIS-BP PWM files and metadata.
 *
 * CIS-BP PWM format (tab-separated):
 *   Pos	A	C	G	T
 *   1	0.25	0.25	0.25	0.25
 *   2	0.10	0.70	0.10	0.10
 *   ...
 *
 * TF_Information.txt columns (tab-separated):
 *   TF_ID, Family_ID, TF_Name, TF_Species, TF_Status, ...
 *   Motif_ID, MSource_Identifier, MSource_Type, ...
 */

export interface CisbpMotifInfo {
  tfId: string;
  tfName: string;
  species: string;
  family: string;
  motifId: string;
  msourceId: string;
}

export interface CisbpParsedMotif {
  motifId: string;
  pfm: { A: number[]; C: number[]; G: number[]; T: number[] };
}

/**
 * Parse a single CIS-BP PWM file content.
 * Returns null if the file can't be parsed (e.g. header-only or empty).
 */
export function parseCisbpPwm(content: string): CisbpParsedMotif["pfm"] | null {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return null;

  const A: number[] = [];
  const C: number[] = [];
  const G: number[] = [];
  const T: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Skip header line
    if (/^Pos\b/i.test(line)) continue;

    const parts = line.split(/\t/);
    if (parts.length < 5) continue;

    const a = parseFloat(parts[1]);
    const c = parseFloat(parts[2]);
    const g = parseFloat(parts[3]);
    const t = parseFloat(parts[4]);

    if (isNaN(a) || isNaN(c) || isNaN(g) || isNaN(t)) continue;

    A.push(a);
    C.push(c);
    G.push(g);
    T.push(t);
  }

  if (A.length === 0) return null;
  return { A, C, G, T };
}

/**
 * Parse CIS-BP TF_Information.txt to extract motif metadata.
 * Returns a map from Motif_ID to motif info.
 */
export function parseTfInformation(
  content: string
): Map<string, CisbpMotifInfo> {
  const lines = content.split(/\r?\n/);
  if (lines.length < 2) return new Map();

  // Parse header to find column indices
  const header = lines[0].split(/\t/);
  const col = (name: string) => header.indexOf(name);

  const tfIdCol = col("TF_ID");
  const tfNameCol = col("TF_Name");
  const speciesCol = col("TF_Species");
  const familyCol = col("Family_ID");
  const motifIdCol = col("Motif_ID");
  const msourceCol = col("MSource_Identifier");

  if (tfIdCol === -1 || motifIdCol === -1) return new Map();

  const result = new Map<string, CisbpMotifInfo>();

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(/\t/);
    if (parts.length <= motifIdCol) continue;

    const motifId = parts[motifIdCol]?.trim();
    if (!motifId || motifId === "." || motifId === "") continue;

    // Skip if we already have this motif (first occurrence wins)
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
