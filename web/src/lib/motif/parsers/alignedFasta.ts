import type { ParsedMotif } from "@/types";
import { IUPAC_MAP } from "./consensus";

/**
 * Parse aligned FASTA format into motifs.
 *
 * Format:
 *   >MotifName1
 *   ACGTACGT
 *   ACTTACGT
 *   GCGTACGT
 *   >MotifName2
 *   TTCCGGAA
 *   TTCCGGAT
 *
 * Each >header starts a new motif. All lines until the next > are
 * aligned DNA sequences for that motif. At each position, bases are
 * counted across all sequences to build a PFM row [countA, countC, countG, countT].
 * IUPAC degenerate bases (R, Y, S, W, K, M, B, D, H, V, N) contribute fractional
 * counts according to their standard ambiguity definitions.
 * Gap characters ("-") are not counted toward any base.
 */
export function parseAlignedFasta(text: string): ParsedMotif[] {
  const motifs: ParsedMotif[] = [];
  const lines = text.split(/\r?\n/);
  let autoIdx = 0;

  let currentName: string | null = null;
  let currentSeqs: string[] = [];

  function finalizeBlock() {
    if (currentSeqs.length === 0) return;

    autoIdx++;
    const name = currentName || `Motif_${autoIdx}`;

    // Find max sequence length (should all be the same for aligned sequences)
    const maxLen = Math.max(...currentSeqs.map((s) => s.length));

    const matrix: number[][] = [];
    for (let pos = 0; pos < maxLen; pos++) {
      let a = 0, c = 0, g = 0, t = 0;
      for (const seq of currentSeqs) {
        if (pos >= seq.length) continue;
        const ch = seq[pos].toUpperCase();
        // Gap characters are skipped; all other characters are looked up in
        // the IUPAC map so degenerate codes contribute fractional counts.
        if (ch === "-") continue;
        const freqs = IUPAC_MAP[ch];
        if (freqs) {
          a += freqs[0];
          c += freqs[1];
          g += freqs[2];
          t += freqs[3];
        }
      }
      matrix.push([a, c, g, t]);
    }

    // Only add if we got a non-trivial matrix
    if (matrix.length > 0 && matrix.some((row) => row[0] + row[1] + row[2] + row[3] > 0)) {
      motifs.push({ name, matrix, format: "aligned-fasta" });
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith(">")) {
      // Finalize previous block
      finalizeBlock();
      currentName = line.substring(1).trim() || null;
      currentSeqs = [];
    } else if (line !== "") {
      // Sequence line — should contain DNA/IUPAC characters and gaps
      if (/^[ACGTURYSWKMBDHVNacgturyswkmbdhvn\-]+$/.test(line)) {
        currentSeqs.push(line);
      }
    }
  }

  // Finalize last block
  finalizeBlock();

  return motifs;
}
