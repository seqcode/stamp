"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { JASPAR_TAXON_GROUPS } from "@/types";

interface JobStats {
  total: number;
  queued: number;
  running: number;
  complete: number;
  failed: number;
}

interface DatabaseInfo {
  _id: string;
  name: string;
  slug: string;
  source: string;
  motifCount: number;
  taxonGroups: string[];
  lastSyncedAt: string | null;
  isActive: boolean;
}

export default function AdminPage() {
  const [stats, setStats] = useState<JobStats | null>(null);
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [selectedTaxons, setSelectedTaxons] = useState<string[]>([]);
  const [cleanupDays, setCleanupDays] = useState(7);

  const fetchData = useCallback(async () => {
    const [jobsRes, dbsRes] = await Promise.all([
      fetch("/api/admin/jobs"),
      fetch("/api/admin/databases"),
    ]);
    if (jobsRes.ok) {
      const data = await jobsRes.json();
      setStats(data.stats);
    }
    if (dbsRes.ok) {
      const data = await dbsRes.json();
      setDatabases(data.databases);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/databases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync",
          collection: "CORE",
          taxonGroups: selectedTaxons.length > 0 ? selectedTaxons : undefined,
          fullSync: false,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(
          `Sync complete: ${data.result.totalStored} motifs stored, ${data.result.errors.length} errors`
        );
        fetchData();
      } else {
        setSyncResult(`Sync failed: ${data.error}`);
      }
    } catch (err) {
      setSyncResult(`Sync failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleCleanup = async () => {
    if (!confirm(`Delete all jobs older than ${cleanupDays} days?`)) return;
    try {
      const res = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cleanup", olderThanDays: cleanupDays }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Deleted ${data.deleted} jobs`);
        fetchData();
      }
    } catch {
      alert("Cleanup failed");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>

      {/* Job Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Job Statistics</CardTitle>
        </CardHeader>
        {stats && (
          <div className="grid grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{stats.queued}</p>
              <p className="text-xs text-gray-500">Queued</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats.running}</p>
              <p className="text-xs text-gray-500">Running</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.complete}</p>
              <p className="text-xs text-gray-500">Complete</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
              <p className="text-xs text-gray-500">Failed</p>
            </div>
          </div>
        )}
        <div className="mt-4 flex items-center gap-3">
          <label className="text-sm text-gray-600">Cleanup jobs older than</label>
          <input
            type="number"
            className="w-16 border border-gray-300 rounded px-2 py-1 text-sm"
            value={cleanupDays}
            onChange={(e) => setCleanupDays(Number(e.target.value))}
          />
          <label className="text-sm text-gray-600">days</label>
          <Button variant="secondary" size="sm" onClick={handleCleanup}>
            Run Cleanup
          </Button>
        </div>
      </Card>

      {/* Reference Databases */}
      <Card>
        <CardHeader>
          <CardTitle>Reference Databases</CardTitle>
        </CardHeader>

        {databases.length > 0 ? (
          <div className="space-y-3 mb-6">
            {databases.map((db) => (
              <div
                key={db._id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
              >
                <div>
                  <p className="font-medium text-sm text-gray-900">{db.name}</p>
                  <p className="text-xs text-gray-500">
                    {db.motifCount} motifs
                    {db.taxonGroups.length > 0 &&
                      ` \u00B7 ${db.taxonGroups.join(", ")}`}
                    {db.lastSyncedAt &&
                      ` \u00B7 Last synced: ${new Date(db.lastSyncedAt).toLocaleDateString()}`}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    db.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {db.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-6">
            No reference databases configured. Sync JASPAR to get started.
          </p>
        )}

        {/* Sync Controls */}
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Sync JASPAR Database
          </h4>
          <p className="text-xs text-gray-500 mb-3">
            Select taxon groups to sync (leave empty to sync all CORE matrices):
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {JASPAR_TAXON_GROUPS.map((taxon) => (
              <button
                key={taxon}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedTaxons.includes(taxon)
                    ? "bg-brand-100 text-brand-700 border border-brand-300"
                    : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
                }`}
                onClick={() =>
                  setSelectedTaxons((prev) =>
                    prev.includes(taxon)
                      ? prev.filter((t) => t !== taxon)
                      : [...prev, taxon]
                  )
                }
              >
                {taxon}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSync} disabled={syncing}>
              {syncing ? "Syncing..." : "Start Sync"}
            </Button>
            {syncResult && (
              <p className="text-sm text-gray-600">{syncResult}</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
