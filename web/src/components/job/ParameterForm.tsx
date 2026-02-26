"use client";

import { useState } from "react";
import type { StampParams } from "@/types";
import { DEFAULT_PARAMS } from "@/types";

interface ParameterFormProps {
  value: StampParams;
  onChange: (params: StampParams) => void;
}

export function ParameterForm({ value, onChange }: ParameterFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const update = (patch: Partial<StampParams>) => {
    onChange({ ...value, ...patch });
  };

  return (
    <div className="space-y-4">
      {/* Basic Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Column Comparison Metric
          </label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            value={value.columnMetric}
            onChange={(e) => update({ columnMetric: e.target.value as StampParams["columnMetric"] })}
          >
            <option value="PCC">PCC - Pearson Correlation Coefficient</option>
            <option value="ALLR">ALLR - Average Log-Likelihood Ratio</option>
            <option value="ALLR_LL">ALLR_LL - ALLR with lower limit</option>
            <option value="CS">CS - Chi-Squared</option>
            <option value="KL">KL - Kullback-Leibler</option>
            <option value="SSD">SSD - Sum of Squared Distances</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Alignment Method
          </label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            value={value.alignmentMethod}
            onChange={(e) => update({ alignmentMethod: e.target.value as StampParams["alignmentMethod"] })}
          >
            <option value="SWU">SWU - Smith-Waterman Ungapped</option>
            <option value="SWA">SWA - Smith-Waterman Affine</option>
            <option value="SW">SW - Smith-Waterman Linear</option>
            <option value="NW">NW - Needleman-Wunsch</option>
          </select>
        </div>
      </div>

      {/* Advanced Toggle */}
      <button
        className="text-sm text-brand-600 hover:text-brand-700 font-medium"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? "Hide" : "Show"} Advanced Options
      </button>

      {/* Advanced Options */}
      {showAdvanced && (
        <div className="space-y-4 pl-4 border-l-2 border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Multiple Alignment
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                value={value.multipleAlignment}
                onChange={(e) => update({ multipleAlignment: e.target.value as StampParams["multipleAlignment"] })}
              >
                <option value="PPA">PPA - Progressive Profile Alignment</option>
                <option value="IR">IR - Iterative Refinement</option>
                <option value="NONE">None</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tree Building
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                value={value.treeMethod}
                onChange={(e) => update({ treeMethod: e.target.value as StampParams["treeMethod"] })}
              >
                <option value="UPGMA">UPGMA</option>
                <option value="SOTA">SOTA - Self-Organizing Tree</option>
                <option value="NJ">NJ - Neighbour-joining</option>
              </select>
            </div>
          </div>

          {/* Gap penalties - only shown for gapped alignment methods */}
          {value.alignmentMethod !== "SWU" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gap Open Penalty
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="1000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  value={value.gapOpen}
                  onChange={(e) => update({ gapOpen: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gap Extend Penalty
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max="1000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  value={value.gapExtend}
                  onChange={(e) => update({ gapExtend: Number(e.target.value) })}
                />
              </div>
            </div>
          )}

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                checked={value.overlapAlign}
                onChange={(e) => update({ overlapAlign: e.target.checked })}
              />
              Overlapping alignments only
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                checked={value.forwardOnly}
                onChange={(e) => update({ forwardOnly: e.target.checked })}
              />
              Forward direction only
            </label>
          </div>

          <button
            className="text-xs text-gray-500 hover:text-gray-700"
            onClick={() => onChange({ ...DEFAULT_PARAMS })}
          >
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}
