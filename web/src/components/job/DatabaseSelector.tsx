"use client";

import { useState, useEffect } from "react";
import type { MatchingConfig, DatabaseSelection } from "@/types";

interface DatabaseInfo {
  slug: string;
  name: string;
  source: string;
  version: string | null;
  motifCount: number;
  taxonGroups: string[];
  lastSyncedAt: string | null;
}

interface DatabaseSelectorProps {
  value: MatchingConfig;
  onChange: (config: MatchingConfig) => void;
}

export function DatabaseSelector({ value, onChange }: DatabaseSelectorProps) {
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(
    new Set(["jaspar"])
  );
  const [showCustom, setShowCustom] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/databases")
      .then((res) => res.json())
      .then((data) => {
        setDatabases(data.databases || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Group databases by source
  const grouped = databases.reduce<Record<string, DatabaseInfo[]>>(
    (acc, db) => {
      const key = db.source;
      if (!acc[key]) acc[key] = [];
      acc[key].push(db);
      return acc;
    },
    {}
  );

  // Source display names and order
  const sourceOrder = ["jaspar", "cisbp", "custom"];
  const sourceLabels: Record<string, string> = {
    jaspar: "JASPAR",
    cisbp: "CIS-BP",
    custom: "Custom",
  };

  const toggleSource = (source: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const getDbSelection = (slug: string): DatabaseSelection | undefined => {
    return value.databases.find((d) => d.slug === slug);
  };

  const toggleGroup = (slug: string, group: string) => {
    const existing = getDbSelection(slug);
    let newDatabases: DatabaseSelection[];

    if (existing) {
      const groups = existing.groups.includes(group)
        ? existing.groups.filter((g) => g !== group)
        : [...existing.groups, group];

      if (groups.length === 0) {
        newDatabases = value.databases.filter((d) => d.slug !== slug);
      } else {
        newDatabases = value.databases.map((d) =>
          d.slug === slug ? { ...d, groups } : d
        );
      }
    } else {
      newDatabases = [...value.databases, { slug, groups: [group] }];
    }

    onChange({
      ...value,
      databases: newDatabases,
      enabled: newDatabases.length > 0 || !!value.customDbFileKey,
    });
  };

  const selectAllGroups = (slug: string, groups: string[]) => {
    const existing = getDbSelection(slug);
    const currentGroups = existing?.groups || [];
    const allSelected = groups.every((g) => currentGroups.includes(g));

    let newDatabases: DatabaseSelection[];

    if (allSelected) {
      newDatabases = value.databases.filter((d) => d.slug !== slug);
    } else {
      if (existing) {
        newDatabases = value.databases.map((d) =>
          d.slug === slug ? { ...d, groups: [...groups] } : d
        );
      } else {
        newDatabases = [...value.databases, { slug, groups: [...groups] }];
      }
    }

    onChange({
      ...value,
      databases: newDatabases,
      enabled: newDatabases.length > 0 || !!value.customDbFileKey,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            checked={value.enabled}
            onChange={(e) =>
              onChange({ ...value, enabled: e.target.checked })
            }
          />
          Match against reference database
        </label>
        {value.enabled && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Top matches:</label>
            <select
              className="border border-gray-300 rounded px-2 py-1 text-sm"
              value={value.topMatches}
              onChange={(e) =>
                onChange({ ...value, topMatches: Number(e.target.value) })
              }
            >
              <option value={1}>1</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        )}
      </div>

      {value.enabled && (
        <div className="space-y-3 pl-4 border-l-2 border-gray-200">
          {loading ? (
            <p className="text-xs text-gray-500">Loading databases...</p>
          ) : databases.length === 0 ? (
            <p className="text-xs text-gray-500">
              No reference databases available. Please sync databases via the
              admin panel.
            </p>
          ) : (
            sourceOrder
              .filter((source) => grouped[source]?.length > 0)
              .map((source) => (
                <div
                  key={source}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <button
                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                    onClick={() => toggleSource(source)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {expandedSources.has(source) ? "\u25BC" : "\u25B6"}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {sourceLabels[source] || source}
                      </span>
                      {grouped[source].map((db) => (
                        <span
                          key={db.slug}
                          className="text-xs text-gray-500"
                        >
                          {db.version && `v${db.version}`} &middot;{" "}
                          {db.motifCount.toLocaleString()} motifs
                        </span>
                      ))}
                    </div>
                    {value.databases.some((d) =>
                      grouped[source].some((db) => db.slug === d.slug)
                    ) && (
                      <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
                        Selected
                      </span>
                    )}
                  </button>

                  {expandedSources.has(source) && (
                    <div className="px-3 py-2 space-y-2">
                      {grouped[source].map((db) => (
                        <div key={db.slug}>
                          {db.taxonGroups.length > 0 ? (
                            <>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs text-gray-500">
                                  Select groups to match against:
                                </p>
                                <button
                                  className="text-xs text-brand-600 hover:text-brand-700"
                                  onClick={() =>
                                    selectAllGroups(db.slug, db.taxonGroups)
                                  }
                                >
                                  {db.taxonGroups.every(
                                    (g) =>
                                      getDbSelection(db.slug)?.groups.includes(
                                        g
                                      )
                                  )
                                    ? "Deselect all"
                                    : "Select all"}
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {[...db.taxonGroups].sort((a, b) =>
                                  a === "vertebrates" ? -1 : b === "vertebrates" ? 1 : a.localeCompare(b)
                                ).map((group) => {
                                  const sel = getDbSelection(db.slug);
                                  const isSelected =
                                    sel?.groups.includes(group) || false;
                                  return (
                                    <button
                                      key={group}
                                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                        isSelected
                                          ? "bg-brand-100 text-brand-700 border border-brand-300"
                                          : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
                                      }`}
                                      onClick={() =>
                                        toggleGroup(db.slug, group)
                                      }
                                    >
                                      {group}
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          ) : (
                            <p className="text-xs text-gray-400">
                              No groups available yet. Sync this database first.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
          )}

          <button
            className="text-sm text-brand-600 hover:text-brand-700"
            onClick={() => setShowCustom(!showCustom)}
          >
            {showCustom ? "Hide" : "Or upload"} custom reference database
          </button>

          {showCustom && (
            <div className="border border-gray-200 rounded-lg p-3">
              <input
                type="file"
                accept=".txt,.transfac"
                className="text-sm text-gray-500 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onChange({
                      ...value,
                      customDbFileKey: file.name,
                      enabled: true,
                    });
                  }
                }}
              />
              <p className="text-xs text-gray-400 mt-1">
                Upload a motif file in TRANSFAC format as your reference
                database.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
