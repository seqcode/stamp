"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/Button";

interface ParsedPreview {
  format: string;
  count: number;
  motifs: { name: string; length: number }[];
}

interface MotifInputProps {
  onMotifTextChange: (text: string) => void;
  onParsed?: (preview: ParsedPreview | null) => void;
}

export function MotifInput({ onMotifTextChange, onParsed }: MotifInputProps) {
  const [tab, setTab] = useState<"paste" | "upload">("paste");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedPreview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseMotifs = useCallback(
    async (motifText: string) => {
      if (!motifText.trim()) {
        setPreview(null);
        setParseError(null);
        onParsed?.(null);
        return;
      }

      setParsing(true);
      setParseError(null);

      try {
        const res = await fetch("/api/motifs/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motifText }),
        });

        const data = await res.json();

        if (!res.ok) {
          setParseError(data.error || "Failed to parse motifs.");
          setPreview(null);
          onParsed?.(null);
        } else {
          setPreview(data);
          setParseError(null);
          onParsed?.(data);
        }
      } catch {
        setParseError("Failed to parse motifs. Please check your input.");
        setPreview(null);
        onParsed?.(null);
      } finally {
        setParsing(false);
      }
    },
    [onParsed]
  );

  const handleTextChange = useCallback(
    (value: string) => {
      setText(value);
      onMotifTextChange(value);
      // Debounce parse
      const timeout = setTimeout(() => parseMotifs(value), 500);
      return () => clearTimeout(timeout);
    },
    [onMotifTextChange, parseMotifs]
  );

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 10 * 1024 * 1024) {
        setParseError("File exceeds 10MB limit.");
        return;
      }

      setFileName(file.name);
      const content = await file.text();
      setText(content);
      onMotifTextChange(content);
      parseMotifs(content);
    },
    [onMotifTextChange, parseMotifs]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file) return;

      if (file.size > 10 * 1024 * 1024) {
        setParseError("File exceeds 10MB limit.");
        return;
      }

      setFileName(file.name);
      setTab("upload");
      const content = await file.text();
      setText(content);
      onMotifTextChange(content);
      parseMotifs(content);
    },
    [onMotifTextChange, parseMotifs]
  );

  const loadSample = useCallback(async () => {
    // Sample TRANSFAC motifs for demo
    const sampleText = `DE\tGABPA\t
0\t5\t1\t1\t0\tA
1\t1\t5\t1\t0\tC
2\t0\t0\t0\t7\tT
3\t0\t0\t0\t7\tT
4\t0\t7\t0\t0\tC
5\t0\t7\t0\t0\tC
6\t0\t0\t7\t0\tG
7\t0\t0\t7\t0\tG
8\t2\t0\t1\t4\tT
XX
DE\tELK4\t
0\t1\t5\t1\t0\tC
1\t0\t0\t0\t7\tT
2\t0\t0\t0\t7\tT
3\t0\t7\t0\t0\tC
4\t0\t7\t0\t0\tC
5\t0\t0\t7\t0\tG
6\t0\t0\t7\t0\tG
7\t2\t0\t1\t4\tT
XX
DE\tSPI1\t
0\t7\t0\t0\t0\tA
1\t0\t0\t7\t0\tG
2\t7\t0\t0\t0\tA
3\t0\t0\t7\t0\tG
4\t0\t0\t7\t0\tG
5\t7\t0\t0\t0\tA
6\t7\t0\t0\t0\tA
7\t0\t0\t7\t0\tG
XX`;
    setText(sampleText);
    onMotifTextChange(sampleText);
    parseMotifs(sampleText);
  }, [onMotifTextChange, parseMotifs]);

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Tab Switcher */}
      <div className="flex border-b border-gray-200 mb-4">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "paste"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setTab("paste")}
        >
          Paste Text
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "upload"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setTab("upload")}
        >
          Upload File
        </button>
      </div>

      {/* Paste Tab */}
      {tab === "paste" && (
        <div>
          <textarea
            className="w-full h-48 p-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-y"
            placeholder="Paste your motifs here (TRANSFAC, MEME, or JASPAR format)..."
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
          />
          <div className="mt-2 flex justify-end">
            <Button variant="ghost" size="sm" onClick={loadSample}>
              Load Sample Motifs
            </Button>
          </div>
        </div>
      )}

      {/* Upload Tab */}
      {tab === "upload" && (
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-brand-400 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".txt,.transfac,.meme,.jaspar,.pfm"
            onChange={handleFileUpload}
          />
          {fileName ? (
            <div>
              <p className="text-sm font-medium text-gray-900">{fileName}</p>
              <p className="text-xs text-gray-500 mt-1">
                Click to choose a different file
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-gray-400 mt-1">
                TRANSFAC, MEME, JASPAR formats (.txt, .transfac, .meme, .jaspar)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Parse Status */}
      {parsing && (
        <p className="mt-3 text-sm text-gray-500">Parsing motifs...</p>
      )}

      {parseError && (
        <p className="mt-3 text-sm text-red-600">{parseError}</p>
      )}

      {preview && !parseError && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-medium text-green-800">
            Found {preview.count} motif{preview.count !== 1 ? "s" : ""} in{" "}
            {preview.format.toUpperCase()} format
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {preview.motifs.slice(0, 20).map((m, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"
              >
                {m.name} ({m.length}bp)
              </span>
            ))}
            {preview.count > 20 && (
              <span className="text-xs text-green-600">
                +{preview.count - 20} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
