"use client";

import { useState } from "react";
import { SequenceLogo } from "@/components/motif/SequenceLogo";
import { RCToggle } from "@/components/motif/RCToggle";
import type { MatchResult, MatchEntry } from "@/types";

interface MatchTableProps {
  matchPairs: MatchResult[];
}

/**
 * Reverse complement a PFM: reverse column order and swap A<->T, C<->G.
 */
function reverseComplementMatrix(matrix: number[][]): number[][] {
  return [...matrix].reverse().map(([a, c, g, t]) => [t, g, c, a]);
}

/**
 * Build a full-width aligned display matrix for one motif in a pairwise match.
 *
 * Produces a matrix that includes:
 *  - Left flanking region (before the aligned portion) from the raw PFM
 *  - The aligned region (consensus mapped to PFM columns starting at alignStart)
 *  - Right flanking region (after the aligned portion) from the raw PFM
 *  - Left/right padding with [0,0,0,0] for vertical alignment with the other motif
 *
 * Returns the display matrix and the column range [highlightStart, highlightEnd]
 * (0-based, inclusive) marking the aligned region within the display matrix.
 */
function buildFullAlignedMatrix(
  consensus: string,
  rawPfm: number[][],
  alignStart: number,
  alignEnd: number,
  motifLength: number,
  leftPad: number,
  rightPad: number,
): { matrix: number[][]; highlightStart: number; highlightEnd: number } {
  const result: number[][] = [];

  // 1. Left padding (empty columns for alignment with other motif)
  for (let i = 0; i < leftPad; i++) {
    result.push([0, 0, 0, 0]);
  }

  // 2. Left flanking region from raw PFM (before aligned region)
  for (let i = 0; i < alignStart; i++) {
    result.push(i < rawPfm.length ? rawPfm[i] : [0, 0, 0, 0]);
  }

  const highlightStart = result.length;

  // 3. Aligned region from consensus
  let rawIdx = alignStart;
  for (const ch of consensus) {
    if (ch === "-") {
      result.push([0, 0, 0, 0]);
    } else {
      if (rawIdx < rawPfm.length) {
        result.push(rawPfm[rawIdx]);
        rawIdx++;
      } else {
        result.push([0, 0, 0, 0]);
      }
    }
  }

  const highlightEnd = result.length - 1;

  // 4. Right flanking region from raw PFM (after aligned region)
  for (let i = alignEnd + 1; i < motifLength; i++) {
    result.push(i < rawPfm.length ? rawPfm[i] : [0, 0, 0, 0]);
  }

  // 5. Right padding (empty columns for alignment with other motif)
  for (let i = 0; i < rightPad; i++) {
    result.push([0, 0, 0, 0]);
  }

  return { matrix: result, highlightStart, highlightEnd };
}

/**
 * Compute the full display for a query/match pair, with padding so both
 * logos are the same total width and properly aligned.
 */
function buildAlignedPair(match: MatchEntry) {
  const hasRegion = match.queryLength > 0 && match.matchLength > 0;

  // Orient raw PFMs based on strand
  const rawQuery = match.queryMotifMatrix
    ? (match.queryStrand === "-"
      ? reverseComplementMatrix(match.queryMotifMatrix)
      : match.queryMotifMatrix)
    : null;
  const rawMatch = match.matchMotifMatrix
    ? (match.matchStrand === "-"
      ? reverseComplementMatrix(match.matchMotifMatrix)
      : match.matchMotifMatrix)
    : null;

  if (!rawQuery || !rawMatch || !hasRegion) {
    // Fallback: simple consensus-based alignment (no offset info)
    return buildAlignedPairLegacy(match, rawQuery, rawMatch);
  }

  const qAlignStart = match.queryAlignStart;
  const qAlignEnd = match.queryAlignEnd;
  const mAlignStart = match.matchAlignStart;
  const mAlignEnd = match.matchAlignEnd;
  const qLen = match.queryLength;
  const mLen = match.matchLength;

  // Left flanking: how many motif columns are before the aligned region
  const qLeftFlank = qAlignStart;
  const mLeftFlank = mAlignStart;
  const maxLeftFlank = Math.max(qLeftFlank, mLeftFlank);

  // Right flanking: how many motif columns are after the aligned region
  const qRightFlank = qLen - qAlignEnd - 1;
  const mRightFlank = mLen - mAlignEnd - 1;
  const maxRightFlank = Math.max(qRightFlank, mRightFlank);

  // Left/right padding per motif to align them
  const qLeftPad = maxLeftFlank - qLeftFlank;
  const mLeftPad = maxLeftFlank - mLeftFlank;
  const qRightPad = maxRightFlank - qRightFlank;
  const mRightPad = maxRightFlank - mRightFlank;

  const query = buildFullAlignedMatrix(
    match.alignmentQuery, rawQuery,
    qAlignStart, qAlignEnd, qLen,
    qLeftPad, qRightPad,
  );
  const matchResult = buildFullAlignedMatrix(
    match.alignmentMatch, rawMatch,
    mAlignStart, mAlignEnd, mLen,
    mLeftPad, mRightPad,
  );

  return { query, match: matchResult };
}

