"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useJobStatus } from "@/hooks/useJobStatus";
import { JobProgress } from "@/components/job/JobProgress";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SequenceLogo } from "@/components/motif/SequenceLogo";
import { RCToggle } from "@/components/motif/RCToggle";
import { TreeViewer } from "@/components/results/TreeViewer";
import { MatchTable } from "@/components/results/MatchTable";
import { MultipleAlignmentViewer } from "@/components/results/MultipleAlignmentViewer";
import type { JobResults, StampParams } from "@/types";

interface JobData {
  jobId: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  input: {
    motifCount: number;
    fileName: string | null;
    motifNames: string[];
  };
  params: StampParams;
  results: JobResults | null;
  error: string | null;
}

/**
 * A collapsible section wrapper for result cards.
 */
function CollapsibleSection({
  title,
  titleRight,
  children,
  defaultOpen = true,
}: {
  title: string;
  titleRight?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <CardHeader className="mb-0">
        <button
          className="flex items-center justify-between w-full text-left"
          onClick={() => setOpen((v) => !v)}
        >
          <CardTitle>{title}</CardTitle>
          <div className="flex items-center gap-2">
            {titleRight && <div onClick={(e) => e.stopPropagation()}>{titleRight}</div>}
            <span className="text-xs text-gray-400 ml-1">
              {open ? "\u25B2" : "\u25BC"}
            </span>
          </div>
        </button>
      </CardHeader>
      {open && <div className="mt-4">{children}</div>}
    </Card>
  );
}

/**
 * Human-readable labels for STAMP parameter values.
 */
const METRIC_LABELS: Record<string, string> = {
  PCC: "Pearson Correlation (PCC)",
  ALLR: "Average Log-Likelihood Ratio (ALLR)",
  ALLR_LL: "ALLR (Log-Likelihood)",
  CS: "Chi-Squared (CS)",
  KL: "Kullback-Leibler (KL)",
  SSD: "Sum of Squared Distances (SSD)",
};

const ALIGN_LABELS: Record<string, string> = {
  SWU: "Smith-Waterman Ungapped (SWU)",
  SWA: "Smith-Waterman Affine (SWA)",
  SW: "Smith-Waterman (SW)",
  NW: "Needleman-Wunsch (NW)",
};

const MULTI_LABELS: Record<string, string> = {
  PPA: "Progressive Profile Alignment (PPA)",
  IR: "Iterative Refinement (IR)",
  NONE: "None",
};

const TREE_LABELS: Record<string, string> = {
  UPGMA: "UPGMA",
  NJ: "Neighbor Joining (NJ)",
};

