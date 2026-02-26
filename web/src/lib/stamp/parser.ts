import fs from "fs";
import type { MatchResult, MatchEntry, PairwiseScores } from "@/types";

/**
 * Parse STAMP's Newick tree output file.
 */
export function parseTreeFile(filePath: string): string | null {
  const treePath = filePath + ".tree";
  if (!fs.existsSync(treePath)) return null;
  return fs.readFileSync(treePath, "utf-8").trim();
}

/**
 * Parse STAMP's match pairs output file.
 *
 * Format of outFile_match_pairs.txt:
 *   >    QueryMotifName
 *   MatchName    E-value    QueryConsensus    MatchConsensus
 *   MatchName2   E-value    QueryConsensus    MatchConsensus
 *   ...
 *   >    NextQueryMotif
 *   ...
 */
export function parseMatchPairs(filePath: string): MatchResult[] {
  const matchPath = filePath + "_match_pairs.txt";
  if (!fs.existsSync(matchPath)) return [];

  const text = fs.readFileSync(matchPath, "utf-8");
  const lines = text.split(/\r?\n/);
  const results: MatchResult[] = [];
  let current: MatchResult | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;

    if (trimmed.startsWith(">")) {
      // New query motif
      const queryName = trimmed.substring(1).trim();
      current = { queryName, matches: [] };
      results.push(current);
    } else if (current) {
      // Match line: name  e-value  queryConsensus  matchConsensus
      const parts = trimmed.split(/\t+|\s{2,}/);
      if (parts.length >= 4) {
        const entry: MatchEntry = {
          name: parts[0].trim(),
          evalue: parseFloat(parts[1]),
          alignmentQuery: parts[2].trim(),
          alignmentMatch: parts[3].trim(),
          matchMotifMatrix: null,
        };
        current.matches.push(entry);
      }
    }
  }

  return results;
}

/**
 * Parse STAMP's matched TRANSFAC output to get match motif matrices.
 *
 * Format of outFile_matched.transfac:
 *   DE    MotifName
 *   0    A    C    G    T    consensus
 *   ...
 *   XX
 */
export function parseMatchedTransfac(
  filePath: string
): Map<string, number[][]> {
  const matchedPath = filePath + "_matched.transfac";
  if (!fs.existsSync(matchedPath)) return new Map();

  const text = fs.readFileSync(matchedPath, "utf-8");
  const lines = text.split(/\r?\n/);
  const result = new Map<string, number[][]>();

  let currentName = "";
  let currentMatrix: number[][] = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === "DE" && parts.length > 1) {
      // Save previous motif if exists
      if (currentName && currentMatrix.length > 0) {
        result.set(currentName, currentMatrix);
      }
      currentName = parts[1];
      currentMatrix = [];
    } else if (parts[0] === "XX") {
      if (currentName && currentMatrix.length > 0) {
        result.set(currentName, currentMatrix);
      }
      currentName = "";
      currentMatrix = [];
    } else if (parts.length >= 5 && !isNaN(Number(parts[0]))) {
      const a = Number(parts[1]);
      const c = Number(parts[2]);
      const g = Number(parts[3]);
      const t = Number(parts[4]);
      if (a >= 0 && c >= 0 && g >= 0 && t >= 0) {
        currentMatrix.push([a, c, g, t]);
      }
    }
  }

  return result;
}

/**
 * Parse pairwise scores from STAMP's stdout output.
 *
 * The pairwise output looks like:
 *   Pairwise alignment scores:
 *   	Motif1	Motif2	Motif3
 *   Motif1	0.000	0.123	0.456
 *   Motif2	0.123	0.000	0.789
 *   ...
 */
export function parsePairwiseScores(stdout: string): PairwiseScores | null {
  const lines = stdout.split(/\r?\n/);
  let startIdx = -1;

  // Look for the "Pairwise alignment scores:" header (non-silent mode)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("Pairwise alignment scores:")) {
      startIdx = i + 1;
      break;
    }
  }

  // In silent mode, there's no header — find the first tab-separated header row
  // (a line starting with a tab followed by motif names)
  if (startIdx === -1) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("\t") && line.trim().length > 0) {
        startIdx = i;
        break;
      }
    }
  }

  if (startIdx === -1) return null;

  // Skip blank lines to reach the header row
  while (startIdx < lines.length && lines[startIdx].trim() === "") {
    startIdx++;
  }

  if (startIdx >= lines.length) return null;

  // The first non-blank line is the header row: \tMotif1\tMotif2\t...
  const headerLine = lines[startIdx];
  const headerParts = headerLine.split(/\t/).filter((p) => p.trim() !== "");

  if (headerParts.length === 0) return null;

  const motifNames: string[] = [];
  const matrix: number[][] = [];

  // Parse data rows (skipping blank lines between them)
  // Stop at "Alignments Finished" or any non-matrix line
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "") continue;

    // Stop at known end markers
    if (line.startsWith("Alignments Finished") || line.startsWith("Tree Built") || line.startsWith("Multiple Alignment")) {
      break;
    }

    const parts = line.split(/\t/);
    if (parts.length < 2) break;

    const name = parts[0].trim();
    if (name === "" || name === "-") continue;

    // Verify this is a data row: second part should be "-" or a number
    const secondVal = parts[1].trim();
    if (secondVal !== "-" && isNaN(parseFloat(secondVal))) break;

    motifNames.push(name);
    const row = parts.slice(1).map((v) => {
      const trimmed = v.trim();
      if (trimmed === "-" || trimmed === "") return 0;
      const n = parseFloat(trimmed);
      return isNaN(n) ? 0 : n;
    });
    matrix.push(row);
  }

  if (motifNames.length === 0) return null;

  return { motifNames, matrix };
}

/**
 * Parse the FBP (Familial Binding Profile) output.
 *
 * Format of outFileFBP.txt:
 *   DE    FBP
 *   0    A_prob    C_prob    G_prob    T_prob    consensus
 *   ...
 *   XX
 */
export function parseFBP(filePath: string): number[][] | null {
  const fbpPath = filePath + "FBP.txt";
  if (!fs.existsSync(fbpPath)) return null;

  const text = fs.readFileSync(fbpPath, "utf-8");
  const lines = text.split(/\r?\n/);
  const matrix: number[][] = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 5 && !isNaN(Number(parts[0]))) {
      const a = Number(parts[1]);
      const c = Number(parts[2]);
      const g = Number(parts[3]);
      const t = Number(parts[4]);
      if (!isNaN(a) && !isNaN(c) && !isNaN(g) && !isNaN(t)) {
        matrix.push([a, c, g, t]);
      }
    }
  }

  return matrix.length > 0 ? matrix : null;
}
