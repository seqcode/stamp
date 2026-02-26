"use client";

import { useState, useEffect, useCallback } from "react";
import type { JobStatus } from "@/types";

interface JobStatusState {
  status: JobStatus | "not_found" | "connecting";
  error?: string;
}

export function useJobStatus(jobId: string) {
  const [state, setState] = useState<JobStatusState>({
    status: "connecting",
  });

  const connect = useCallback(() => {
    const eventSource = new EventSource(`/api/sse/${jobId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setState({
          status: data.status,
          error: data.error,
        });

        // Close on terminal states
        if (data.status === "complete" || data.status === "failed" || data.status === "not_found") {
          eventSource.close();
        }
      } catch {
        // Ignore parse errors (keepalive comments)
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      // Retry after delay unless already in terminal state
      if (state.status !== "complete" && state.status !== "failed") {
        setTimeout(connect, 5000);
      }
    };

    return eventSource;
  }, [jobId, state.status]);

  useEffect(() => {
    const eventSource = connect();
    return () => eventSource.close();
  }, [connect]);

  return state;
}
