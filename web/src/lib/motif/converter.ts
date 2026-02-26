import type { ParsedMotif } from "@/types";

/**
 * Convert parsed motifs to STAMP's TRANSFAC text format.
 *
 * Output format (per formatMotifs.pl lines 885-891):
 *   DE\t{name}\t{family}\n
 *   {pos}\t{A}\t{C}\t{G}\t{T}\t{consensus}\n
 *   ...
 *   XX\n
 */
export function toStampTransfac(motifs: ParsedMotif[]): string {
  const lines: string[] = [];

  for (const motif of motifs) {
    lines.push(`DE\t${motif.name}\t`);
    for (let pos = 0; pos < motif.matrix.length; pos++) {
      const [a, c, g, t] = motif.matrix[pos];
      const consensus = getConsensusLetter(a, c, g, t);
      lines.push(`${pos}\t${a}\t${c}\t${g}\t${t}\t${consensus}`);
    }
    lines.push("XX");
  }

  return lines.join("\n") + "\n";
}

/**
 * Get consensus letter for a position.
 * Follows the logic in formatMotifs.pl column2consensus subroutine.
 */
function getConsensusLetter(a: number, c: number, g: number, t: number): string {
  const sum = a + c + g + t;
  if (sum === 0) return "N";

  const CONS1 = 0.6;
  const CONS2 = 0.8;

  const fa = a / sum;
  const fc = c / sum;
  const fg = g / sum;
  const ft = t / sum;

  // Single-base consensus
  if (fa >= CONS1) return "A";
  if (fc >= CONS1) return "C";
  if (fg >= CONS1) return "G";
  if (ft >= CONS1) return "T";

  // Two-base ambiguity codes
  const twoBases: [number, string][] = [
    [fc + ft, "Y"], // pyrimidine (C/T)
    [fa + fg, "R"], // purine (A/G)
    [fa + ft, "W"], // weak (A/T)
    [fc + fg, "S"], // strong (C/G)
    [fg + ft, "K"], // keto (G/T)
    [fa + fc, "M"], // amino (A/C)
  ];

  let best = "N";
  let bestScore = CONS2;
  for (const [score, letter] of twoBases) {
    if (score >= bestScore) {
      bestScore = score;
      best = letter;
    }
  }

  return best;
}
