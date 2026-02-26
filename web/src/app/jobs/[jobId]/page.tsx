"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useJobStatus } from "@/hooks/useJobStatus";
import { JobProgress } from "@/components/job/JobProgress";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SequenceLogo } from "@/components/motif/SequenceLogo";
import { TreeViewer } from "@/components/results/TreeViewer";
import { MatchTable } from "@/components/results/MatchTable";
import type { JobResults, ParsedMotif } from "@/types";

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
  params: Record<string, unknown>;
  results: JobResults | null;
  error: string | null;
}

export default function JobPage() {
  const params = useParams();
  const jobId = params.jobId as string;
  const { status, error: sseError } = useJobStatus(jobId);
  const [job, setJob] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);

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
        {isComplete && (
          <Button
            variant="secondary"
            onClick={() => window.open(`/api/jobs/${jobId}/download`, "_blank")}
          >
            Download ZIP
          </Button>
        )}
      </div>

      {/* Progress */}
      <Card>
        <JobProgress status={status} error={sseError || job.error || undefined} />
      </Card>

      {/* Results */}
      {isComplete && results && (
        <>
          {/* Tree */}
          {results.treeNewick && (
            <Card>
              <CardHeader>
                <CardTitle>Phylogenetic Tree</CardTitle>
              </CardHeader>
              <TreeViewer newick={results.treeNewick} />
            </Card>
          )}

          {/* FBP Profile */}
          {results.fbpProfile && (
            <Card>
              <CardHeader>
                <CardTitle>Familial Binding Profile (FBP)</CardTitle>
              </CardHeader>
              <div className="flex justify-center">
                <SequenceLogo matrix={results.fbpProfile} height={120} />
              </div>
            </Card>
          )}

          {/* Match Results */}
          {results.matchPairs && results.matchPairs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Similarity Matches</CardTitle>
              </CardHeader>
              <MatchTable matchPairs={results.matchPairs} />
            </Card>
          )}

          {/* Raw Output */}
          {results.stampStdout && (
            <Card>
              <CardHeader>
                <CardTitle>STAMP Output</CardTitle>
              </CardHeader>
              <pre className="text-xs font-mono bg-gray-50 p-4 rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
                {results.stampStdout}
              </pre>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
