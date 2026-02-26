import type { ParsedMotif } from "@/types";

/**
 * Parse JASPAR matrix format motifs.
 *
 * JASPAR format uses ">" header followed by 4 rows (A, C, G, T):
 *   >MA0001.1 AGL3
 *   A [ 0 3 79 40 ... ]
 *   C [ 94 75 4 3 ... ]
 *   G [ 1 0 3 4 ... ]
 *   T [ 2 19 11 50 ... ]
 *
 * Reference: formatMotifs.pl lines 697-727
 */
export function parseJaspar(text: string): ParsedMotif[] {
  const motifs: ParsedMotif[] = [];
  const lines = text.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.startsWith(">")) {
      // Parse header: >MA0001.1 AGL3
      const headerParts = line.substring(1).trim().split(/\s+/);
      const name = headerParts.length > 1 ? headerParts[1] : headerParts[0];

      i++;

      // Parse 4 rows: A, C, G, T
      const rows: { [key: string]: number[] } = {};
      let baseCols = 0;

      for (let r = 0; r < 4 && i < lines.length; r++) {
        let rowLine = lines[i].trim();
        // Remove brackets
        rowLine = rowLine.replace(/[\[\]]/g, "");
        const rowParts = rowLine.split(/\s+/).filter((p) => p !== "");

        if (rowParts.length >= 2) {
          const base = rowParts[0].toUpperCase();
          if (["A", "C", "G", "T"].includes(base)) {
            const values = rowParts.slice(1).map(Number);
            if (values.every((v) => !isNaN(v) && v >= 0)) {
              rows[base] = values;
              baseCols++;
            }
          }
        }
        i++;
      }

      if (baseCols === 4 && rows.A && rows.C && rows.G && rows.T) {
        const length = rows.A.length;
        if (
          rows.C.length === length &&
          rows.G.length === length &&
          rows.T.length === length
        ) {
          const matrix: number[][] = [];
          for (let pos = 0; pos < length; pos++) {
            matrix.push([rows.A[pos], rows.C[pos], rows.G[pos], rows.T[pos]]);
          }
          motifs.push({ name: sanitizeName(name), matrix, format: "jaspar" });
        }
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