/**
 * Legacy fallback when MATCH_REGION data is not available.
 * Just builds from consensus starting at index 0.
 */
function buildAlignedPairLegacy(
  match: MatchEntry,
  rawQuery: number[][] | null,
  rawMatch: number[][] | null,
) {
  function buildSimple(consensus: string, rawPfm: number[][]): {
    matrix: number[][]; highlightStart: number; highlightEnd: number;
  } {
    const result: number[][] = [];
    let rawIdx = 0;
    for (const ch of consensus) {
      if (ch === "-") {
        result.push([0, 0, 0, 0]);
      } else {
        result.push(rawIdx < rawPfm.length ? rawPfm[rawIdx++] : [0, 0, 0, 0]);
      }
    }
    return { matrix: result, highlightStart: 0, highlightEnd: result.length - 1 };
  }

  const query = rawQuery && match.alignmentQuery
    ? buildSimple(match.alignmentQuery, rawQuery)
    : null;
  const matchData = rawMatch && match.alignmentMatch
    ? buildSimple(match.alignmentMatch, rawMatch)
    : null;

  return {
    query: query || { matrix: [], highlightStart: 0, highlightEnd: 0 },
    match: matchData || { matrix: [], highlightStart: 0, highlightEnd: 0 },
  };
}

export function MatchTable({ matchPairs }: MatchTableProps) {
  // All query groups expanded by default
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Per-match RC state, keyed by "queryName::matchName::idx"
  const [rcMatches, setRcMatches] = useState<Set<string>>(new Set());

  if (matchPairs.length === 0) {
    return <p className="text-sm text-gray-500">No matches found.</p>;
  }

  const toggleQuery = (queryName: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(queryName)) {
        next.delete(queryName);
      } else {
        next.add(queryName);
      }
      return next;
    });
  };

  const toggleRc = (matchKey: string) => {
    setRcMatches((prev) => {
      const next = new Set(prev);
      if (next.has(matchKey)) {
        next.delete(matchKey);
      } else {
        next.add(matchKey);
      }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {matchPairs.map((result) => {
        const isExpanded = !collapsed.has(result.queryName);

        return (
          <div key={result.queryName} className="border border-gray-200 rounded-lg">
            {/* Query Header */}
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              onClick={() => toggleQuery(result.queryName)}
            >
              <span className="font-medium text-sm text-gray-900">
                {result.queryName}
              </span>
              <span className="text-xs text-gray-500">
                {result.matches.length} match{result.matches.length !== 1 ? "es" : ""}
                <span className="ml-2">
                  {isExpanded ? "\u25B2" : "\u25BC"}
                </span>
              </span>
            </button>

            {/* Matches */}
            {isExpanded && (
              <div className="border-t border-gray-100 divide-y divide-gray-100">
                {result.matches.map((match, idx) => {
                  const matchKey = `${result.queryName}::${match.name}::${idx}`;
                  const isRc = rcMatches.has(matchKey);

                  // Build full-width aligned PFMs with flanking regions
                  const aligned = buildAlignedPair(match);

                  const totalLen = Math.max(
                    aligned.query.matrix.length,
                    aligned.match.matrix.length
                  );
                  const posWidth = 20;
                  const logoWidth = totalLen * posWidth;

                  return (
                    <div
                      key={matchKey}
                      className="px-4 py-3 hover:bg-gray-50"
                    >
                      {/* Match header line */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{idx + 1}.</span>
                          <span className="font-medium text-sm text-gray-900">
                            {match.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs text-gray-500">
                            E-value: {match.evalue.toExponential(2)}
                          </span>
                          <RCToggle active={isRc} onToggle={() => toggleRc(matchKey)} />
                        </div>
                      </div>

                      {/* Aligned logos */}
                      <div className="space-y-1">
                        {aligned.query.matrix.length > 0 && (
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 w-16 text-right flex-shrink-0">Query</span>
                            <SequenceLogo
                              matrix={aligned.query.matrix}
                              height={80}
                              width={logoWidth}
                              reverseComplement={isRc}
                              highlightRange={[aligned.query.highlightStart, aligned.query.highlightEnd]}
                            />
                          </div>
                        )}
                        {aligned.match.matrix.length > 0 && (
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 w-16 text-right flex-shrink-0">Match</span>
                            <SequenceLogo
                              matrix={aligned.match.matrix}
                              height={80}
                              width={logoWidth}
                              reverseComplement={isRc}
                              highlightRange={[aligned.match.highlightStart, aligned.match.highlightEnd]}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
