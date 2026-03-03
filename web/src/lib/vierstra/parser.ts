/**
 * Parser for the Vierstra motif clustering v2.0 MEME-format archetype files.
 *
 * MEME format:
 *   MOTIF AC0001:DLX/LHX:Homeodomain AC0001:DLX/LHX:Homeodomain
 *
 *   letter-probability matrix: alength= 4 w= 6 nsites= 20 E= 0
 *     0.014812  0.085107  0.008622  0.891459
 *     ...
 *
 * The motif ID is structured as "archetypeId:tfNames:family".
 */

export interface VierstraMotifRecord {
  motifId: string;   // full ID, e.g. "AC0001:DLX/LHX:Homeodomain"
  archetypeId: string; // e.g. "AC0001"
  tfNames: string;   // e.g. "DLX/LHX"
  family: string;    // e.g. "Homeodomain"
  pfm: { A: number[]; C: number[]; G: number[]; T: number[] };
}

/**
 * Parse the consensus_pwms.meme file into an array of motif records.
 *
 * The file contains a header (MEME version, ALPHABET, strands, Background)
 * followed by MOTIF blocks, each with a letter-probability matrix.
 */
export function parseMemePwms(content: string): VierstraMotifRecord[] {
  const motifs: VierstraMotifRecord[] = [];
  const lines = content.split(/\r?\n/);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.startsWith("MOTIF ")) {
      // Parse motif ID — format: "MOTIF <id> [<alt>]"
      const motifId = line.substring(6).split(/\s+/)[0];
      const { archetypeId, tfNames, family } = parseMotifId(motifId);

      // Advance to "letter-probability matrix:" line
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("letter-probability matrix:")) {
        i++;
      }
      if (i >= lines.length) break;

      // Parse matrix header: "letter-probability matrix: alength= 4 w= 6 ..."
      i++;

      // Read matrix rows until blank line or next MOTIF or EOF
      const A: number[] = [];
      const C: number[] = [];
      const G: number[] = [];
      const T: number[] = [];

      while (i < lines.length) {
        const row = lines[i].trim();
        if (row === "" || row.startsWith("MOTIF ") || row.startsWith("URL ")) break;

        const vals = row.split(/\s+/).map(Number);
        if (vals.length >= 4 && !isNaN(vals[0])) {
          A.push(vals[0]);
          C.push(vals[1]);
          G.push(vals[2]);
          T.push(vals[3]);
        }
        i++;
      }

      if (A.length > 0) {
        motifs.push({
          motifId,
          archetypeId,
          tfNames,
          family,
          pfm: { A, C, G, T },
        });
      }
    } else {
      i++;
    }
  }

  return motifs;
}

/**
 * Parse a Vierstra motif ID like "AC0001:DLX/LHX:Homeodomain".
 */
function parseMotifId(id: string): { archetypeId: string; tfNames: string; family: string } {
  const parts = id.split(":");
  if (parts.length >= 3) {
    return {
      archetypeId: parts[0],
      tfNames: parts[1],
      family: parts.slice(2).join(":"),
    };
  } else if (parts.length === 2) {
    return { archetypeId: parts[0], tfNames: parts[1], family: "Unknown" };
  }
  return { archetypeId: id, tfNames: id, family: "Unknown" };
}