export default function JobPage() {
  const params = useParams();
  const jobId = params.jobId as string;
  const { status, error: sseError } = useJobStatus(jobId);
  const [job, setJob] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fbpRc, setFbpRc] = useState(false);
  const [inputRc, setInputRc] = useState(false);

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setJob(data);
      }
    } catch {
      // Will retry via SSE
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  // Initial fetch
  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // Re-fetch when status changes to complete
  useEffect(() => {
    if (status === "complete" || status === "failed") {
      fetchJob();
    }
  }, [status, fetchJob]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">Job Not Found</h1>
        <p className="mt-2 text-gray-600">
          This job may have expired or the ID is invalid.
        </p>
        <Button variant="secondary" className="mt-4" onClick={() => window.location.href = "/"}>
          Submit New Job
        </Button>
      </div>
    );
  }

  const isComplete = status === "complete" || job.status === "complete";
  const results = job.results;
  const p = job.params;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Job {jobId.slice(0, 8)}...
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {job.input.motifCount} motif{job.input.motifCount !== 1 ? "s" : ""}
            {job.input.fileName ? ` from ${job.input.fileName}` : ""}
            {" \u00B7 "}
            Submitted {new Date(job.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isComplete && (
            <Button
              variant="secondary"
              onClick={() => window.open(`/api/jobs/${jobId}/download`, "_blank")}
            >
              Download ZIP
            </Button>
          )}
        </div>
      </div>

      {/* Progress — hidden once results are ready */}
      {!isComplete && (
        <Card>
          <JobProgress status={status} error={sseError || job.error || undefined} />
        </Card>
      )}

      {/* Error display when complete but had errors */}
      {isComplete && (sseError || job.error) && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {sseError || job.error}
        </div>
      )}

      {/* Results */}
      {isComplete && results && (
        <>
          {/* 1. Input Parameters */}
          <CollapsibleSection
            title="Input Parameters"
            titleRight={
              <RCToggle active={inputRc} onToggle={() => setInputRc((v) => !v)} />
            }
          >
            {/* Alignment settings summary */}
            {p && (
              <div className="mb-4 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                <div>
                  <span className="text-gray-500">Column Metric:</span>{" "}
                  <span className="font-medium text-gray-800">
                    {METRIC_LABELS[p.columnMetric] || p.columnMetric}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Alignment:</span>{" "}
                  <span className="font-medium text-gray-800">
                    {ALIGN_LABELS[p.alignmentMethod] || p.alignmentMethod}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Multiple Alignment:</span>{" "}
                  <span className="font-medium text-gray-800">
                    {MULTI_LABELS[p.multipleAlignment] || p.multipleAlignment}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Tree Method:</span>{" "}
                  <span className="font-medium text-gray-800">
                    {TREE_LABELS[p.treeMethod] || p.treeMethod}
                  </span>
                </div>
                {p.alignmentMethod !== "SWU" && (
                  <>
                    <div>
                      <span className="text-gray-500">Gap Open:</span>{" "}
                      <span className="font-medium text-gray-800">{p.gapOpen}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Gap Extend:</span>{" "}
                      <span className="font-medium text-gray-800">{p.gapExtend}</span>
                    </div>
                  </>
                )}
                <div>
                  <span className="text-gray-500">Overlap Align:</span>{" "}
                  <span className="font-medium text-gray-800">
                    {p.overlapAlign ? "Yes" : "No"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Strand:</span>{" "}
                  <span className="font-medium text-gray-800">
                    {p.forwardOnly ? "Forward only" : "Both strands"}
                  </span>
                </div>
              </div>
            )}

            {/* Input motif logos */}
            {results.inputMotifs && results.inputMotifs.length > 0 && (
              <div className="space-y-3">
                {results.inputMotifs.map((motif) => (
                  <div key={motif.name} className="flex items-center gap-3">
                    <div className="w-28 text-right text-sm font-medium text-gray-700 flex-shrink-0 truncate" title={motif.name}>
                      {motif.name}
                    </div>
                    <SequenceLogo
                      matrix={motif.matrix}
                      height={80}
                      reverseComplement={inputRc}
                    />
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* 2. Multiple Alignment */}
          {results.multipleAlignment && results.multipleAlignment.length > 0 && (
            <CollapsibleSection title="Multiple Alignment">
              <MultipleAlignmentViewer alignment={results.multipleAlignment} />
            </CollapsibleSection>
          )}

          {/* 3. FBP Profile */}
          {results.fbpProfile && (
            <CollapsibleSection
              title="Familial Binding Profile (FBP)"
              titleRight={
                <RCToggle active={fbpRc} onToggle={() => setFbpRc((v) => !v)} />
              }
            >
              <div className="flex justify-center">
                <SequenceLogo
                  matrix={results.fbpProfile}
                  height={120}
                  reverseComplement={fbpRc}
                />
              </div>
            </CollapsibleSection>
          )}

          {/* 4. Similarity Matches */}
          {results.matchPairs && results.matchPairs.length > 0 && (
            <CollapsibleSection title="Similarity Matches">
              <MatchTable matchPairs={results.matchPairs} />
            </CollapsibleSection>
          )}

          {/* 5. Phylogenetic Tree */}
          {results.treeNewick && (
            <CollapsibleSection title="Phylogenetic Tree">
              <TreeViewer newick={results.treeNewick} />
            </CollapsibleSection>
          )}
        </>
      )}
    </div>
  );
}
