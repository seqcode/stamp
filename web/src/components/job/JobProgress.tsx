"use client";

import type { JobStatus } from "@/types";

interface JobProgressProps {
  status: JobStatus | "connecting" | "not_found";
  error?: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  connecting: { label: "Connecting...", color: "text-gray-500", icon: "..." },
  queued: { label: "Queued", color: "text-yellow-600", icon: "..." },
  running: { label: "Running STAMP Analysis", color: "text-blue-600", icon: "..." },
  processing_results: { label: "Processing Results", color: "text-blue-600", icon: "..." },
  complete: { label: "Complete", color: "text-green-600", icon: "" },
  failed: { label: "Failed", color: "text-red-600", icon: "" },
  not_found: { label: "Job Not Found", color: "text-red-600", icon: "" },
};

const STEPS = ["queued", "running", "processing_results", "complete"] as const;

export function JobProgress({ status, error }: JobProgressProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.connecting;
  const currentStepIdx = STEPS.indexOf(status as (typeof STEPS)[number]);
  const isFailed = status === "failed";

  return (
    <div className="space-y-4">
      {/* Status Badge */}
      <div className="flex items-center gap-2">
        {(status === "queued" || status === "running" || status === "processing_results" || status === "connecting") && (
          <div className="h-4 w-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        )}
        <span className={`text-lg font-semibold ${config.color}`}>
          {config.label}
        </span>
      </div>

      {/* Progress Steps */}
      {!isFailed && status !== "not_found" && (
        <div className="flex items-center gap-2">
          {STEPS.map((step, idx) => {
            const isComplete = currentStepIdx > idx;
            const isCurrent = currentStepIdx === idx;
            return (
              <div key={step} className="flex items-center gap-2 flex-1">
                <div
                  className={`h-2 flex-1 rounded-full transition-colors ${
                    isComplete
                      ? "bg-green-500"
                      : isCurrent
                        ? "bg-brand-500 animate-pulse"
                        : "bg-gray-200"
                  }`}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
