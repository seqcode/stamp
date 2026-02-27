"use client";

import { useState } from "react";
import { SequenceLogo } from "@/components/motif/SequenceLogo";
import { RCToggle } from "@/components/motif/RCToggle";
import type { MatchResult } from "@/types";

interface MatchTableProps {
  matchPairs: MatchResult[];
}

export function MatchTable({ matchPairs }: MatchTableProps) {
  // All expanded by default
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Per-query reverse complement state
  const [rcQueries, setRcQueries] = useState<Set<string>>(new Set());

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

  const toggleRc = (queryName: string) => {
    setRcQueries((prev) => {
      const next = new Set(prev);
      if (next.has(queryName)) {
        next.delete(queryName);
      } else {
        next.add(queryName);
      }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {matchPairs.map((result) => {
        const isExpanded = !collapsed.has(result.queryName);
        const isRc = rcQueries.has(result.queryName);

        return (
          <div key={result.queryName} className="border border-gray-200 rounded-lg">
            {/* Query Header */}
            <div className="flex items-center justify-between px-4 py-3">
              <button
                className="flex-1 flex items-center justify-between text-left hover:text-gray-700 transition-colors"
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
              <div className="ml-3 flex-shrink-0">
                <RCToggle active={isRc} onToggle={() => toggleRc(result.queryName)} />
              </div>
            </div>

            {/* Matches */}
            {isExpanded && (
              <div className="border-t border-gray-100 divide-y divide-gray-100">
                {result.matches.map((match, idx) => (
                  <div
                    key={`${match.name}-${idx}`}
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
                      <span className="font-mono text-xs text-gray-500">
                        E-value: {match.evalue.toExponential(2)}
                      </span>
                    </div>

                    {/* Aligned logos */}
                    <div className="space-y-1">
                      {match.queryMotifMatrix && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 w-16 text-right flex-shrink-0">Query</span>
                          <SequenceLogo
                            matrix={match.queryMotifMatrix}
                            height={50}
                            showAxes={false}
                            reverseComplement={isRc}
                          />
                        </div>
                      )}
                      {match.matchMotifMatrix && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 w-16 text-right flex-shrink-0">Match</span>
                          <SequenceLogo
                            matrix={match.matchMotifMatrix}
                            height={50}
                            showAxes={false}
                            reverseComplement={isRc}
                          />
                        </div>
                      )}
                    </div>

                    {/* Text alignment */}
                    <div className="mt-2 font-mono text-xs text-gray-500">
                      <div>Q: {match.alignmentQuery}</div>
                      <div>M: {match.alignmentMatch}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
