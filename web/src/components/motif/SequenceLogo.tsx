"use client";

import { useRef, useEffect } from "react";

interface SequenceLogoProps {
  matrix: number[][]; // Each row is [A, C, G, T]
  height?: number;
  width?: number;
  showAxes?: boolean;
  reverseComplement?: boolean;
  /** Optional [startCol, endCol] inclusive range (0-based into display matrix)
   *  to highlight. Positions outside this range render at reduced opacity. */
  highlightRange?: [number, number];
}

// MEME-suite color scheme
const COLORS: Record<string, string> = {
  A: "#CC0000", // red
  C: "#0000CC", // blue
  G: "#FFB300", // orange
  T: "#008000", // green
};

const LETTERS = ["A", "C", "G", "T"] as const;

/**
 * Reverse complement a PFM matrix.
 * Reverse column order and swap A↔T, C↔G.
 */
function reverseComplementMatrix(matrix: number[][]): number[][] {
  return [...matrix].reverse().map(([a, c, g, t]) => [t, g, c, a]);
}

function rasterizeLetter(
  letter: string,
  color: string,
  fontSize: number
): { canvas: HTMLCanvasElement; top: number; height: number } {
  const pad = 20;
  const canvas = document.createElement("canvas");
  canvas.width = fontSize + 2 * pad;
  canvas.height = fontSize + 2 * pad;
  const ctx = canvas.getContext("2d")!;
  const cx = Math.round(canvas.width / 2);
  const baseline = Math.round(canvas.height - pad);
  ctx.font = `bold ${fontSize}px Helvetica, Arial, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText(letter, cx, baseline);

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let topLine = -1;
  let bottomLine = -1;
  for (let r = 0; r < canvas.height; r++) {
    for (let c = 0; c < canvas.width; c++) {
      if (data[(r * canvas.width + c) * 4 + 3] > 0) {
        if (topLine === -1) topLine = r;
        bottomLine = r;
      }
    }
  }
  const h = topLine >= 0 ? bottomLine - topLine + 1 : 0;
  return { canvas, top: topLine, height: h };
}

const letterCache = new Map<
  string,
  { canvas: HTMLCanvasElement; top: number; height: number }
>();

function getCachedLetter(letter: string, color: string, fontSize: number) {
  const key = `${letter}-${fontSize}`;
  if (!letterCache.has(key)) {
    letterCache.set(key, rasterizeLetter(letter, color, fontSize));
  }
  return letterCache.get(key)!;
}

/**
 * Canvas-based sequence logo renderer.
 *
 * Layout is always computed as if axes are shown so toggling axes only
 * hides/shows the axis elements without changing motif rendering.
 */
export function SequenceLogo({
  matrix,
  height = 90,
  width,
  showAxes = true,
  reverseComplement = false,
  highlightRange,
}: SequenceLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const displayMatrix = reverseComplement
    ? reverseComplementMatrix(matrix)
    : matrix;

  const effectiveHighlight = highlightRange && reverseComplement
    ? [displayMatrix.length - 1 - highlightRange[1], displayMatrix.length - 1 - highlightRange[0]] as [number, number]
    : highlightRange;

  const maxBits = 2;

  const defaultStackW = 28;

  // Always compute layout as if axes are visible so toggling axes
  // doesn't change the motif rendering at all.
  const stackHeight = Math.max(height - 30, 50);
  const yLabelH = 12;
  const yLabelSpacer = 3;
  const yNumW = 14;
  const yTicW = 5;
  const yAxisTotal = yLabelH + yLabelSpacer + yNumW + yTicW;
  const xNumH = 14;
  const xNumAbove = 2;
  const topPad = 8;

  const canvasWidth =
    width || yAxisTotal + displayMatrix.length * defaultStackW + 8;
  const canvasHeight = topPad + stackHeight + xNumAbove + xNumH + 2;

  const effectiveStackW = width
    ? (width - yAxisTotal - 8) / displayMatrix.length
    : defaultStackW;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // ---- Draw Y-axis (only if showAxes) ----
    if (showAxes) {
      ctx.save();
      ctx.translate(0, topPad);

      ctx.save();
      ctx.font = `bold ${yLabelH}px Helvetica, Arial, sans-serif`;
      ctx.fillStyle = "#333";
      ctx.translate(yLabelH, stackHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center";
      ctx.fillText("bits", 0, 0);
      ctx.restore();

      ctx.save();
      ctx.translate(yLabelH + yLabelSpacer + yNumW, 0);
      ctx.font = "bold 11px Helvetica, Arial, sans-serif";
      ctx.fillStyle = "#333";
      ctx.textAlign = "right";

      const ticH = stackHeight / maxBits;
      for (let i = 0; i <= maxBits; i++) {
        const y = stackHeight - i * ticH;
        ctx.fillText(`${i}`, -2, y + 4);
        ctx.fillRect(0, y - 0.75, yTicW, 1.5);
      }

      ctx.fillRect(yTicW - 1.5, 0, 1.5, stackHeight);
      ctx.restore();

      ctx.fillStyle = "#333";
      ctx.fillRect(
        yAxisTotal - 1.5,
        stackHeight - 0.75,
        canvasWidth - yAxisTotal,
        1.5
      );

      ctx.restore();
    }

    // ---- Detect internal vs edge gaps ----
    let firstNonZero = -1;
    let lastNonZero = -1;
    for (let pos = 0; pos < displayMatrix.length; pos++) {
      const [a, c, g, t] = displayMatrix[pos];
      if (a + c + g + t > 0) {
        if (firstNonZero === -1) firstNonZero = pos;
        lastNonZero = pos;
      }
    }

    // ---- Draw letter stacks ----
    const rasterFontSize = 60;
    let positionLabel = 0;
    for (let pos = 0; pos < displayMatrix.length; pos++) {
      const [a, c, g, t] = displayMatrix[pos];
      const total = a + c + g + t;
      const xBase = yAxisTotal + pos * effectiveStackW;

      const isFaded = effectiveHighlight != null &&
        (pos < effectiveHighlight[0] || pos > effectiveHighlight[1]);

      if (total === 0) {
        if (firstNonZero !== -1 && pos > firstNonZero && pos < lastNonZero) {
          ctx.globalAlpha = isFaded ? 0.25 : 1.0;
          ctx.fillStyle = "#E5E7EB";
          ctx.fillRect(
            xBase + 1,
            topPad,
            effectiveStackW - 2,
            stackHeight
          );
          ctx.globalAlpha = 1.0;
        }
        continue;
      }

      positionLabel++;

      if (isFaded) {
        ctx.globalAlpha = 0.25;
      }

      const freqs = [a / total, c / total, g / total, t / total];

      let entropy = 0;
      for (const f of freqs) {
        if (f > 0) entropy -= f * Math.log2(f);
      }
      const ic = maxBits - entropy;

      const letterHeights = LETTERS.map((letter, idx) => ({
        letter,
        h: freqs[idx] * ic,
      }))
        .filter((l) => l.h > 0.01)
        .sort((a, b) => a.h - b.h);

      let yBottom = topPad + stackHeight;

      for (const { letter, h: letterBits } of letterHeights) {
        const drawH = (letterBits / maxBits) * stackHeight;
        if (drawH < 1) {
          yBottom -= drawH;
          continue;
        }

        const cached = getCachedLetter(letter, COLORS[letter], rasterFontSize);
        if (cached.height > 0) {
          ctx.drawImage(
            cached.canvas,
            0,
            cached.top - 1,
            cached.canvas.width,
            cached.height + 1,
            xBase,
            yBottom - drawH,
            effectiveStackW,
            drawH
          );
        }
        yBottom -= drawH;
      }

      if (isFaded) {
        ctx.globalAlpha = 1.0;
      }

      // Position numbers on x-axis (only if showAxes)
      if (showAxes) {
        ctx.save();
        ctx.translate(
          xBase + effectiveStackW / 2,
          topPad + stackHeight + xNumAbove
        );
        ctx.font = "bold 10px Helvetica, Arial, sans-serif";
        ctx.fillStyle = "#333";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`${positionLabel}`, 0, 0);
        ctx.restore();
      }
    }
  }, [displayMatrix, canvasWidth, canvasHeight, showAxes, stackHeight, effectiveStackW, topPad, xNumAbove, xNumH, yAxisTotal, yLabelH, yLabelSpacer, yNumW, yTicW, effectiveHighlight]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: canvasWidth, height: canvasHeight }}
      className="block"
    />
  );
}
