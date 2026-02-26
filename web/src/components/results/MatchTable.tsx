"use client";

import { useState } from "react";
import { SequenceLogo } from "@/components/motif/SequenceLogo";
import type { MatchResult } from "@/types";

interface MatchTableProps {
  matchPairs: MatchResult[];
}

export function MatchTable({ matchPairs }: MatchTableProps) {
  const [expandedQuery, setExpandedQuery] = useState<string | null>(
    matchPairs[0]?.queryName || null
  );

  if (matchPairs.length === 0) {
    return <p className="text-sm text-gray-500">No matches found.</p>;
  }

  return (
    <div className="space-y-3">
      {matchPairs.map((result) => (
        <div key={result.queryName} className="border border-gray-200 rounded-lg">
          {/* Query Header */}
          <button
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
            onClick={() =>
              setExpandedQuery(
                expandedQuery === result.queryName ? null : result.queryName
              )
            }
          >
            <span className="font-medium text-sm text-gray-900">
              {result.queryName}
            </span>
            <span className="text-xs text-gray-500">
              {result.matches.length} match{result.matches.length !== 1 ? "es" : ""}
              <span className="ml-2">
                {expandedQuery === result.queryName ? "\u25B2" : "\u25BC"}
              </span>
            </span>
          </button>

          {/* Matches */}
          {expandedQuery === result.queryName && (
            <div className="border-t border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2">#</th>
                    <th className="px-4 py-2">Match</th>
                    <th className="px-4 py-2">E-value</th>
                    <th className="px-4 py-2">Alignment</th>
                    <th className="px-4 py-2">Logo</th>
                  </tr>
                </thead>
                <tbody>
                  {result.matches.map((match, idx) => (
                    <tr
                      key={`${match.name}-${idx}`}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-2 text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-2 font-medium text-gray-900">
                        {match.name}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {match.evalue.toExponential(2)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-mono text-xs space-y-0.5">
                          <div className="text-gray-600">
                            Q: {match.alignmentQuery}
                          </div>
                          <div className="text-gray-600">
                            M: {match.alignmentMatch}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        {match.matchMotifMatrix && (
                          <SequenceLogo
                            matrix={match.matchMotifMatrix}
                            height={40}
                            width={Math.min(match.matchMotifMatrix.length * 15 + 40, 200)}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
