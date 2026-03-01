"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MotifInput } from "@/components/motif/MotifInput";
import { ParameterForm } from "@/components/job/ParameterForm";
import { DatabaseSelector } from "@/components/job/DatabaseSelector";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import type { StampParams, MatchingConfig } from "@/types";
import { DEFAULT_PARAMS } from "@/types";

export default function HomePage() {
  const router = useRouter();
  const [motifText, setMotifText] = useState("");
  const [params, setParams] = useState<StampParams>({ ...DEFAULT_PARAMS });
  const [matching, setMatching] = useState<MatchingConfig>({
    enabled: true,
    databases: [{ slug: "jaspar-core", groups: ["vertebrates"] }],
    topMatches: 5,
    customDbFileKey: null,
  });
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [motifCount, setMotifCount] = useState(0);

  const handleSubmit = async () => {
    if (!motifText.trim()) {
      setError("Please provide motif data.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motifText,
          params,
          matching,
          email: email || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to submit job.");
        return;
      }

      // Navigate to results page
      router.push(`/jobs/${data.jobId}`);
    } catch {
      setError("Failed to submit job. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">STAMP</h1>
        <p className="mt-2 text-gray-600">
          Similarity, Tree-building, &amp; Alignment of Motifs and Profiles.
          Upload your transcription factor binding motifs to compare, align, and
          match against reference databases.
        </p>
      </div>

      <div className="space-y-6">
        {/* Motif Input */}
        <Card>
          <CardHeader>
            <CardTitle>1. Input Motifs</CardTitle>
          </CardHeader>
          <MotifInput
            onMotifTextChange={setMotifText}
            onParsed={(preview) => setMotifCount(preview?.count || 0)}
          />
        </Card>

        {/* Parameters */}
        <Card>
          <CardHeader>
            <CardTitle>2. Analysis Parameters</CardTitle>
          </CardHeader>
          <ParameterForm value={params} onChange={setParams} />
        </Card>

        {/* Database Matching */}
        <Card>
          <CardHeader>
            <CardTitle>3. Database Matching</CardTitle>
          </CardHeader>
          <DatabaseSelector value={matching} onChange={setMatching} />
        </Card>

        {/* Email Notification */}
        <Card>
          <CardHeader>
            <CardTitle>4. Notification (Optional)</CardTitle>
          </CardHeader>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Email address for completion notification:
            </label>
            <input
              type="email"
              className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </Card>

        {/* Submit */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {motifCount > 0
              ? `${motifCount} motif${motifCount !== 1 ? "s" : ""} ready for analysis`
              : "No motifs loaded"}
          </p>
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={submitting || motifCount === 0}
          >
            {submitting ? "Submitting..." : "Run STAMP Analysis"}
          </Button>
        </div>
      </div>
    </div>
  );
}
