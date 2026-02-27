"use client";

import { useState } from "react";
import { SequenceLogo } from "@/components/motif/SequenceLogo";
import { RCToggle } from "@/components/motif/RCToggle";
import type { MultipleAlignmentEntry } from "@/types";

interface MultipleAlignmentViewerProps {
  alignment: MultipleAlignmentEntry[];
}

/**
 * Build an aligned PFM from the original matrix and the gap-annotated alignment string.
 * Gaps ("-") become zero-count columns [0,0,0,0].
 * Non-gap characters map sequentially to original PFM positions.
 */
function buildAlignedMatrix(
  alignedSequence: string,
  originalMatrix: number[][]
): number[][] {
  const aligned: number[][] = [];
  let origIdx = 0;

  for (const ch of alignedSequence) {
    if (ch === "-") {
      aligned.push([0, 0, 0, 0]);
    } else {
      if (origIdx < originalMatrix.length) {
        aligned.push(originalMatrix[origIdx]);
        origIdx++;
      } else {
        aligned.push([0, 0, 0, 0]);
      }
    }
  }

  return aligned;
}

/**
 * Display multiple alignment as stacked, aligned sequence logos.
 * Each motif logo is padded with gap columns to show relative alignment.
 */
export function MultipleAlignmentViewer({ alignment }: MultipleAlignmentViewerProps) {
  const [rc, setRc] = useState(false);

  if (!alignment || alignment.length === 0) {
    return <p className="text-sm text-gray-500">No alignment data available.</p>;
  }

  const alignLen = alignment[0]?.alignedSequence.length || 0;
  const posWidth = 24;
  const logoWidth = alignLen * posWidth;

  return (
    <div className="overflow-x-auto">
      <div className="flex justify-end mb-2 px-1">
        <RCToggle active={rc} onToggle={() => setRc((v) => !v)} />
      </div>
      <div className="space-y-1">
        {alignment.map((entry) => {
          const alignedMatrix = buildAlignedMatrix(
            entry.alignedSequence,
            entry.originalMatrix
          );
          return (
            <div key={entry.name} className="flex items-center gap-3">
              <div className="w-28 text-right text-sm font-medium text-gray-700 flex-shrink-0 truncate" title={entry.name}>
                {entry.name}
              </div>
              <div className="flex-shrink-0">
                <SequenceLogo
                  matrix={alignedMatrix}
                  height={50}
                  width={logoWidth}
                  showAxes={false}
                  reverseComplement={rc}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
