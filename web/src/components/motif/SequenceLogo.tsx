"use client";

import { useRef, useEffect } from "react";

interface SequenceLogoProps {
  matrix: number[][]; // Each row is [A, C, G, T]
  height?: number;
  width?: number;
}

// Nucleotide colors
const COLORS: Record<string, string> = {
  A: "#00A859",
  C: "#0057B8",
  G: "#F5B800",
  T: "#E31937",
};

const LETTERS = ["A", "C", "G", "T"] as const;

/**
 * Canvas-based sequence logo renderer.
 * Renders stacked letters scaled by information content.
 */
export function SequenceLogo({ matrix, height = 100, width }: SequenceLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const posWidth = 30;
  const canvasWidth = width || matrix.length * posWidth + 40;
  const canvasHeight = height;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    // Clear
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const yAxisWidth = 30;
    const plotWidth = canvasWidth - yAxisWidth - 5;
    const plotHeight = canvasHeight - 20;
    const effectivePosWidth = plotWidth / matrix.length;
    const maxBits = 2;

    // Draw Y axis
    ctx.fillStyle = "#666";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("2", yAxisWidth - 4, 14);
    ctx.fillText("1", yAxisWidth - 4, plotHeight / 2 + 4);
    ctx.fillText("0", yAxisWidth - 4, plotHeight + 4);

    // Axis line
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(yAxisWidth, 5);
    ctx.lineTo(yAxisWidth, plotHeight);
    ctx.lineTo(canvasWidth - 5, plotHeight);
    ctx.stroke();

    // Draw each position
    for (let pos = 0; pos < matrix.length; pos++) {
      const [a, c, g, t] = matrix[pos];
      const total = a + c + g + t;
      if (total === 0) continue;

      // Compute frequencies
      const freqs = [a / total, c / total, g / total, t / total];

      // Compute information content: IC = 2 + sum(f * log2(f))
      let entropy = 0;
      for (const f of freqs) {
        if (f > 0) {
          entropy -= f * Math.log2(f);
        }
      }
      const ic = maxBits - entropy;

      // Create letter-height pairs, sorted ascending
      const letterHeights = LETTERS.map((letter, idx) => ({
        letter,
        height: freqs[idx] * ic,
      }))
        .filter((l) => l.height > 0.01)
        .sort((a, b) => a.height - b.height);

      // Draw stacked letters bottom to top
      const x = yAxisWidth + pos * effectivePosWidth;
      let yOffset = plotHeight;

      for (const { letter, height: letterHeight } of letterHeights) {
        const h = (letterHeight / maxBits) * plotHeight;
        yOffset -= h;

        ctx.save();
        ctx.fillStyle = COLORS[letter];
        ctx.font = `bold ${Math.max(h * 0.9, 8)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        // Scale letter to fill the space
        const measured = ctx.measureText(letter);
        const scaleX = (effectivePosWidth * 0.8) / measured.width;
        const scaleY = h / (measured.actualBoundingBoxDescent + measured.actualBoundingBoxAscent || h);

        ctx.translate(x + effectivePosWidth / 2, yOffset);
        ctx.scale(scaleX, scaleY);
        ctx.fillText(letter, 0, 0);
        ctx.restore();
      }

      // Position label
      ctx.fillStyle = "#999";
      ctx.font = "8px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        String(pos + 1),
        x + effectivePosWidth / 2,
        plotHeight + 12
      );
    }
  }, [matrix, canvasWidth, canvasHeight]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: canvasWidth, height: canvasHeight }}
      className="block"
    />
  );
}
