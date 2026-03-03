/**
 * Shared logo rendering utilities for offscreen canvas rendering and export.
 * Extracts the core rendering logic from SequenceLogo so it can be reused
 * for PNG/SVG export without duplicating code.
 */

// MEME-suite color scheme
const COLORS: Record<string, string> = {
  A: "#CC0000",
  C: "#0000CC",
  G: "#FFB300",
  T: "#008000",
};

const LETTERS = ["A", "C", "G", "T"] as const;

/**
 * Rasterize a single letter at a given font size. Returns the offscreen
 * canvas and pixel-exact vertical bounds.
 */
function rasterizeLetter(
  letter: string,
  color: string,
  fontSize: number,
): { canvas: HTMLCanvasElement; top: number; height: number } {
  const pad = 5;
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

const letterCache = new Map<string, { canvas: HTMLCanvasElement; top: number; height: number }>();

function getCachedLetter(letter: string, color: string, fontSize: number) {
  const key = `${letter}-${fontSize}`;
  if (!letterCache.has(key)) {
    letterCache.set(key, rasterizeLetter(letter, color, fontSize));
  }
  return letterCache.get(key)!;
}

/**
 * Reverse complement a PFM matrix.
 */
export function reverseComplementMatrix(matrix: number[][]): number[][] {
  return [...matrix].reverse().map(([a, c, g, t]) => [t, g, c, a]);
}

export interface RenderLogoOptions {
  height?: number;
  width?: number;
  showAxes?: boolean;
  reverseComplement?: boolean;
  highlightRange?: [number, number];
  /** Scale factor (default 2 for high-DPI) */
  scale?: number;
}

/**
 * Render a sequence logo to an offscreen canvas and return it.
 * This mirrors the SequenceLogo component rendering logic.
 */
export function renderLogoToCanvas(
  matrix: number[][],
  options: RenderLogoOptions = {},
): HTMLCanvasElement {
  const {
    height = 90,
    width,
    showAxes = true,
    reverseComplement = false,
    highlightRange,
    scale = 2,
  } = options;

  const displayMatrix = reverseComplement
    ? reverseComplementMatrix(matrix)
    : matrix;

  const effectiveHighlight =
    highlightRange && reverseComplement
      ? ([
          displayMatrix.length - 1 - highlightRange[1],
          displayMatrix.length - 1 - highlightRange[0],
        ] as [number, number])
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

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth * scale;
  canvas.height = canvasHeight * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // White background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Draw Y-axis
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
    ctx.fillRect(yAxisTotal - 1.5, stackHeight - 0.75, canvasWidth - yAxisTotal, 1.5);

    ctx.restore();
  }

  // Detect internal vs edge gaps
  let firstNonZero = -1;
  let lastNonZero = -1;
  for (let pos = 0; pos < displayMatrix.length; pos++) {
    const [a, c, g, t] = displayMatrix[pos];
    if (a + c + g + t > 0) {
      if (firstNonZero === -1) firstNonZero = pos;
      lastNonZero = pos;
    }
  }

  // Draw letter stacks
  const rasterFontSize = 60;
  let positionLabel = 0;
  for (let pos = 0; pos < displayMatrix.length; pos++) {
    const [a, c, g, t] = displayMatrix[pos];
    const total = a + c + g + t;
    const xBase = yAxisTotal + pos * effectiveStackW;

    const isFaded =
      effectiveHighlight != null &&
      (pos < effectiveHighlight[0] || pos > effectiveHighlight[1]);

    if (total === 0) {
      if (firstNonZero !== -1 && pos > firstNonZero && pos < lastNonZero) {
        ctx.globalAlpha = isFaded ? 0.25 : 1.0;
        ctx.fillStyle = "#E5E7EB";
        ctx.fillRect(xBase + 1, topPad, effectiveStackW - 2, stackHeight);
        ctx.globalAlpha = 1.0;
      }
      continue;
    }

    positionLabel++;

    if (isFaded) ctx.globalAlpha = 0.25;

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
          drawH,
        );
      }
      yBottom -= drawH;
    }

    if (isFaded) ctx.globalAlpha = 1.0;

    if (showAxes) {
      ctx.save();
      ctx.translate(xBase + effectiveStackW / 2, topPad + stackHeight + xNumAbove);
      ctx.font = "bold 10px Helvetica, Arial, sans-serif";
      ctx.fillStyle = "#333";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(`${positionLabel}`, 0, 0);
      ctx.restore();
    }
  }

  // Store logical size for export
  (canvas as any)._logicalWidth = canvasWidth;
  (canvas as any)._logicalHeight = canvasHeight;

  return canvas;
}

