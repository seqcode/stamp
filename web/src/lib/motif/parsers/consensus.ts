import type { ParsedMotif } from "@/types";

/**
 * IUPAC degenerate code → PFM frequency mapping.
 * Each code maps to [A, C, G, T] frequencies.
 */
const IUPAC_MAP: Record<string, [number, number, number, number]> = {
  A: [1, 0, 0, 0],
  C: [0, 1, 0, 0],
  G: [0, 0, 1, 0],
  T: [0, 0, 0, 1],
  U: [0, 0, 0, 1],
  R: [0.5, 0, 0.5, 0],        // A or G
  Y: [0, 0.5, 0, 0.5],        // C or T
  S: [0, 0.5, 0.5, 0],        // G or C
  W: [0.5, 0, 0, 0.5],        // A or T
  K: [0, 0, 0.5, 0.5],        // G or T
  M: [0.5, 0.5, 0, 0],        // A or C
  B: [0, 1 / 3, 1 / 3, 1 / 3],    // C or G or T
  D: [1 / 3, 0, 1 / 3, 1 / 3],    // A or G or T
  H: [1 / 3, 1 / 3, 0, 1 / 3],    // A or C or T
  V: [1 / 3, 1 / 3, 1 / 3, 0],    // A or C or G
  N: [0.25, 0.25, 0.25, 0.25],     // any
};

/**
 * Parse IUPAC consensus sequences into motifs.
 *
 * Format:
 *   ACGTRYSWKM        (bare sequence, auto-named Motif_1)
 *   >MyMotif           (optional header)
 *   ACGTRYSWKM         (sequence for MyMotif)
 *   WSMKBDHVN          (bare sequence, auto-named)
 *
 * Each sequence becomes one motif. Each character is converted to a
 * single PFM row using the IUPAC degenerate code mapping.
 */
export function parseConsensus(text: string): ParsedMotif[] {
  const motifs: ParsedMotif[] = [];
  const lines = text.split(/\r?\n/);
  let autoIdx = 0;
  let pendingName: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "") continue;

    if (line.startsWith(">")) {
      // Header line — use as name for the next sequence
      pendingName = line.substring(1).trim() || null;
      continue;
    }

    // Check if this line is a pure IUPAC sequence
    if (/^[ACGTURYSWKMBDHVNacgturyswkmbdhvn]+$/.test(line)) {
      autoIdx++;
      const name = pendingName || `Motif_${autoIdx}`;
      pendingName = null;

      const matrix: number[][] = [];
      for (const ch of line.toUpperCase()) {
        const freqs = IUPAC_MAP[ch];
        if (freqs) {
          matrix.push([...freqs]);
        }
      }

      if (matrix.length > 0) {
        motifs.push({ name, matrix, format: "consensus" });
      }
    } else {
      // Not a valid sequence line — reset pending name
      pendingName = null;
    }
  }

  return motifs;
}
