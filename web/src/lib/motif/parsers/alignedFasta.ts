import type { ParsedMotif } from "@/types";

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
        switch (ch) {
          case "A": a++; break;
          case "C": c++; break;
          case "G": g++; break;
          case "T":
          case "U": t++; break;
          // Gap characters ("-") and other characters are skipped
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
