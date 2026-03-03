import type { MotifFormat } from "@/types";

/**
 * Auto-detect the motif file format based on content.
 * Examines the first few lines to identify format-specific patterns.
 */
export function detectMotifFormat(text: string): MotifFormat | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");

  if (lines.length === 0) return null;

  // Check first 10 lines for format clues
  const head = lines.slice(0, 10);

  // MEME format: starts with "MEME version" or has "MEME" as first line
  for (const line of head) {
    const trimmed = line.trim();
    if (trimmed === "MEME" || trimmed.startsWith("MEME version")) {
      return "meme";
    }
    if (trimmed.startsWith("letter-probability matrix:")) {
      return "meme";
    }
  }

  // TRANSFAC format: look for DE, NA, PO, P0, AC tags
  for (const line of head) {
    const parts = line.trim().split(/\s+/);
    if (["DE", "NA", "PO", "P0", "AC"].includes(parts[0])) {
      return "transfac";
    }
  }

  // Aligned FASTA: starts with ">" and following lines are bare DNA/IUPAC sequences
  // (no brackets, no tab-separated numbers like JASPAR)
  if (head[0]?.trim().startsWith(">")) {
    // Check lines after the ">" header
    let hasJasparPattern = false;
    let hasBareSequences = false;

    for (let i = 1; i < Math.min(lines.length, 10); i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith(">")) continue; // Another header

      // JASPAR pattern: "A [" or "A\t[" or bare base letter followed by numbers
      if (/^[ACGT]\s*[\[\(]/.test(trimmed)) {
        hasJasparPattern = true;
        break;
      }

      // Check if line has tab/space-separated numbers (JASPAR raw PSSM)
      const clean = trimmed.replace(/[\[\]]/g, "");
      const parts = clean.split(/\s+/);
      if (parts[0] && ["A", "C", "G", "T"].includes(parts[0].toUpperCase()) && parts.length > 2) {
        const allNums = parts.slice(1).every((p) => !isNaN(Number(p)));
        if (allNums) {
          hasJasparPattern = true;
          break;
        }
      }

      // Bare DNA/IUPAC sequence line?
      if (/^[ACGTURYSWKMBDHVNacgturyswkmbdhvn\-]+$/.test(trimmed)) {
        hasBareSequences = true;
      }
    }

    if (hasJasparPattern) {
      return "jaspar";
    }
    if (hasBareSequences) {
      return "aligned-fasta";
    }

    // Fallback for ">" prefix: assume JASPAR
    return "jaspar";
  }

  // Consensus format: all non-empty lines are purely IUPAC characters
  // (no tabs, no spaces, no digits — just DNA/IUPAC letters)
  // Check this AFTER TRANSFAC and MEME to avoid false positives
  const nonEmptyLines = lines.filter((l) => l.trim() !== "");
  const allIupac = nonEmptyLines.every((l) =>
    /^[ACGTURYSWKMBDHVNacgturyswkmbdhvn]+$/.test(l.trim())
  );
  if (allIupac && nonEmptyLines.length > 0) {
    return "consensus";
  }

  // If lines look like matrix data (4-6 numeric columns), assume TRANSFAC
  for (const line of head) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 4 && parts.length <= 6) {
      const nums = parts.map(Number);
      if (nums.every((n) => !isNaN(n))) {
        return "transfac";
      }
    }
  }

  return null;
}
