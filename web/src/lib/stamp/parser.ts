import fs from "fs";
import type { MatchResult, MatchEntry, PairwiseScores, MultipleAlignmentEntry } from "@/types";

// ═══════════════════════════════════════════════════════════════════════════════
// Webmode Parsers — structured >>STAMP_* delimited stdout output
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of parsing all webmode sections from STAMP stdout.
 */
export interface WebmodeResult {
  enhancedAlignment: MultipleAlignmentEntry[] | null;
  fbp: number[][] | null;
  pairwise: PairwiseScores | null;
  tree: string | null;
  internalProfiles: { name: string; id: number; matrix: number[][] }[] | null;
  matchDetails: MatchResult[] | null;
  consensus: { name: string; alignedSequence: string }[] | null;
}

/**
 * Extract text between >>STAMP_{sectionName}_START and >>STAMP_{sectionName}_END.
 */
function extractSection(stdout: string, sectionName: string): string | null {
  const startTag = `>>STAMP_${sectionName}_START`;
  const endTag = `>>STAMP_${sectionName}_END`;
  const startIdx = stdout.indexOf(startTag);
  if (startIdx === -1) return null;
  const contentStart = startIdx + startTag.length;
  const endIdx = stdout.indexOf(endTag, contentStart);
  if (endIdx === -1) return null;
  return stdout.substring(contentStart, endIdx);
}

/**
 * Parse all webmode sections from STAMP stdout.
 */
export function parseWebmodeOutput(stdout: string): WebmodeResult {
  const enhancedSection = extractSection(stdout, "ENHANCED_ALIGNMENT");
  const fbpSection = extractSection(stdout, "FBP");
  const pairwiseSection = extractSection(stdout, "PAIRWISE");
  const treeSection = extractSection(stdout, "LABELED_TREE");
  const profilesSection = extractSection(stdout, "INTERNAL_PROFILES");
  const matchSection = extractSection(stdout, "MATCH_DETAILS");
  const consensusSection = extractSection(stdout, "MULTI_ALIGN_CONSENSUS");

  return {
    enhancedAlignment: enhancedSection ? parseWebmodeEnhancedAlignment(enhancedSection) : null,
    fbp: fbpSection ? parseWebmodeFBP(fbpSection) : null,
    pairwise: pairwiseSection ? parseWebmodePairwise(pairwiseSection) : null,
    tree: treeSection ? parseWebmodeTree(treeSection) : null,
    internalProfiles: profilesSection ? parseWebmodeInternalProfiles(profilesSection) : null,
    matchDetails: matchSection ? parseWebmodeMatchDetails(matchSection) : null,
    consensus: consensusSection ? parseWebmodeConsensus(consensusSection) : null,
  };
}

/**
 * Parse the ENHANCED_ALIGNMENT section.
 *
 * Each motif block:
 *   >>MOTIF\tName\tStrand(+/-)\tID
 *   >>CONSENSUS\tSequence
 *   >>PFM_START\tLength
 *   0.5\t0.2\t0.2\t0.1   (or GAP)
 *   ...
 *   >>PFM_END
 */
function parseWebmodeEnhancedAlignment(section: string): MultipleAlignmentEntry[] | null {
  const lines = section.split(/\r?\n/);
  const entries: MultipleAlignmentEntry[] = [];

  let currentName = "";
  let currentStrand = "+";
  let currentId = 0;
  let currentMatrix: number[][] = [];
  let inPfm = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;

    if (trimmed.startsWith(">>MOTIF\t")) {
      // >>MOTIF\tName\tStrand\tID
      const parts = trimmed.split("\t");
      currentName = parts[1] || "";
      currentStrand = parts[2] || "+";
      currentId = parseInt(parts[3] || "0", 10);
      currentMatrix = [];
      inPfm = false;
    } else if (trimmed.startsWith(">>PFM_START")) {
      inPfm = true;
    } else if (trimmed === ">>PFM_END") {
      inPfm = false;
      if (currentName && currentMatrix.length > 0) {
        entries.push({
          name: currentName,
          strand: currentStrand,
          id: currentId,
          alignedMatrix: currentMatrix,
        });
      }
    } else if (inPfm) {
      if (trimmed === "GAP") {
        currentMatrix.push([0, 0, 0, 0]);
      } else {
        const vals = trimmed.split(/\t/).map(Number);
        if (vals.length >= 4 && vals.every((v) => !isNaN(v))) {
          currentMatrix.push([vals[0], vals[1], vals[2], vals[3]]);
        }
      }
    }
    // >>CONSENSUS lines are skipped — we have the full PFM
  }

  return entries.length > 0 ? entries : null;
}

