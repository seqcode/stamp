// ── Motif Types ──

export interface ParsedMotif {
  name: string;
  matrix: number[][]; // Each row is [A, C, G, T] counts/frequencies
  format: MotifFormat;
}

export type MotifFormat = "transfac" | "meme" | "jaspar" | "modisco" | "consensus" | "aligned-fasta";

// ── STAMP Parameter Types ──

export type ColumnMetric = "PCC" | "ALLR" | "ALLR_LL" | "CS" | "KL" | "SSD";
export type AlignmentMethod = "SWU" | "SWA" | "SW" | "NW";
export type MultipleAlignmentMethod = "PPA" | "IR" | "NONE";
export type TreeMethod = "UPGMA" | "NJ";

export interface StampParams {
  columnMetric: ColumnMetric;
  alignmentMethod: AlignmentMethod;
  multipleAlignment: MultipleAlignmentMethod;
  treeMethod: TreeMethod;
  gapOpen: number;
  gapExtend: number;
  overlapAlign: boolean;
  forwardOnly: boolean;
}

export const DEFAULT_PARAMS: StampParams = {
  columnMetric: "PCC",
  alignmentMethod: "SWU",
  multipleAlignment: "PPA",
  treeMethod: "UPGMA",
  gapOpen: 1.0,
  gapExtend: 0.5,
  overlapAlign: true,
  forwardOnly: false,
};

// ── Job Types ──

export type JobStatus =
  | "queued"
  | "running"
  | "processing_results"
  | "complete"
  | "failed";

export interface MatchResult {
  queryName: string;
  matches: MatchEntry[];
}

export interface MatchEntry {
  name: string;
  evalue: number;
  queryStrand: string;
  matchStrand: string;
  alignmentQuery: string;
  alignmentMatch: string;
  matchMotifMatrix: number[][] | null;
  queryMotifMatrix: number[][] | null;
  queryLength: number;
  queryAlignStart: number;
  queryAlignEnd: number;
  matchLength: number;
  matchAlignStart: number;
  matchAlignEnd: number;
  dbSource?: string;      // e.g. "JASPAR"
  dbId?: string;          // e.g. "MA0139.1"
  dbUrl?: string;         // e.g. "https://jaspar.elixir.no/matrix/MA0139.1"
  dbCollection?: string;  // e.g. "CORE"
}

export interface PairwiseScores {
  motifNames: string[];
  matrix: number[][];
}

export interface MultipleAlignmentEntry {
  name: string;
  strand: string;             // "+" or "-"
  id: number;
  alignedMatrix: number[][];  // Aligned PFM from STAMP (gaps → [0,0,0,0])
}

export interface JobResults {
  treeNewick: string | null;
  matchPairs: MatchResult[];
  pairwiseScores: PairwiseScores | null;
  fbpProfile: number[][] | null;
  multipleAlignment: MultipleAlignmentEntry[] | null;
  internalProfiles: { name: string; id: number; matrix: number[][] }[] | null;
  inputMotifs: { name: string; matrix: number[][] }[];
  stampStdout: string;
}

export interface MatchingConfig {
  enabled: boolean;
  taxonGroups: string[];
  topMatches: number;
  customDbFileKey: string | null;
}

export interface JobInput {
  motifs: ParsedMotif[];
  rawText: string | null;
  fileName: string | null;
}

// ── JASPAR Types ──

export interface JasparMatrix {
  matrix_id: string;
  base_id: string;
  version: number;
  name: string;
  collection: string;
  tax_group: string;
  class: string | null;
  family: string | null;
  species: { tax_id: number; name: string }[];
  pfm: { A: number[]; C: number[]; G: number[]; T: number[] };
  uniprot_ids: string[];
}

// ── SSE Event Types ──

export interface JobStatusEvent {
  jobId: string;
  status: JobStatus;
  error?: string;
}

// ── Taxon groups available in JASPAR ──

export const JASPAR_TAXON_GROUPS = [
  "vertebrates",
  "plants",
  "insects",
  "urochordates",
  "nematodes",
  "fungi",
  "diatoms",
  "trematodes",
  "dictyostelium",
  "cnidaria",
  "oomycota",
] as const;

export type JasparTaxonGroup = (typeof JASPAR_TAXON_GROUPS)[number];
