"use client";

import { useState } from "react";
import { JASPAR_TAXON_GROUPS } from "@/types";
import type { MatchingConfig } from "@/types";

interface DatabaseSelectorProps {
  value: MatchingConfig;
  onChange: (config: MatchingConfig) => void;
}

export function DatabaseSelector({ value, onChange }: DatabaseSelectorProps) {
  const [showCustom, setShowCustom] = useState(false);

  const toggleTaxon = (taxon: string) => {
    const current = value.taxonGroups;
    const next = current.includes(taxon)
      ? current.filter((t) => t !== taxon)
      : [...current, taxon];

    onChange({
      ...value,
      enabled: next.length > 0 || !!value.customDbFileKey,
      taxonGroups: next,
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
            </select>
          </div>
        )}
      </div>

      {value.enabled && (
        <div className="space-y-3 pl-4 border-l-2 border-gray-200">
          <p className="text-xs text-gray-500">
            Select JASPAR taxon groups to match against:
          </p>
          <div className="flex flex-wrap gap-2">
            {JASPAR_TAXON_GROUPS.map((taxon) => (
              <button
                key={taxon}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  value.taxonGroups.includes(taxon)
                    ? "bg-brand-100 text-brand-700 border border-brand-300"
                    : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
                }`}
                onClick={() => toggleTaxon(taxon)}
              >
                {taxon}
              </button>
            ))}
          </div>

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
                    // For now, we'll read the file and store it with the job
                    // In production, this would upload to server first
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
