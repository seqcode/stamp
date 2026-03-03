import type { JobResults, StampParams } from "@/types";

/**
 * Generate a self-contained HTML results page for inclusion in the ZIP download.
 * The page includes inline CSS and JavaScript for rendering sequence logos via canvas.
 */
// Server-side HTML escaping for template literal interpolation
function escapeHtmlServer(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generateResultsHtml(
  jobId: string,
  params: StampParams,
  results: JobResults,
  createdAt: string
): string {
  const data = JSON.stringify({
    jobId,
    params,
    results,
    createdAt,
  });

  const safeJobId = escapeHtmlServer(jobId);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>STAMP 2.0 Results - ${safeJobId}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; color: #111827; padding: 2rem; max-width: 1200px; margin: 0 auto; }
  h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.25rem; }
  .subtitle { font-size: 0.875rem; color: #6b7280; margin-bottom: 1.5rem; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem; }
  .card-title { font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: space-between; }
  .card-title .toggle { font-size: 0.75rem; color: #9ca3af; }
  .card-body { overflow-x: auto; }
  .param-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.25rem 2rem; font-size: 0.875rem; margin-bottom: 1rem; }
  .param-grid .label { color: #6b7280; }
  .param-grid .value { font-weight: 500; color: #1f2937; }
  .motif-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
  .motif-name { width: 7rem; text-align: right; font-size: 0.875rem; font-weight: 500; color: #374151; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .match-block { border: 1px solid #e5e7eb; border-radius: 0.5rem; margin-bottom: 0.75rem; }
  .match-header { padding: 0.75rem 1rem; font-weight: 500; font-size: 0.875rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
  .match-header:hover { background: #f9fafb; }
  .match-body { border-top: 1px solid #f3f4f6; }
  .match-entry { padding: 0.75rem 1rem; border-bottom: 1px solid #f3f4f6; }
  .match-entry:last-child { border-bottom: none; }
  .match-info { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.25rem; }
  .match-info .name { font-weight: 500; font-size: 0.875rem; }
  .match-info .name a { color: #2563eb; text-decoration: none; }
  .match-info .name a:hover { text-decoration: underline; }
  .match-info .badge { font-size: 0.625rem; padding: 0.125rem 0.375rem; border-radius: 0.25rem; }
  .match-info .badge-id { background: #f3f4f6; color: #6b7280; font-family: monospace; }
  .match-info .badge-db { background: #3b82f6; color: #fff; }
  .align-info { font-size: 0.75rem; color: #6b7280; display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
  .align-info .sep { color: #d1d5db; }
  .logo-pair { margin-top: 0.25rem; }
  .logo-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.25rem; }
  .logo-label { width: 4rem; text-align: right; font-size: 0.75rem; color: #6b7280; flex-shrink: 0; }
  .tree-pre { font-family: monospace; font-size: 0.75rem; white-space: pre-wrap; word-break: break-all; background: #f9fafb; padding: 1rem; border-radius: 0.375rem; }
  .strand { font-size: 0.75rem; color: #9ca3af; margin-left: 0.25rem; }
  .rc-btn { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 500; cursor: pointer; border: none; background: #f3f4f6; color: #6b7280; }
  .rc-btn.active { background: #dbeafe; color: #1d4ed8; }
  .fbp-separator { border-top: 1px solid #e5e7eb; margin: 1rem 0 0.5rem; padding-top: 0.5rem; }
  .fbp-label { font-size: 0.75rem; font-weight: 500; color: #6b7280; margin-bottom: 0.25rem; }
  .hidden { display: none; }
</style>
</head>
<body>
<h1>STAMP 2.0 Results</h1>
<div class="subtitle">Job ${safeJobId} &middot; Generated ${escapeHtmlServer(new Date(createdAt).toLocaleString())}</div>

<div id="app"></div>

<script>
var DATA = ${data};

// XSS prevention helpers
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str);
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}
function safeUrl(url) {
  if (typeof url !== 'string') return '';
  try { var p = new URL(url); if (p.protocol === 'https:' || p.protocol === 'http:') return url; } catch(e) {}
  return '';
}

var COLORS = { A: '#CC0000', C: '#0000CC', G: '#FFB300', T: '#008000' };
var LETTERS = ['A', 'C', 'G', 'T'];
var letterCache = {};

function rasterizeLetter(letter, color, fontSize) {
  var key = letter + '-' + fontSize;
  if (letterCache[key]) return letterCache[key];
  var pad = 5;
  var canvas = document.createElement('canvas');
  canvas.width = fontSize + 2 * pad;
  canvas.height = fontSize + 2 * pad;
  var ctx = canvas.getContext('2d');
  var baseline = Math.round(canvas.height - pad);
  ctx.font = 'bold ' + fontSize + 'px Helvetica, Arial, sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(letter, Math.round(canvas.width / 2), baseline);
  var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  var topLine = -1, bottomLine = -1;
  for (var r = 0; r < canvas.height; r++) {
    for (var c = 0; c < canvas.width; c++) {
      if (data[(r * canvas.width + c) * 4 + 3] > 0) {
        if (topLine === -1) topLine = r;
        bottomLine = r;
      }
    }
  }
  var h = topLine >= 0 ? bottomLine - topLine + 1 : 0;
  var result = { canvas: canvas, top: topLine, height: h };
  letterCache[key] = result;
  return result;
}

function drawLogo(canvas, matrix, rc, highlightRange) {
  if (!matrix || matrix.length === 0) return;
  var displayMatrix = rc ? matrix.slice().reverse().map(function(r) { return [r[3], r[2], r[1], r[0]]; }) : matrix;
  var hl = highlightRange;
  if (hl && rc) {
    hl = [displayMatrix.length - 1 - highlightRange[1], displayMatrix.length - 1 - highlightRange[0]];
  }
  var stackW = 28;
  var showAxes = true;
  var maxBits = 2;
  var yAxisTotal = 34;
  var topPad = 8;
  var stackHeight = 60;
  var xNumH = 14;
  var xNumAbove = 2;
  var cw = yAxisTotal + displayMatrix.length * stackW + 8;
  var ch = topPad + stackHeight + xNumAbove + xNumH + 2;
  var dpr = window.devicePixelRatio || 1;
  canvas.width = cw * dpr;
  canvas.height = ch * dpr;
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cw, ch);

  if (showAxes) {
    ctx.save(); ctx.translate(0, topPad);
    ctx.save(); ctx.font = 'bold 12px Helvetica, Arial, sans-serif'; ctx.fillStyle = '#333';
    ctx.translate(12, stackHeight / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center';
    ctx.fillText('bits', 0, 0); ctx.restore();
    ctx.save(); ctx.translate(12 + 3 + 14, 0); ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#333'; ctx.textAlign = 'right';
    var ticH = stackHeight / maxBits;
    for (var i = 0; i <= maxBits; i++) {
      var y = stackHeight - i * ticH;
      ctx.fillText('' + i, -2, y + 4);
      ctx.fillRect(0, y - 0.75, 5, 1.5);
    }
    ctx.fillRect(3.5, 0, 1.5, stackHeight); ctx.restore();
    ctx.fillStyle = '#333'; ctx.fillRect(yAxisTotal - 1.5, stackHeight - 0.75, cw - yAxisTotal, 1.5);
    ctx.restore();
  }

  var firstNZ = -1, lastNZ = -1;
  for (var p = 0; p < displayMatrix.length; p++) {
    var s = displayMatrix[p][0] + displayMatrix[p][1] + displayMatrix[p][2] + displayMatrix[p][3];
    if (s > 0) { if (firstNZ === -1) firstNZ = p; lastNZ = p; }
  }

  var posLabel = 0;
  var rasterFontSize = 60;
  for (var pos = 0; pos < displayMatrix.length; pos++) {
    var row = displayMatrix[pos];
    var total = row[0] + row[1] + row[2] + row[3];
    var xBase = yAxisTotal + pos * stackW;
    var isFaded = hl && (pos < hl[0] || pos > hl[1]);
    if (total === 0) {
      if (firstNZ !== -1 && pos > firstNZ && pos < lastNZ) {
        ctx.globalAlpha = isFaded ? 0.25 : 1.0;
        ctx.fillStyle = '#E5E7EB';
        ctx.fillRect(xBase + 1, topPad, stackW - 2, stackHeight);
        ctx.globalAlpha = 1.0;
      }
      continue;
    }
    posLabel++;
    if (isFaded) ctx.globalAlpha = 0.25;
    var freqs = [row[0]/total, row[1]/total, row[2]/total, row[3]/total];
    var entropy = 0;
    for (var f = 0; f < 4; f++) { if (freqs[f] > 0) entropy -= freqs[f] * Math.log2(freqs[f]); }
    var ic = maxBits - entropy;
    var letterHeights = [];
    for (var li = 0; li < 4; li++) {
      var h = freqs[li] * ic;
      if (h > 0.01) letterHeights.push({ letter: LETTERS[li], h: h });
    }
    letterHeights.sort(function(a, b) { return a.h - b.h; });
    var yBottom = topPad + stackHeight;
    for (var lj = 0; lj < letterHeights.length; lj++) {
      var lh = letterHeights[lj];
      var drawH = (lh.h / maxBits) * stackHeight;
      if (drawH < 1) { yBottom -= drawH; continue; }
      var cached = rasterizeLetter(lh.letter, COLORS[lh.letter], rasterFontSize);
      if (cached.height > 0) {
        ctx.drawImage(cached.canvas, 0, cached.top - 1, cached.canvas.width, cached.height + 1, xBase, yBottom - drawH, stackW, drawH);
      }
      yBottom -= drawH;
    }
    if (isFaded) ctx.globalAlpha = 1.0;
    if (showAxes) {
      ctx.save();
      ctx.translate(xBase + stackW / 2, topPad + stackHeight + xNumAbove);
      ctx.font = 'bold 10px Helvetica, Arial, sans-serif'; ctx.fillStyle = '#333';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.rotate(-Math.PI / 2);
      ctx.fillText('' + posLabel, 0, 0); ctx.restore();
    }
  }
}

function createLogoCanvas(matrix, rc) {
  var c = document.createElement('canvas');
  c.style.display = 'block';
  setTimeout(function() { drawLogo(c, matrix, rc); }, 0);
  return c;
}

function reverseComplementMatrix(matrix) {
  return matrix.slice().reverse().map(function(r) { return [r[3], r[2], r[1], r[0]]; });
}

function buildFullAlignedMatrix(consensus, rawPfm, alignStart, alignEnd, motifLength, leftPad, rightPad) {
  var result = [];
  for (var i = 0; i < leftPad; i++) result.push([0,0,0,0]);
  for (var i = 0; i < alignStart; i++) result.push(i < rawPfm.length ? rawPfm[i] : [0,0,0,0]);
  var highlightStart = result.length;
  var rawIdx = alignStart;
  for (var ci = 0; ci < consensus.length; ci++) {
    if (consensus[ci] === '-') { result.push([0,0,0,0]); }
    else { result.push(rawIdx < rawPfm.length ? rawPfm[rawIdx++] : [0,0,0,0]); }
  }
  var highlightEnd = result.length - 1;
  for (var i = alignEnd + 1; i < motifLength; i++) result.push(i < rawPfm.length ? rawPfm[i] : [0,0,0,0]);
  for (var i = 0; i < rightPad; i++) result.push([0,0,0,0]);
  return { matrix: result, highlightStart: highlightStart, highlightEnd: highlightEnd };
}

function buildAlignedPair(match) {
  var rawQ = match.queryMotifMatrix ? (match.queryStrand === '-' ? reverseComplementMatrix(match.queryMotifMatrix) : match.queryMotifMatrix) : null;
  var rawM = match.matchMotifMatrix ? (match.matchStrand === '-' ? reverseComplementMatrix(match.matchMotifMatrix) : match.matchMotifMatrix) : null;
  if (!rawQ || !rawM || !match.queryLength || !match.matchLength) {
    function buildSimple(cons, pfm) {
      var r = [], idx = 0;
      for (var i = 0; i < cons.length; i++) {
        if (cons[i] === '-') r.push([0,0,0,0]);
        else r.push(idx < pfm.length ? pfm[idx++] : [0,0,0,0]);
      }
      return { matrix: r, highlightStart: 0, highlightEnd: r.length - 1 };
    }
    return {
      query: rawQ && match.alignmentQuery ? buildSimple(match.alignmentQuery, rawQ) : { matrix: [], highlightStart: 0, highlightEnd: 0 },
      match: rawM && match.alignmentMatch ? buildSimple(match.alignmentMatch, rawM) : { matrix: [], highlightStart: 0, highlightEnd: 0 }
    };
  }
  var qS = match.queryAlignStart, qE = match.queryAlignEnd, qL = match.queryLength;
  var mS = match.matchAlignStart, mE = match.matchAlignEnd, mL = match.matchLength;
  var maxLeft = Math.max(qS, mS);
  var maxRight = Math.max(qL - qE - 1, mL - mE - 1);
  var q = buildFullAlignedMatrix(match.alignmentQuery, rawQ, qS, qE, qL, maxLeft - qS, maxRight - (qL - qE - 1));
  var m = buildFullAlignedMatrix(match.alignmentMatch, rawM, mS, mE, mL, maxLeft - mS, maxRight - (mL - mE - 1));
  return { query: q, match: m };
}

var app = document.getElementById('app');
var res = DATA.results;
var p = DATA.params;

function makeCard(title, content, extraTitle) {
  var card = document.createElement('div');
  card.className = 'card';
  var titleEl = document.createElement('div');
  titleEl.className = 'card-title';
  var titleText = document.createElement('span');
  titleText.textContent = title;
  var rightSide = document.createElement('div');
  rightSide.style.display = 'flex';
  rightSide.style.alignItems = 'center';
  rightSide.style.gap = '0.5rem';
  if (extraTitle) rightSide.appendChild(extraTitle);
  var toggle = document.createElement('span');
  toggle.className = 'toggle';
  toggle.textContent = '\\u25B2';
  rightSide.appendChild(toggle);
  titleEl.appendChild(titleText);
  titleEl.appendChild(rightSide);
  var body = document.createElement('div');
  body.className = 'card-body';
  if (typeof content === 'string') { body.innerHTML = content; }
  else { body.appendChild(content); }
  titleEl.addEventListener('click', function(e) {
    if (e.target.closest && e.target.closest('.rc-btn')) return;
    body.classList.toggle('hidden');
    toggle.textContent = body.classList.contains('hidden') ? '\\u25BC' : '\\u25B2';
  });
  card.appendChild(titleEl);
  card.appendChild(body);
  return card;
}

function makeRcBtn(onToggle) {
  var btn = document.createElement('button');
  btn.className = 'rc-btn';
  btn.textContent = 'RC';
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    btn.classList.toggle('active');
    onToggle(btn.classList.contains('active'));
  });
  return btn;
}

var METRIC_LABELS = {PCC:'Pearson Correlation (PCC)',ALLR:'Average Log-Likelihood Ratio (ALLR)',ALLR_LL:'ALLR (Log-Likelihood)',CS:'Chi-Squared (CS)',KL:'Kullback-Leibler (KL)',SSD:'Sum of Squared Distances (SSD)'};
var ALIGN_LABELS = {SWU:'Smith-Waterman Ungapped (SWU)',SWA:'Smith-Waterman Affine (SWA)',SW:'Smith-Waterman (SW)',NW:'Needleman-Wunsch (NW)'};
var MULTI_LABELS = {PPA:'Progressive Profile Alignment (PPA)',IR:'Iterative Refinement (IR)',NONE:'None'};
var TREE_LABELS = {UPGMA:'UPGMA',NJ:'Neighbor Joining (NJ)'};

// 1. Input Parameters
(function() {
  var frag = document.createElement('div');
  var grid = document.createElement('div');
  grid.className = 'param-grid';
  function addParam(label, value) {
    var l = document.createElement('div');
    l.innerHTML = '<span class="label">' + escapeHtml(label) + ':</span> <span class="value">' + escapeHtml(value) + '</span>';
    grid.appendChild(l);
  }
  addParam('Column Metric', METRIC_LABELS[p.columnMetric] || p.columnMetric);
  addParam('Alignment', ALIGN_LABELS[p.alignmentMethod] || p.alignmentMethod);
  addParam('Multiple Alignment', MULTI_LABELS[p.multipleAlignment] || p.multipleAlignment);
  addParam('Tree Method', TREE_LABELS[p.treeMethod] || p.treeMethod);
  if (p.alignmentMethod !== 'SWU') {
    addParam('Gap Open', '' + p.gapOpen);
    addParam('Gap Extend', '' + p.gapExtend);
  }
  addParam('Overlap Align', p.overlapAlign ? 'Yes' : 'No');
  addParam('Strand', p.forwardOnly ? 'Forward only' : 'Both strands');
  frag.appendChild(grid);

  if (res.inputMotifs && res.inputMotifs.length > 0) {
    var canvases = [];
    res.inputMotifs.forEach(function(motif) {
      var row = document.createElement('div');
      row.className = 'motif-row';
      var name = document.createElement('div');
      name.className = 'motif-name';
      name.textContent = motif.name;
      name.title = motif.name;
      var c = createLogoCanvas(motif.matrix, false);
      canvases.push({ canvas: c, matrix: motif.matrix });
      row.appendChild(name);
      row.appendChild(c);
      frag.appendChild(row);
    });
    var rcBtn = makeRcBtn(function(active) {
      canvases.forEach(function(item) { drawLogo(item.canvas, item.matrix, active); });
    });
    app.appendChild(makeCard('Input Parameters', frag, rcBtn));
  } else {
    app.appendChild(makeCard('Input Parameters', frag));
  }
})();

// 2. Multiple Alignment + FBP
if (res.multipleAlignment && res.multipleAlignment.length > 0) {
  (function() {
    var frag = document.createElement('div');
    var canvases = [];
    res.multipleAlignment.forEach(function(entry) {
      var row = document.createElement('div');
      row.className = 'motif-row';
      var name = document.createElement('div');
      name.className = 'motif-name';
      name.innerHTML = escapeHtml(entry.name) + '<span class="strand">(' + escapeHtml(entry.strand) + ')</span>';
      var c = document.createElement('canvas');
      c.style.display = 'block';
      canvases.push({ canvas: c, matrix: entry.alignedMatrix });
      setTimeout(function() { drawLogo(c, entry.alignedMatrix, false); }, 0);
      row.appendChild(name);
      row.appendChild(c);
      frag.appendChild(row);
    });

    // FBP merged into Multiple Alignment
    if (res.fbpProfile) {
      var sep = document.createElement('div');
      sep.className = 'fbp-separator';
      var label = document.createElement('div');
      label.className = 'fbp-label';
      label.textContent = 'Familial Binding Profile (FBP)';
      sep.appendChild(label);
      var fbpRow = document.createElement('div');
      fbpRow.className = 'motif-row';
      var fbpName = document.createElement('div');
      fbpName.className = 'motif-name';
      fbpName.textContent = 'FBP';
      var fbpCanvas = document.createElement('canvas');
      fbpCanvas.style.display = 'block';
      canvases.push({ canvas: fbpCanvas, matrix: res.fbpProfile });
      setTimeout(function() { drawLogo(fbpCanvas, res.fbpProfile, false); }, 0);
      fbpRow.appendChild(fbpName);
      fbpRow.appendChild(fbpCanvas);
      sep.appendChild(fbpRow);
      frag.appendChild(sep);
    }

    var rcBtn = makeRcBtn(function(active) {
      canvases.forEach(function(item) { drawLogo(item.canvas, item.matrix, active); });
    });
    app.appendChild(makeCard('Multiple Alignment', frag, rcBtn));
  })();
}

// 3. Similarity Matches
if (res.matchPairs && res.matchPairs.length > 0) {
  (function() {
    var frag = document.createElement('div');

    res.matchPairs.forEach(function(result) {
      var block = document.createElement('div');
      block.className = 'match-block';
      var header = document.createElement('div');
      header.className = 'match-header';
      header.innerHTML = '<span>' + escapeHtml(result.queryName) + '</span><span style="font-size:0.75rem;color:#6b7280">' + result.matches.length + ' match' + (result.matches.length !== 1 ? 'es' : '') + ' <span class="toggle">\\u25B2</span></span>';
      var body = document.createElement('div');
      body.className = 'match-body';
      header.addEventListener('click', function() {
        body.classList.toggle('hidden');
        var t = header.querySelector('.toggle');
        t.textContent = body.classList.contains('hidden') ? '\\u25BC' : '\\u25B2';
      });

      result.matches.forEach(function(match, idx) {
        var entry = document.createElement('div');
        entry.className = 'match-entry';

        var aligned = buildAlignedPair(match);
        var entryCanvases = [];

        var rcBtn = makeRcBtn(function(active) {
          entryCanvases.forEach(function(item) { drawLogo(item.canvas, item.matrix, active, item.hl); });
        });

        // Match info line with DB metadata
        var info = document.createElement('div');
        info.className = 'match-info';
        var nameHtml = '<span class="name">' + (idx + 1) + '. ';
        if (match.dbUrl) {
          var url = safeUrl(match.dbUrl);
          if (url) {
            nameHtml += '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(match.name) + '</a>';
          } else {
            nameHtml += escapeHtml(match.name);
          }
        } else {
          nameHtml += escapeHtml(match.name);
        }
        nameHtml += '</span>';
        info.innerHTML = nameHtml;
        if (match.dbId) {
          var idBadge = document.createElement('span');
          idBadge.className = 'badge badge-id';
          idBadge.textContent = match.dbId;
          info.appendChild(idBadge);
        }
        if (match.dbSource) {
          var dbBadge = document.createElement('span');
          dbBadge.className = 'badge badge-db';
          dbBadge.textContent = match.dbSource + (match.dbCollection ? ' ' + match.dbCollection : '');
          info.appendChild(dbBadge);
        }
        entry.appendChild(info);

        // Alignment info
        var alignInfo = document.createElement('div');
        alignInfo.className = 'align-info';
        alignInfo.innerHTML = '<span style="font-family:monospace">E-value: ' + escapeHtml(match.evalue.toExponential(2)) + '</span>';
        if (match.queryLength > 0) {
          alignInfo.innerHTML += '<span class="sep">|</span>'
            + '<span>Query(' + escapeHtml(match.queryStrand) + '): ' + escapeHtml(String(match.queryAlignStart)) + '\\u2013' + escapeHtml(String(match.queryAlignEnd)) + ' / ' + escapeHtml(String(match.queryLength)) + ' pos</span>'
            + '<span>Match(' + escapeHtml(match.matchStrand) + '): ' + escapeHtml(String(match.matchAlignStart)) + '\\u2013' + escapeHtml(String(match.matchAlignEnd)) + ' / ' + escapeHtml(String(match.matchLength)) + ' pos</span>';
        }
        entry.appendChild(alignInfo);

        // RC button
        var btnWrap = document.createElement('div');
        btnWrap.style.marginBottom = '0.5rem';
        btnWrap.appendChild(rcBtn);
        entry.appendChild(btnWrap);

        var logos = document.createElement('div');
        logos.className = 'logo-pair';
        if (aligned.query.matrix.length > 0) {
          var r1 = document.createElement('div');
          r1.className = 'logo-row';
          r1.innerHTML = '<span class="logo-label">Query</span>';
          var c1 = document.createElement('canvas');
          c1.style.display = 'block';
          var qHl = [aligned.query.highlightStart, aligned.query.highlightEnd];
          entryCanvases.push({ canvas: c1, matrix: aligned.query.matrix, hl: qHl });
          setTimeout(function(cv, m, h) { return function() { drawLogo(cv, m, false, h); }; }(c1, aligned.query.matrix, qHl), 0);
          r1.appendChild(c1);
          logos.appendChild(r1);
        }
        if (aligned.match.matrix.length > 0) {
          var r2 = document.createElement('div');
          r2.className = 'logo-row';
          r2.innerHTML = '<span class="logo-label">Match</span>';
          var c2 = document.createElement('canvas');
          c2.style.display = 'block';
          var mHl = [aligned.match.highlightStart, aligned.match.highlightEnd];
          entryCanvases.push({ canvas: c2, matrix: aligned.match.matrix, hl: mHl });
          setTimeout(function(cv, m, h) { return function() { drawLogo(cv, m, false, h); }; }(c2, aligned.match.matrix, mHl), 0);
          r2.appendChild(c2);
          logos.appendChild(r2);
        }
        entry.appendChild(logos);
        body.appendChild(entry);
      });

      block.appendChild(header);
      block.appendChild(body);
      frag.appendChild(block);
    });

    app.appendChild(makeCard('Similarity Matches', frag));
  })();
}

// 4. Phylogenetic Tree
if (res.treeNewick) {
  var pre = document.createElement('pre');
  pre.className = 'tree-pre';
  pre.textContent = res.treeNewick;
  app.appendChild(makeCard('Phylogenetic Tree', pre));
}
</script>
</body>
</html>`;
}