/**
 * Parse the FBP section (TRANSFAC format).
 *
 *   DE\tFBP
 *   0\tA\tC\tG\tT\tconsensus
 *   ...
 *   XX
 */
function parseWebmodeFBP(section: string): number[][] | null {
  const lines = section.split(/\r?\n/);
  const matrix: number[][] = [];

  for (const line of lines) {
    const parts = line.trim().split(/\t/);
    // Data rows: position\tA\tC\tG\tT\tconsensus (6+ parts, first is numeric)
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

/**
 * Parse the PAIRWISE section.
 *
 *   \tMotif1\tMotif2\tMotif3
 *
 *   Motif1\t-\t1.23e-02\t4.56e-03
 *   ...
 */
function parseWebmodePairwise(section: string): PairwiseScores | null {
  const lines = section.split(/\r?\n/);
  const motifNames: string[] = [];
  const matrix: number[][] = [];
  let headerFound = false;

  for (const line of lines) {
    if (line.trim() === "") continue;

    if (!headerFound) {
      // Header row starts with tab: \tMotif1\tMotif2...
      if (line.startsWith("\t")) {
        headerFound = true;
        continue; // Header names are extracted from data rows instead
      }
      continue;
    }

    // Data row: MotifName\tval\tval...
    const parts = line.split(/\t/);
    if (parts.length < 2) continue;

    const name = parts[0].trim();
    if (name === "") continue;

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
 * Parse the LABELED_TREE section. Returns the Newick string.
 */
function parseWebmodeTree(section: string): string | null {
  const trimmed = section.trim();
  if (!trimmed) return null;
  // Strip trailing semicolon if present (STAMP appends it)
  return trimmed.endsWith(";") ? trimmed.slice(0, -1).trim() : trimmed;
}

/**
 * Parse the INTERNAL_PROFILES section.
 *
 * Each internal node:
 *   >>INTERNAL_NODE\tName\tID
 *   DE\tName
 *   0\tA\tC\tG\tT\tconsensus
 *   ...
 *   XX
 */
function parseWebmodeInternalProfiles(
  section: string
): { name: string; id: number; matrix: number[][] }[] | null {
  const lines = section.split(/\r?\n/);
  const profiles: { name: string; id: number; matrix: number[][] }[] = [];

  let currentName = "";
  let currentId = 0;
  let currentMatrix: number[][] = [];
  let inProfile = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;

    if (trimmed.startsWith(">>INTERNAL_NODE\t")) {
      // Save previous if any
      if (inProfile && currentName && currentMatrix.length > 0) {
        profiles.push({ name: currentName, id: currentId, matrix: currentMatrix });
      }
      const parts = trimmed.split("\t");
      currentName = parts[1] || "";
      currentId = parseInt(parts[2] || "0", 10);
      currentMatrix = [];
      inProfile = true;
    } else if (trimmed === "XX") {
      if (inProfile && currentName && currentMatrix.length > 0) {
        profiles.push({ name: currentName, id: currentId, matrix: currentMatrix });
      }
      inProfile = false;
      currentName = "";
      currentMatrix = [];
    } else if (inProfile && trimmed.startsWith("DE\t")) {
      // Skip DE header line (name already captured from >>INTERNAL_NODE)
    } else if (inProfile) {
      const parts = trimmed.split(/\t/);
      // Data rows: position\tA\tC\tG\tT\tconsensus
      if (parts.length >= 5 && !isNaN(Number(parts[0]))) {
        const a = Number(parts[1]);
        const c = Number(parts[2]);
        const g = Number(parts[3]);
        const t = Number(parts[4]);
        if (!isNaN(a) && !isNaN(c) && !isNaN(g) && !isNaN(t)) {
          currentMatrix.push([a, c, g, t]);
        }
      }
    }
  }

  // Save last profile if XX was missing
  if (inProfile && currentName && currentMatrix.length > 0) {
    profiles.push({ name: currentName, id: currentId, matrix: currentMatrix });
  }

  return profiles.length > 0 ? profiles : null;
}

/**
 * Parse the MATCH_DETAILS section.
 *
 * For each query:
 *   >>QUERY\tName
 *   >>MATCH\tName\tE-value\tQueryStrand(+/-)\tMatchStrand(+/-)
 *   >>QUERY_CONSENSUS\tSequence
 *   >>MATCH_CONSENSUS\tSequence
 *   >>MATCH_PFM_START\tLength
 *   0.5\t0.2\t0.2\t0.1
 *   ...
 *   >>MATCH_PFM_END
 *   ... (more matches per query)
 */
function parseWebmodeMatchDetails(section: string): MatchResult[] | null {
  const lines = section.split(/\r?\n/);
  const results: MatchResult[] = [];

  let currentQuery: MatchResult | null = null;
  let currentMatch: Partial<MatchEntry> | null = null;
  let currentMatchPfm: number[][] = [];
  let inMatchPfm = false;

  function finalizeMatch() {
    if (currentQuery && currentMatch && currentMatch.name) {
      currentQuery.matches.push({
        name: currentMatch.name,
        evalue: currentMatch.evalue ?? 0,
        queryStrand: currentMatch.queryStrand ?? "+",
        matchStrand: currentMatch.matchStrand ?? "+",
        alignmentQuery: currentMatch.alignmentQuery ?? "",
        alignmentMatch: currentMatch.alignmentMatch ?? "",
        matchMotifMatrix: currentMatchPfm.length > 0 ? currentMatchPfm : null,
        queryMotifMatrix: null, // Populated later from input motifs
        queryLength: currentMatch.queryLength ?? 0,
        queryAlignStart: currentMatch.queryAlignStart ?? 0,
        queryAlignEnd: currentMatch.queryAlignEnd ?? 0,
        matchLength: currentMatch.matchLength ?? 0,
        matchAlignStart: currentMatch.matchAlignStart ?? 0,
        matchAlignEnd: currentMatch.matchAlignEnd ?? 0,
      });
    }
    currentMatch = null;
    currentMatchPfm = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;

    if (trimmed.startsWith(">>QUERY\t")) {
      // Finalize any pending match
      finalizeMatch();
      const queryName = trimmed.split("\t")[1] || "";
      currentQuery = { queryName, matches: [] };
      results.push(currentQuery);
    } else if (trimmed.startsWith(">>MATCH\t")) {
      // Finalize previous match if any
      finalizeMatch();
      // >>MATCH\tName\tE-value\tQueryStrand\tMatchStrand
      const parts = trimmed.split("\t");
      currentMatch = {
        name: parts[1] || "",
        evalue: parseFloat(parts[2] || "0"),
        queryStrand: parts[3] || "+",
        matchStrand: parts[4] || "+",
      };
    } else if (trimmed.startsWith(">>MATCH_REGION\t")) {
      // >>MATCH_REGION\tqueryLen\tqueryAlignStart\tqueryAlignEnd\tmatchLen\tmatchAlignStart\tmatchAlignEnd
      if (currentMatch) {
        const parts = trimmed.split("\t");
        currentMatch.queryLength = parseInt(parts[1] || "0", 10);
        currentMatch.queryAlignStart = parseInt(parts[2] || "0", 10);
        currentMatch.queryAlignEnd = parseInt(parts[3] || "0", 10);
        currentMatch.matchLength = parseInt(parts[4] || "0", 10);
        currentMatch.matchAlignStart = parseInt(parts[5] || "0", 10);
        currentMatch.matchAlignEnd = parseInt(parts[6] || "0", 10);
      }
    } else if (trimmed.startsWith(">>QUERY_CONSENSUS\t")) {
      if (currentMatch) {
        currentMatch.alignmentQuery = trimmed.split("\t")[1] || "";
      }
    } else if (trimmed.startsWith(">>MATCH_CONSENSUS\t")) {
      if (currentMatch) {
        currentMatch.alignmentMatch = trimmed.split("\t")[1] || "";
      }
    } else if (trimmed.startsWith(">>MATCH_PFM_START")) {
      inMatchPfm = true;
      currentMatchPfm = [];
    } else if (trimmed === ">>MATCH_PFM_END") {
      inMatchPfm = false;
    } else if (inMatchPfm) {
      const vals = trimmed.split(/\t/).map(Number);
      if (vals.length >= 4 && vals.every((v) => !isNaN(v))) {
        currentMatchPfm.push([vals[0], vals[1], vals[2], vals[3]]);
      }
    }
  }

  // Finalize last match
  finalizeMatch();

  return results.length > 0 ? results : null;
}

/**
 * Parse the MULTI_ALIGN_CONSENSUS section.
 *
 *   MotifName:\tACTTCCGGT
 *   MotifName2:\t-CTTCCGG-
 */
function parseWebmodeConsensus(
  section: string
): { name: string; alignedSequence: string }[] | null {
  const lines = section.split(/\r?\n/);
  const entries: { name: string; alignedSequence: string }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;

    // Parse "MotifName:\tSequence" or "MotifName:  Sequence"
    const match = trimmed.match(/^(.+?):\s+([ACGTWSMKRYBDHVN\-]+)\s*$/i);
    if (match) {
      entries.push({
        name: match[1].trim(),
        alignedSequence: match[2].trim(),
      });
    }
  }

  return entries.length > 0 ? entries : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Legacy File-based Parsers (kept for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

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
          queryStrand: "+",
          matchStrand: "+",
          alignmentQuery: parts[2].trim(),
          alignmentMatch: parts[3].trim(),
          matchMotifMatrix: null,
          queryMotifMatrix: null,
          queryLength: 0,
          queryAlignStart: 0,
          queryAlignEnd: 0,
          matchLength: 0,
          matchAlignStart: 0,
          matchAlignEnd: 0,
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

/**
 * Parse the multiple alignment from STAMP stdout.
 *
 * Format in stdout (non-silent mode):
 *   Multiple Alignment:
 *   GABPA:	ACTTCCGGT
 *   ELK4:	-CTTCCGG-
 *   SPI1:	--TTCCGG-
 *
 * Returns array of { name, alignedSequence } entries.
 */
export function parseMultipleAlignment(
  stdout: string
): { name: string; alignedSequence: string }[] | null {
  const lines = stdout.split(/\r?\n/);
  let startIdx = -1;

  // Find "Multiple Alignment:" header
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("Multiple Alignment:")) {
      startIdx = i + 1;
      break;
    }
  }

  if (startIdx === -1) return null;

  const entries: { name: string; alignedSequence: string }[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "") continue;

    // Stop at next section headers
    if (
      line.startsWith("Alignments Finished") ||
      line.startsWith("Tree Built") ||
      line.startsWith("FBP") ||
      line.startsWith("STAMP")
    ) {
      break;
    }

    // Parse "MotifName:\tAC-TTCCGGT" or "MotifName:  AC-TTCCGGT"
    // Include IUPAC ambiguity codes: W, S, M, K, R, Y, B, D, H, V, N
    const match = line.match(/^(.+?):\s+([ACGTWSMKRYBDHVN\-]+)\s*$/i);
    if (match) {
      entries.push({
        name: match[1].trim(),
        alignedSequence: match[2].trim(),
      });
    } else {
      // If we've already collected some entries and hit a non-matching line, stop
      if (entries.length > 0) break;
    }
  }

  return entries.length > 0 ? entries : null;
}