export interface LogoSpec {
  label?: string;
  matrix: number[][];
  reverseComplement?: boolean;
  highlightRange?: [number, number];
  showAxes?: boolean;
  height?: number;
  width?: number;
}

/**
 * Export multiple logos as a single PNG image.
 */
export function exportLogosAsPng(
  logos: LogoSpec[],
  filename = "motif-logos.png",
): void {
  if (logos.length === 0) return;

  const scale = 2;
  const labelWidth = 160;
  const gap = 4;

  // Render all logos
  const rendered = logos.map((spec) =>
    renderLogoToCanvas(spec.matrix, {
      height: spec.height || 90,
      width: spec.width,
      showAxes: spec.showAxes ?? true,
      reverseComplement: spec.reverseComplement,
      highlightRange: spec.highlightRange,
      scale,
    }),
  );

  // Compute composite dimensions
  const maxLogoW = Math.max(...rendered.map((c) => (c as any)._logicalWidth || c.width / scale));
  const totalH =
    rendered.reduce((sum, c) => sum + ((c as any)._logicalHeight || c.height / scale), 0) +
    gap * (rendered.length - 1);

  const hasLabels = logos.some((l) => l.label);
  const compositeW = (hasLabels ? labelWidth : 0) + maxLogoW;

  const composite = document.createElement("canvas");
  composite.width = compositeW * scale;
  composite.height = totalH * scale;
  const ctx = composite.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, compositeW, totalH);

  let y = 0;
  for (let i = 0; i < rendered.length; i++) {
    const logoCanvas = rendered[i];
    const lw = (logoCanvas as any)._logicalWidth || logoCanvas.width / scale;
    const lh = (logoCanvas as any)._logicalHeight || logoCanvas.height / scale;

    if (hasLabels && logos[i].label) {
      ctx.font = "bold 12px Helvetica, Arial, sans-serif";
      ctx.fillStyle = "#333";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(logos[i].label!, labelWidth - 8, y + lh / 2);
    }

    ctx.drawImage(
      logoCanvas,
      0,
      0,
      logoCanvas.width,
      logoCanvas.height,
      hasLabels ? labelWidth : 0,
      y,
      lw,
      lh,
    );
    y += lh + gap;
  }

  composite.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

/**
 * Export multiple logos as an SVG with embedded raster images.
 */
export function exportLogosAsSvg(
  logos: LogoSpec[],
  filename = "motif-logos.svg",
): void {
  if (logos.length === 0) return;

  const scale = 2;
  const labelWidth = 160;
  const gap = 4;

  const rendered = logos.map((spec) =>
    renderLogoToCanvas(spec.matrix, {
      height: spec.height || 90,
      width: spec.width,
      showAxes: spec.showAxes ?? true,
      reverseComplement: spec.reverseComplement,
      highlightRange: spec.highlightRange,
      scale,
    }),
  );

  const maxLogoW = Math.max(...rendered.map((c) => (c as any)._logicalWidth || c.width / scale));
  const totalH =
    rendered.reduce((sum, c) => sum + ((c as any)._logicalHeight || c.height / scale), 0) +
    gap * (rendered.length - 1);

  const hasLabels = logos.some((l) => l.label);
  const compositeW = (hasLabels ? labelWidth : 0) + maxLogoW;

  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${compositeW}" height="${totalH}" viewBox="0 0 ${compositeW} ${totalH}">\n`;
  svgContent += `<rect width="100%" height="100%" fill="white"/>\n`;

  let y = 0;
  for (let i = 0; i < rendered.length; i++) {
    const logoCanvas = rendered[i];
    const lw = (logoCanvas as any)._logicalWidth || logoCanvas.width / scale;
    const lh = (logoCanvas as any)._logicalHeight || logoCanvas.height / scale;

    if (hasLabels && logos[i].label) {
      svgContent += `<text x="${labelWidth - 8}" y="${y + lh / 2}" font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="bold" fill="#333" text-anchor="end" dominant-baseline="middle">${escapeXml(logos[i].label!)}</text>\n`;
    }

    const dataUrl = logoCanvas.toDataURL("image/png");
    const xOff = hasLabels ? labelWidth : 0;
    svgContent += `<image x="${xOff}" y="${y}" width="${lw}" height="${lh}" href="${dataUrl}"/>\n`;

    y += lh + gap;
  }

  svgContent += "</svg>";

  const blob = new Blob([svgContent], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
