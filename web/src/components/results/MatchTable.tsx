"use client";

import { useState, useCallback } from "react";
import { SequenceLogo } from "@/components/motif/SequenceLogo";
import { LogoToolbar } from "@/components/motif/LogoToolbar";
import { exportLogosAsPng, exportLogosAsSvg } from "@/lib/export/logoRenderer";
import type { LogoSpec } from "@/lib/export/logoRenderer";
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

  for (let i = 0; i < leftPad; i++) result.push([0, 0, 0, 0]);
  for (let i = 0; i < alignStart; i++) {
    result.push(i < rawPfm.length ? rawPfm[i] : [0, 0, 0, 0]);
  }

  const highlightStart = result.length;

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

  for (let i = alignEnd + 1; i < motifLength; i++) {
    result.push(i < rawPfm.length ? rawPfm[i] : [0, 0, 0, 0]);
  }

  for (let i = 0; i < rightPad; i++) result.push([0, 0, 0, 0]);

  return { matrix: result, highlightStart, highlightEnd };
}

/**
 * Compute the full display for a query/match pair.
 */
function buildAlignedPair(match: MatchEntry) {
  const hasRegion = match.queryLength > 0 && match.matchLength > 0;

  const rawQuery = match.queryMotifMatrix
    ? match.queryStrand === "-"
      ? reverseComplementMatrix(match.queryMotifMatrix)
      : match.queryMotifMatrix
    : null;
  const rawMatch = match.matchMotifMatrix
    ? match.matchStrand === "-"
      ? reverseComplementMatrix(match.matchMotifMatrix)
      : match.matchMotifMatrix
    : null;

  if (!rawQuery || !rawMatch || !hasRegion) {
    return buildAlignedPairLegacy(match, rawQuery, rawMatch);
  }

  const qAlignStart = match.queryAlignStart;
  const qAlignEnd = match.queryAlignEnd;
  const mAlignStart = match.matchAlignStart;
  const mAlignEnd = match.matchAlignEnd;
  const qLen = match.queryLength;
  const mLen = match.matchLength;

  const qLeftFlank = qAlignStart;
  const mLeftFlank = mAlignStart;
  const maxLeftFlank = Math.max(qLeftFlank, mLeftFlank);

  const qRightFlank = qLen - qAlignEnd - 1;
  const mRightFlank = mLen - mAlignEnd - 1;
  const maxRightFlank = Math.max(qRightFlank, mRightFlank);

  const qLeftPad = maxLeftFlank - qLeftFlank;
  const mLeftPad = maxLeftFlank - mLeftFlank;
  const qRightPad = maxRightFlank - qRightFlank;
  const mRightPad = maxRightFlank - mRightFlank;

  const query = buildFullAlignedMatrix(
    match.alignmentQuery, rawQuery, qAlignStart, qAlignEnd, qLen, qLeftPad, qRightPad,
  );
  const matchResult = buildFullAlignedMatrix(
    match.alignmentMatch, rawMatch, mAlignStart, mAlignEnd, mLen, mLeftPad, mRightPad,
  );

  return { query, match: matchResult };
}

