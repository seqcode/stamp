import type { ParsedMotif } from "@/types";

const CORE_LEN = 4;

/**
 * Calculate the information content (IC) of a single motif column.
 *
 * IC = 2 + Σ(freq × log₂(freq))   (range: 0 to 2 bits)
 *
 * Matches formatMotifs.pl calcIC subroutine (lines 903-918).
 */
export function calcIC(a: number, c: number, g: number, t: number): number {
  const total = a + c + g + t;
  if (total <= 0) return 0;

  let sum = 0;
  for (const count of [a, c, g, t]) {
    if (count > 0) {
      const freq = count / total;
      sum += freq * Math.log2(freq);
    }
  }
  return 2 + sum;
}

/**
 * Trim low-information-content edge columns from a motif matrix.
 *
 * Algorithm (from formatMotifs.pl lines 812-862):
 * 1. Find the "core region" — a window of CORE_LEN (4) columns with the
 *    highest total IC.
 * 2. From the left edge inward toward the core, remove consecutive columns
 *    whose IC is below the threshold.
 * 3. From the right edge inward toward the core, do the same.
 * 4. The core region is always preserved.
 *
 * Motifs shorter than CORE_LEN are returned unchanged.
 *
 * @param matrix  Each row is [A, C, G, T] counts/frequencies
 * @param minIC   Minimum information content to keep an edge column (0–2 bits)
 * @returns       The trimmed matrix (may be the same array if nothing was trimmed)
 */
export function trimMotif(matrix: number[][], minIC: number): number[][] {
  const len = matrix.length;
  if (len <= CORE_LEN) return matrix;

  // ── Find core region of greatest IC ──────────────────────────────────────
  let maxIC = -1;
  let coreStart = 0;

  for (let i = 0; i <= len - CORE_LEN; i++) {
    let totalIC = 0;
    for (let j = i; j < i + CORE_LEN; j++) {
      const [a, c, g, t] = matrix[j];
      totalIC += calcIC(a, c, g, t);
    }
    if (totalIC > maxIC) {
      maxIC = totalIC;
      coreStart = i;
    }
  }

  // ── Trim left edge ───────────────────────────────────────────────────────
  let mStart = 0;
  for (let i = 0; i < coreStart; i++) {
    const [a, c, g, t] = matrix[i];
    if (calcIC(a, c, g, t) < minIC) {
      mStart = i + 1;
    } else {
      break;
    }
  }

  // ── Trim right edge ──────────────────────────────────────────────────────
  let mStop = len - 1;
  for (let i = len - 1; i >= coreStart + CORE_LEN; i--) {
    const [a, c, g, t] = matrix[i];
    if (calcIC(a, c, g, t) < minIC) {
      mStop = i - 1;
    } else {
      break;
    }
  }

  // No change
  if (mStart === 0 && mStop === len - 1) return matrix;

  return matrix.slice(mStart, mStop + 1);
}

/**
 * Apply edge trimming to an array of parsed motifs.
 *
 * @param motifs  Input motifs
 * @param minIC   Minimum IC threshold for edge columns (0–2 bits)
 * @returns       New array with trimmed matrices (originals are not mutated)
 */
export function trimMotifs(
  motifs: ParsedMotif[],
  minIC: number
): ParsedMotif[] {
  return motifs.map((m) => {
    const trimmed = trimMotif(m.matrix, minIC);
    if (trimmed === m.matrix) return m; // unchanged
    return { ...m, matrix: trimmed };
  });
}
