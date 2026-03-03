import type { ParsedMotif } from "@/types";

/**
 * Parse TRANSFAC format motifs.
 *
 * Expected format:
 *   DE  motifName  [familyLabel]
 *   0   A   C   G   T   [consensus]
 *   1   A   C   G   T   [consensus]
 *   ...
 *   XX
 *
 * Also handles PO/P0 header lines and AC/NA tags.
 * Reference: formatMotifs.pl lines 545-599
 */
export function parseTransfac(text: string): ParsedMotif[] {
  const motifs: ParsedMotif[] = [];
  const lines = text.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    const parts = line.split(/\s+/);

    if (parts.length === 0 || parts[0] === "") {
      i++;
      continue;
    }

    const tag = parts[0];

    // Look for motif start tags: DE, NA, AC, PO, P0
    if (tag === "DE" || tag === "NA" || tag === "AC" || tag === "PO" || tag === "P0") {
      let name = "Motif" + (motifs.length + 1);

      if ((tag === "DE" || tag === "NA" || tag === "AC") && parts.length > 1) {
        name = parts[1];
      }

      // Skip forward through any header lines (DE, NA, AC, XX, etc.) to reach the matrix
      if (tag === "DE" || tag === "NA" || tag === "AC") {
        i++;
        // Advance past additional header lines until we find matrix data
        while (i < lines.length) {
          const nextParts = lines[i].trim().split(/\s+/);
          if (nextParts.length === 0 || nextParts[0] === "") {
            i++;
            continue;
          }
          // Check if this is another header tag
          const nextTag = nextParts[0];
          if (nextTag === "DE" || nextTag === "NA") {
            // Update name from the most specific tag
            if (nextParts.length > 1) {
              name = nextParts[1];
            }
            i++;
            continue;
          }
          // Skip known TRANSFAC header tags
          const headerTags = [
            "AC", "XX", "ID", "DT", "CO", "BF", "VV", "CC", "RX", "RN",
            "RA", "RT", "RL", "BA", "PO", "P0",
          ];
          if (headerTags.includes(nextTag)) {
            if (nextTag === "PO" || nextTag === "P0") {
              i++;
              break; // Matrix data follows
            }
            i++;
            continue;
          }
          // Check if this looks like matrix data (5 or 6 columns, first is numeric)
          if (
            (nextParts.length === 5 || nextParts.length === 6) &&
            !isNaN(Number(nextParts[0]))
          ) {
            break; // Found matrix data
          }
          i++;
        }
      } else {
        // PO/P0 tag — matrix starts on next line
        i++;
      }

      // Parse matrix rows
      const matrix: number[][] = [];
      while (i < lines.length) {
        const rowLine = lines[i].trim();
        const rowParts = rowLine.split(/\s+/);

        if (rowParts.length === 0 || rowParts[0] === "") {
          i++;
          break;
        }

        // Stop at end markers or new motif tags
        const stopTags = ["XX", "DE", "NA", "PO", "P0", "AC", "//"];
        if (stopTags.includes(rowParts[0])) {
          if (rowParts[0] === "XX" || rowParts[0] === "//") {
            i++;
          }
          break;
        }

        // Matrix row: index A C G T [consensus]
        if (
          (rowParts.length === 5 || rowParts.length === 6) &&
          !isNaN(Number(rowParts[1])) &&
          !isNaN(Number(rowParts[2])) &&
          !isNaN(Number(rowParts[3])) &&
          !isNaN(Number(rowParts[4]))
        ) {
          const a = Number(rowParts[1]);
          const c = Number(rowParts[2]);
          const g = Number(rowParts[3]);
          const t = Number(rowParts[4]);
          if (a >= 0 && c >= 0 && g >= 0 && t >= 0) {
            matrix.push([a, c, g, t]);
          }
        }
        i++;
      }

      if (matrix.length > 0) {
        // Sanitize name
        name = sanitizeMotifName(name);
        motifs.push({ name, matrix, format: "transfac" });
      }
    } else {
      i++;
    }
  }

  return motifs;
}

function sanitizeMotifName(name: string): string {
  // Remove problematic characters (matches formatMotifs.pl line 867)
  let clean = name.replace(/[#{}~;"'@%$!?*^&/<>|:()[\]]/g, "_");
  // Truncate to 20 chars
  if (clean.length > 20) {
    clean = clean.substring(0, 16);
  }
  return clean;
}
