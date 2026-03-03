import type { ParsedMotif, MotifFormat } from "@/types";
import { parseTransfac } from "./transfac";
import { parseMeme } from "./meme";
import { parseJaspar } from "./jaspar";
import { parseModisco } from "./modisco";
import { parseConsensus } from "./consensus";
import { parseAlignedFasta } from "./alignedFasta";
import { detectMotifFormat } from "../formatDetector";

/**
 * Parse motif text content, auto-detecting the format if not specified.
 */
export function parseMotifs(
  text: string,
  format?: MotifFormat
): { motifs: ParsedMotif[]; detectedFormat: MotifFormat } {
  const detected = format || detectMotifFormat(text);

  if (!detected) {
    throw new Error(
      "Could not detect motif format. " +
        "Please ensure your input is in TRANSFAC, MEME, JASPAR, consensus, or aligned FASTA format."
    );
  }

  let motifs: ParsedMotif[];

  switch (detected) {
    case "transfac":
      motifs = parseTransfac(text);
      break;
    case "meme":
      motifs = parseMeme(text);
      break;
    case "jaspar":
      motifs = parseJaspar(text);
      break;
    case "modisco":
      motifs = parseModisco(text);
      break;
    case "consensus":
      motifs = parseConsensus(text);
      break;
    case "aligned-fasta":
      motifs = parseAlignedFasta(text);
      break;
    default:
      throw new Error(`Unsupported motif format: ${detected}`);
  }

  if (motifs.length === 0) {
    throw new Error(
      `No motifs found in the input. Detected format: ${detected}. ` +
        "Please check your input data."
    );
  }

  return { motifs, detectedFormat: detected };
}

export { parseTransfac } from "./transfac";
export { parseMeme } from "./meme";
export { parseJaspar } from "./jaspar";
export { parseModisco } from "./modisco";
export { parseConsensus } from "./consensus";
export { parseAlignedFasta } from "./alignedFasta";
