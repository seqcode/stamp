import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Job } from "@/lib/db/models/Job";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  await connectDB();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const close = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };

      const sendEvent = (data: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      // Poll for status changes
      let lastStatus = "";
      let attempts = 0;
      const maxAttempts = 360; // 30 minutes at 5s intervals

      const poll = async () => {
        if (closed) return;

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const job = await Job.findOne({ jobId: params.jobId })
            .select("status error")
            .lean() as any;

          if (!job) {
            sendEvent({ status: "not_found", error: "Job not found" });
            close();
            return;
          }

          if (job.status !== lastStatus) {
            lastStatus = job.status;
            sendEvent({
              status: job.status,
              error: job.error || undefined,
            });
          }

          // Close stream on terminal states
          if (
            job.status === "complete" ||
            job.status === "failed"
          ) {
            close();
            return;
          }

          attempts++;
          if (attempts >= maxAttempts) {
            sendEvent({ status: "timeout", error: "SSE stream timed out" });
            close();
            return;
          }

          // Continue polling
          setTimeout(poll, 2000);
        } catch {
          close();
        }
      };

      // Send initial keepalive
      controller.enqueue(encoder.encode(": keepalive\n\n"));
      poll();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
