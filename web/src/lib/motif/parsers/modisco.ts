import type { ParsedMotif } from "@/types";

/**
 * Parse TF-MoDISco format motifs.
 *
 * TF-MoDISco outputs are typically in HDF5 format, but for web upload
 * we'll accept a text-based export format. The exact format will be
 * determined when the user provides an example.
 *
 * Placeholder implementation that returns an empty array.
 */
export function parseModisco(_text: string): ParsedMotif[] {
  // TODO: Implement once TF-MoDISco format example is provided
  throw new Error(
    "TF-MoDISco format parsing is not yet implemented. " +
      "Please convert your motifs to TRANSFAC, MEME, or JASPAR format."
  );
}
