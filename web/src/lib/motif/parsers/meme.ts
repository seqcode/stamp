import type { ParsedMotif } from "@/types";

/**
 * Parse MEME format motifs.
 *
 * MEME files have a header starting with "MEME" and motifs introduced by:
 *   MOTIF <name>
 *   letter-probability matrix: ...
 *   <A> <C> <G> <T>
 *   ...
 *
 * Reference: formatMotifs.pl lines 230-258
 */
export function parseMeme(text: string): ParsedMotif[] {
  const motifs: ParsedMotif[] = [];
  const lines = text.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    const parts = line.split(/\s+/);

    // Look for MOTIF line
    if (parts[0] === "MOTIF" && parts.length >= 2) {
      const name = parts[1];
      i++;

      // Find the "letter-probability matrix:" line
      while (i < lines.length) {
        const searchLine = lines[i].trim();
        if (searchLine.startsWith("letter-probability matrix:")) {
          i++;
          break;
        }
        // If we hit another MOTIF line, break
        if (searchLine.startsWith("MOTIF ")) {
          break;
        }
        i++;
      }

      // Parse probability rows (4 columns: A C G T)
      const matrix: number[][] = [];
      while (i < lines.length) {
        const rowLine = lines[i].trim();
        if (rowLine === "" || rowLine.startsWith("MOTIF") || rowLine.startsWith("URL") || rowLine.startsWith("---")) {
          break;
        }
        const rowParts = rowLine.split(/\s+/);
        if (rowParts.length === 4) {
          const vals = rowParts.map(Number);
          if (vals.every((v) => !isNaN(v) && v >= 0)) {
            matrix.push(vals);
            i++;
            continue;
          }
        }
        break;
      }

      if (matrix.length > 0) {
        motifs.push({ name: sanitizeName(name), matrix, format: "meme" });
      }
    } else {
      i++;
    }
  }

  return motifs;
}

function sanitizeName(name: string): string {
  let clean = name.replace(/[#{}~;"'@%$!?*^&/<>|:()[\]]/g, "_");
  if (clean.length > 20) clean = clean.substring(0, 16);
  return clean;
}