function buildAlignedPairLegacy(
  match: MatchEntry,
  rawQuery: number[][] | null,
  rawMatch: number[][] | null,
) {
  function buildSimple(consensus: string, rawPfm: number[][]) {
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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Per-match state keyed by "queryName::matchName::idx"
  const [rcMatches, setRcMatches] = useState<Set<string>>(new Set());
  const [axesOff, setAxesOff] = useState<Set<string>>(new Set());

  if (matchPairs.length === 0) {
    return <p className="text-sm text-gray-500">No matches found.</p>;
  }

  const toggleQuery = (queryName: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(queryName) ? next.delete(queryName) : next.add(queryName);
      return next;
    });
  };

  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
    setter((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {matchPairs.map((result) => {
        const isExpanded = !collapsed.has(result.queryName);

        return (
          <div key={result.queryName} className="border border-gray-200 rounded-lg">
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              onClick={() => toggleQuery(result.queryName)}
            >
              <span className="font-medium text-sm text-gray-900">{result.queryName}</span>
              <span className="text-xs text-gray-500">
                {result.matches.length} match{result.matches.length !== 1 ? "es" : ""}
                <span className="ml-2">{isExpanded ? "\u25B2" : "\u25BC"}</span>
              </span>
            </button>

            {isExpanded && (
              <div className="border-t border-gray-100 divide-y divide-gray-100">
                {result.matches.map((match, idx) => {
                  const matchKey = `${result.queryName}::${match.name}::${idx}`;
                  return (
                    <MatchRow
                      key={matchKey}
                      match={match}
                      idx={idx}
                      queryName={result.queryName}
                      isRc={rcMatches.has(matchKey)}
                      showAxes={!axesOff.has(matchKey)}
                      onToggleRc={() => toggleSet(setRcMatches, matchKey)}
                      onToggleAxes={() => toggleSet(setAxesOff, matchKey)}
                    />
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

function MatchRow({
  match,
  idx,
  queryName,
  isRc,
  showAxes,
  onToggleRc,
  onToggleAxes,
}: {
  match: MatchEntry;
  idx: number;
  queryName: string;
  isRc: boolean;
  showAxes: boolean;
  onToggleRc: () => void;
  onToggleAxes: () => void;
}) {
  const aligned = buildAlignedPair(match);

  const totalLen = Math.max(aligned.query.matrix.length, aligned.match.matrix.length);
  const posWidth = 28;
  const logoWidth = totalLen * posWidth;

  const buildSpecs = useCallback((): LogoSpec[] => {
    const specs: LogoSpec[] = [];
    if (aligned.query.matrix.length > 0) {
      specs.push({
        label: `Query: ${queryName}`,
        matrix: aligned.query.matrix,
        reverseComplement: isRc,
        highlightRange: [aligned.query.highlightStart, aligned.query.highlightEnd],
        showAxes,
        height: 80,
        width: logoWidth,
      });
    }
    if (aligned.match.matrix.length > 0) {
      specs.push({
        label: `Match: ${match.name}`,
        matrix: aligned.match.matrix,
        reverseComplement: isRc,
        highlightRange: [aligned.match.highlightStart, aligned.match.highlightEnd],
        showAxes,
        height: 80,
        width: logoWidth,
      });
    }
    return specs;
  }, [aligned, isRc, showAxes, logoWidth, queryName, match.name]);

  const handlePng = useCallback(() => {
    exportLogosAsPng(buildSpecs(), `match-${queryName}-${match.name}.png`);
  }, [buildSpecs, queryName, match.name]);

  const handleSvg = useCallback(() => {
    exportLogosAsSvg(buildSpecs(), `match-${queryName}-${match.name}.svg`);
  }, [buildSpecs, queryName, match.name]);

  const hasRegion = match.queryLength > 0;

  return (
    <div className="px-4 py-3 hover:bg-gray-50">
      {/* Match header */}
      <div className="flex items-start justify-between mb-2 gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400">{idx + 1}.</span>
            {match.dbUrl ? (
              <a
                href={match.dbUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                {match.name}
              </a>
            ) : (
              <span className="font-medium text-sm text-gray-900">{match.name}</span>
            )}
            {match.dbId && (
              <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                {match.dbId}
              </span>
            )}
            {match.dbSource && (
              <span className="text-xs text-white bg-blue-500 px-1.5 py-0.5 rounded">
                {match.dbSource}{match.dbCollection ? ` ${match.dbCollection}` : ""}
              </span>
            )}
          </div>

          {/* Alignment info */}
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
            <span className="font-mono">
              E-value: {match.evalue.toExponential(2)}
            </span>
            {hasRegion && (
              <>
                <span className="text-gray-300">|</span>
                <span>
                  Query({match.queryStrand}): {match.queryAlignStart}&ndash;{match.queryAlignEnd}
                  <span className="text-gray-300 mx-1">/</span>
                  {match.queryLength} pos
                </span>
                <span>
                  Match({match.matchStrand}): {match.matchAlignStart}&ndash;{match.matchAlignEnd}
                  <span className="text-gray-300 mx-1">/</span>
                  {match.matchLength} pos
                </span>
              </>
            )}
          </div>
        </div>

        <LogoToolbar
          rc={isRc}
          onToggleRc={onToggleRc}
          showAxes={showAxes}
          onToggleAxes={onToggleAxes}
          onDownloadPng={handlePng}
          onDownloadSvg={handleSvg}
        />
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
              showAxes={showAxes}
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
              showAxes={showAxes}
              reverseComplement={isRc}
              highlightRange={[aligned.match.highlightStart, aligned.match.highlightEnd]}
            />
          </div>
        )}
      </div>
    </div>
  );
}
