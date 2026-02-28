"use client";

import { useState } from "react";
import { SequenceLogo } from "@/components/motif/SequenceLogo";
import { RCToggle } from "@/components/motif/RCToggle";
import type { MultipleAlignmentEntry } from "@/types";

interface MultipleAlignmentViewerProps {
  alignment: MultipleAlignmentEntry[];
}

/**
 * Display multiple alignment as stacked, aligned sequence logos.
 * Each motif's alignedMatrix comes pre-built from STAMP (gaps are [0,0,0,0]).
 */
export function MultipleAlignmentViewer({ alignment }: MultipleAlignmentViewerProps) {
  const [rc, setRc] = useState(false);

  if (!alignment || alignment.length === 0) {
    return <p className="text-sm text-gray-500">No alignment data available.</p>;
  }

  const alignLen = alignment[0]?.alignedMatrix.length || 0;
  const posWidth = 20;
  const logoWidth = alignLen * posWidth;

  return (
    <div className="overflow-x-auto">
      <div className="flex justify-end mb-2 px-1">
        <RCToggle active={rc} onToggle={() => setRc((v) => !v)} />
      </div>
      <div className="space-y-1">
        {alignment.map((entry) => (
          <div key={entry.name} className="flex items-center gap-3">
            <div className="w-32 text-right text-sm font-medium text-gray-700 flex-shrink-0 truncate" title={entry.name}>
              {entry.name}
              <span className="ml-1 text-xs text-gray-400">
                ({entry.strand})
              </span>
            </div>
            <div className="flex-shrink-0">
              <SequenceLogo
                matrix={entry.alignedMatrix}
                height={80}
                width={logoWidth}
                reverseComplement={rc}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
