"use client";

import { useState, useEffect, useMemo } from "react";
import type { MatchingConfig, DatabaseSelection } from "@/types";

interface DatabaseInfo {
  slug: string;
  name: string;
  source: string;
  version: string | null;
  motifCount: number;
  taxonGroups: string[];
  groupCounts: Record<string, number>;
  lastSyncedAt: string | null;
}

interface DatabaseSelectorProps {
  value: MatchingConfig;
  onChange: (config: MatchingConfig) => void;
}

const INITIAL_VISIBLE = 20;

export function DatabaseSelector({ value, onChange }: DatabaseSelectorProps) {
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(
    new Set(["jaspar"])
  );
  const [showCustom, setShowCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  // Per-source: whether the "show more" has been toggled
  const [showAllGroups, setShowAllGroups] = useState<Set<string>>(new Set());
  // Per-source: search filter text
  const [groupSearch, setGroupSearch] = useState<Record<string, string>>({});

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
  const sourceOrder = ["jaspar", "hocomoco", "cisbp", "custom"];
  const sourceLabels: Record<string, string> = {
    jaspar: "JASPAR",
    hocomoco: "HOCOMOCO",
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

  const toggleShowAll = (source: string) => {
    setShowAllGroups((prev) => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
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
                <SourceBlock
                  key={source}
                  source={source}
                  label={sourceLabels[source] || source}
                  databases={grouped[source]}
                  expanded={expandedSources.has(source)}
                  onToggle={() => toggleSource(source)}
                  showAll={showAllGroups.has(source)}
                  onToggleShowAll={() => toggleShowAll(source)}
                  searchText={groupSearch[source] || ""}
                  onSearchChange={(text) =>
                    setGroupSearch((prev) => ({ ...prev, [source]: text }))
                  }
                  selectedDatabases={value.databases}
                  getDbSelection={getDbSelection}
                  toggleGroup={toggleGroup}
                  selectAllGroups={selectAllGroups}
                />
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

// ── SourceBlock: collapsible block for one database source ────────────────────

interface SourceBlockProps {
  source: string;
  label: string;
  databases: DatabaseInfo[];
  expanded: boolean;
  onToggle: () => void;
  showAll: boolean;
  onToggleShowAll: () => void;
  searchText: string;
  onSearchChange: (text: string) => void;
  selectedDatabases: DatabaseSelection[];
  getDbSelection: (slug: string) => DatabaseSelection | undefined;
  toggleGroup: (slug: string, group: string) => void;
  selectAllGroups: (slug: string, groups: string[]) => void;
}

function SourceBlock({
  source,
  label,
  databases,
  expanded,
  onToggle,
  showAll,
  onToggleShowAll,
  searchText,
  onSearchChange,
  selectedDatabases,
  getDbSelection,
  toggleGroup,
  selectAllGroups,
}: SourceBlockProps) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {expanded ? "\u25BC" : "\u25B6"}
          </span>
          <span className="text-sm font-medium text-gray-900">{label}</span>
          {databases.length === 1 ? (
            <span className="text-xs text-gray-500">
              {databases[0].version && `v${databases[0].version}`} &middot;{" "}
              {databases[0].motifCount.toLocaleString()} motifs
            </span>
          ) : (
            <span className="text-xs text-gray-500">
              {databases.reduce((sum, db) => sum + db.motifCount, 0).toLocaleString()} motifs
              {" "}across {databases.length} collections
            </span>
          )}
        </div>
        {selectedDatabases.some((d) =>
          databases.some((db) => db.slug === d.slug)
        ) && (
          <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
            Selected
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-3 py-2 space-y-2">
          {databases.map((db) => (
            <GroupPicker
              key={db.slug}
              db={db}
              source={source}
              showDbLabel={databases.length > 1}
              showAll={showAll}
              onToggleShowAll={onToggleShowAll}
              searchText={searchText}
              onSearchChange={onSearchChange}
              getDbSelection={getDbSelection}
              toggleGroup={toggleGroup}
              selectAllGroups={selectAllGroups}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── GroupPicker: pills for one database's groups ──────────────────────────────

interface GroupPickerProps {
  db: DatabaseInfo;
  source: string;
  showDbLabel: boolean;
  showAll: boolean;
  onToggleShowAll: () => void;
  searchText: string;
  onSearchChange: (text: string) => void;
  getDbSelection: (slug: string) => DatabaseSelection | undefined;
  toggleGroup: (slug: string, group: string) => void;
  selectAllGroups: (slug: string, groups: string[]) => void;
}

function GroupPicker({
  db,
  source,
  showDbLabel,
  showAll,
  onToggleShowAll,
  searchText,
  onSearchChange,
  getDbSelection,
  toggleGroup,
  selectAllGroups,
}: GroupPickerProps) {
  // Sort groups by motif count (descending), with "vertebrates" always first
  const sortedGroups = useMemo(() => {
    return [...db.taxonGroups].sort((a, b) => {
      if (a === "vertebrates") return -1;
      if (b === "vertebrates") return 1;
      const countA = db.groupCounts[a] || 0;
      const countB = db.groupCounts[b] || 0;
      if (countB !== countA) return countB - countA;
      return a.localeCompare(b);
    });
  }, [db.taxonGroups, db.groupCounts]);

  // Apply search filter
  const filteredGroups = useMemo(() => {
    if (!searchText.trim()) return sortedGroups;
    const q = searchText.toLowerCase();
    return sortedGroups.filter((g) => g.toLowerCase().includes(q));
  }, [sortedGroups, searchText]);

  const totalGroups = filteredGroups.length;
  const hasMany = totalGroups > INITIAL_VISIBLE;
  const visibleGroups =
    showAll || !hasMany ? filteredGroups : filteredGroups.slice(0, INITIAL_VISIBLE);
  const hiddenCount = totalGroups - visibleGroups.length;

  if (db.taxonGroups.length === 0) {
    return (
      <p className="text-xs text-gray-400">
        No groups available yet. Sync this database first.
      </p>
    );
  }

  const sel = getDbSelection(db.slug);
  const allFilteredSelected = filteredGroups.every(
    (g) => sel?.groups.includes(g)
  );

  return (
    <div>
      {showDbLabel && (
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-gray-700">{db.name}</span>
          <span className="text-xs text-gray-400">
            {db.motifCount.toLocaleString()} motifs
          </span>
        </div>
      )}
      <div className="flex items-center justify-between mb-1 gap-2">
        <p className="text-xs text-gray-500 flex-shrink-0">
          Select groups to match against:
        </p>
        <div className="flex items-center gap-2">
          {/* Search input for databases with many groups */}
          {db.taxonGroups.length > INITIAL_VISIBLE && (
            <input
              type="text"
              placeholder="Search groups..."
              value={searchText}
              onChange={(e) => onSearchChange(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1 w-36 focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400"
            />
          )}
          <button
            className="text-xs text-brand-600 hover:text-brand-700 flex-shrink-0"
            onClick={() =>
              selectAllGroups(db.slug, filteredGroups)
            }
          >
            {allFilteredSelected ? "Deselect all" : "Select all"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleGroups.map((group) => {
          const isSelected = sel?.groups.includes(group) || false;
          const count = db.groupCounts[group];
          return (
            <button
              key={group}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                isSelected
                  ? "bg-brand-100 text-brand-700 border border-brand-300"
                  : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
              }`}
              onClick={() => toggleGroup(db.slug, group)}
              title={count != null ? `${count.toLocaleString()} motifs` : undefined}
            >
              {group}
              {count != null && (
                <span className="ml-1 opacity-60">
                  ({count.toLocaleString()})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Show more / show less toggle */}
      {hasMany && (
        <button
          className="text-xs text-brand-600 hover:text-brand-700 mt-2"
          onClick={onToggleShowAll}
        >
          {showAll
            ? "Show fewer"
            : `Show ${hiddenCount} more group${hiddenCount !== 1 ? "s" : ""}...`}
        </button>
      )}
    </div>
  );
}
