"use client";

interface AlignmentViewerProps {
  motifNames: string[];
  alignedMotifs: number[][][]; // Array of aligned PFMs
}

const BASE_COLORS: Record<string, string> = {
  A: "bg-green-100 text-green-800",
  C: "bg-blue-100 text-blue-800",
  G: "bg-yellow-100 text-yellow-800",
  T: "bg-red-100 text-red-800",
  "-": "bg-gray-50 text-gray-400",
};

function getConsensus(row: number[]): string {
  if (!row || row.length < 4) return "-";
  const [a, c, g, t] = row;
  const total = a + c + g + t;
  if (total === 0) return "-";

  const maxVal = Math.max(a, c, g, t);
  if (maxVal / total >= 0.5) {
    if (a === maxVal) return "A";
    if (c === maxVal) return "C";
    if (g === maxVal) return "G";
    return "T";
  }
  return "N";
}

export function AlignmentViewer({ motifNames, alignedMotifs }: AlignmentViewerProps) {
  if (!alignedMotifs || alignedMotifs.length === 0) {
    return <p className="text-sm text-gray-500">No alignment data available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs font-mono">
        <tbody>
          {alignedMotifs.map((motif, idx) => (
            <tr key={idx}>
              <td className="pr-3 py-0.5 text-right text-gray-600 whitespace-nowrap">
                {motifNames[idx] || `Motif ${idx + 1}`}
              </td>
              {motif.map((pos, posIdx) => {
                const base = getConsensus(pos);
                const colorClass = BASE_COLORS[base] || BASE_COLORS["-"];
                return (
                  <td
                    key={posIdx}
                    className={`px-1 py-0.5 text-center ${colorClass}`}
                  >
                    {base}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
