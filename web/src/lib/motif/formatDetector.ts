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

  // JASPAR format: starts with ">" and next lines are A/C/G/T rows with brackets
  if (head[0]?.trim().startsWith(">")) {
    // Check if the next line looks like JASPAR (starts with A [ or A\t[)
    for (let i = 1; i < Math.min(head.length, 5); i++) {
      const clean = head[i]?.trim().replace(/[\[\]]/g, "");
      const parts = clean?.split(/\s+/);
      if (parts && parts[0] && ["A", "C", "G", "T"].includes(parts[0].toUpperCase())) {
        return "jaspar";
      }
    }
    // Could be JASPAR with raw PSSM format (> header, then 4-column rows)
    // For now, still classify as JASPAR since it uses the ">" header
    return "jaspar";
  }

  // TRANSFAC format: look for DE, NA, PO, P0, AC tags
  for (const line of head) {
    const parts = line.trim().split(/\s+/);
    if (["DE", "NA", "PO", "P0", "AC"].includes(parts[0])) {
      return "transfac";
    }
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
