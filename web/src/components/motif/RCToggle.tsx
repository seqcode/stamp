"use client";

interface RCToggleProps {
  active: boolean;
  onToggle: () => void;
}

/**
 * A small reverse complement toggle button with opposing arrows icon.
 */
export function RCToggle({ active, onToggle }: RCToggleProps) {
  return (
    <button
      onClick={onToggle}
      title={active ? "Showing reverse complement" : "Show reverse complement"}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
        active
          ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      }`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Two opposing arrows */}
        <path d="M1 5h10M8 2l3 3-3 3" />
        <path d="M13 9H3M6 12L3 9l3-3" />
      </svg>
      RC
    </button>
  );
}
