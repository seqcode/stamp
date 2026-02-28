"use client";

interface LogoToolbarProps {
  rc: boolean;
  onToggleRc: () => void;
  showAxes: boolean;
  onToggleAxes: () => void;
  onDownloadPng: () => void;
  onDownloadSvg: () => void;
}

/**
 * Toolbar with RC toggle, axes toggle, and PNG/SVG download buttons.
 * Used alongside every group of motif logos.
 */
export function LogoToolbar({
  rc,
  onToggleRc,
  showAxes,
  onToggleAxes,
  onDownloadPng,
  onDownloadSvg,
}: LogoToolbarProps) {
  const btnBase =
    "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors";
  const activeClass = "bg-blue-100 text-blue-700 hover:bg-blue-200";
  const inactiveClass = "bg-gray-100 text-gray-500 hover:bg-gray-200";

  return (
    <div className="flex items-center gap-1">
      {/* RC toggle */}
      <button
        onClick={onToggleRc}
        title={rc ? "Showing reverse complement" : "Show reverse complement"}
        className={`${btnBase} ${rc ? activeClass : inactiveClass}`}
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
          <path d="M1 5h10M8 2l3 3-3 3" />
          <path d="M13 9H3M6 12L3 9l3-3" />
        </svg>
        RC
      </button>

      {/* Axes toggle */}
      <button
        onClick={onToggleAxes}
        title={showAxes ? "Hide axes" : "Show axes"}
        className={`${btnBase} ${showAxes ? activeClass : inactiveClass}`}
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
          {/* Simple axes icon */}
          <path d="M2 2v10h10" />
          <path d="M2 8l3-3 2 2 4-4" />
        </svg>
        Axes
      </button>

      {/* PNG download */}
      <button
        onClick={onDownloadPng}
        title="Download as PNG"
        className={`${btnBase} ${inactiveClass}`}
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
          <path d="M7 2v7M4 7l3 3 3-3" />
          <path d="M2 10v2h10v-2" />
        </svg>
        PNG
      </button>

      {/* SVG download */}
      <button
        onClick={onDownloadSvg}
        title="Download as SVG"
        className={`${btnBase} ${inactiveClass}`}
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
          <path d="M7 2v7M4 7l3 3 3-3" />
          <path d="M2 10v2h10v-2" />
        </svg>
        SVG
      </button>
    </div>
  );
}
