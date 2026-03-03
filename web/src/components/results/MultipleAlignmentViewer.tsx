"use client";

import { useState, useCallback } from "react";
import { SequenceLogo } from "@/components/motif/SequenceLogo";
import { LogoToolbar } from "@/components/motif/LogoToolbar";
import { Button } from "@/components/ui/Button";
import { exportLogosAsPng, exportLogosAsSvg } from "@/lib/export/logoRenderer";
import type { LogoSpec } from "@/lib/export/logoRenderer";
import type { MultipleAlignmentEntry } from "@/types";

interface MultipleAlignmentViewerProps {
  alignment: MultipleAlignmentEntry[];
  fbp?: number[][] | null;
}

/**
 * Convert a PFM matrix to TRANSFAC format string.
 */
function matrixToTransfac(matrix: number[][], name = "FBP"): string {
  const lines: string[] = [`DE\t${name}`];
  for (let i = 0; i < matrix.length; i++) {
    const [a, c, g, t] = matrix[i];
    lines.push(`${i}\t${a.toFixed(4)}\t${c.toFixed(4)}\t${g.toFixed(4)}\t${t.toFixed(4)}\tN`);
  }
  lines.push("XX");
  return lines.join("\n") + "\n";
}

/**
 * Display multiple alignment as stacked, aligned sequence logos.
 * Optionally includes the FBP at the bottom with a separator.
 */
export function MultipleAlignmentViewer({
  alignment,
  fbp,
}: MultipleAlignmentViewerProps) {
  const [rc, setRc] = useState(false);
  const [showAxes, setShowAxes] = useState(true);

  if (!alignment || alignment.length === 0) {
    return <p className="text-sm text-gray-500">No alignment data available.</p>;
  }

  const alignLen = alignment[0]?.alignedMatrix.length || 0;
  const posWidth = 28;
  const logoWidth = alignLen * posWidth;

  const buildExportSpecs = useCallback((): LogoSpec[] => {
    const specs: LogoSpec[] = alignment.map((entry) => ({
      label: `${entry.name} (${entry.strand})`,
      matrix: entry.alignedMatrix,
      reverseComplement: rc,
      showAxes,
      height: 80,
      width: logoWidth,
    }));
    if (fbp) {
      // Pad FBP to alignment length if needed
      let fbpMatrix = fbp;
      if (fbp.length < alignLen) {
        fbpMatrix = [...fbp, ...Array(alignLen - fbp.length).fill([0, 0, 0, 0])];
      }
      specs.push({
        label: "FBP",
        matrix: fbpMatrix,
        reverseComplement: rc,
        showAxes,
        height: 100,
        width: logoWidth,
      });
    }
    return specs;
  }, [alignment, fbp, rc, showAxes, alignLen, logoWidth]);

  const handleDownloadPng = useCallback(() => {
    exportLogosAsPng(buildExportSpecs(), "multiple-alignment.png");
  }, [buildExportSpecs]);

  const handleDownloadSvg = useCallback(() => {
    exportLogosAsSvg(buildExportSpecs(), "multiple-alignment.svg");
  }, [buildExportSpecs]);

  const handleDownloadFbpTransfac = useCallback(() => {
    if (!fbp) return;
    const content = matrixToTransfac(fbp, "FBP");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stamp-fbp.transfac";
    a.click();
    URL.revokeObjectURL(url);
  }, [fbp]);

  // Pad FBP to alignment length for display
  let displayFbp = fbp;
  if (fbp && fbp.length < alignLen) {
    displayFbp = [...fbp, ...Array(alignLen - fbp.length).fill([0, 0, 0, 0])];
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          {fbp && (
            <Button variant="ghost" size="sm" onClick={handleDownloadFbpTransfac}>
              Download FBP (TRANSFAC)
            </Button>
          )}
        </div>
        <LogoToolbar
          rc={rc}
          onToggleRc={() => setRc((v) => !v)}
          showAxes={showAxes}
          onToggleAxes={() => setShowAxes((v) => !v)}
          onDownloadPng={handleDownloadPng}
          onDownloadSvg={handleDownloadSvg}
        />
      </div>

      <div className="space-y-1">
        {alignment.map((entry) => (
          <div key={entry.name} className="flex items-center gap-3">
            <div
              className="w-32 text-right text-sm font-medium text-gray-700 flex-shrink-0 truncate"
              title={entry.name}
            >
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
                showAxes={showAxes}
                reverseComplement={rc}
              />
            </div>
          </div>
        ))}
      </div>

      {/* FBP section */}
      {displayFbp && (
        <>
          <div className="border-t border-gray-200 my-3" />
          <p className="text-xs font-medium text-gray-500 mb-1 px-1">
            Familial Binding Profile (FBP)
          </p>
          <div className="flex items-center gap-3">
            <div className="w-32 text-right text-sm font-medium text-gray-700 flex-shrink-0">
              FBP
            </div>
            <div className="flex-shrink-0">
              <SequenceLogo
                matrix={displayFbp}
                height={100}
                width={logoWidth}
                showAxes={showAxes}
                reverseComplement={rc}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
