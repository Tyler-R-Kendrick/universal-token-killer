import type { BenchmarkReport, TechniqueReport } from './harness.js';

/**
 * Pareto bubble chart for one benchmark, as a self-contained SVG string.
 *   x = total cost per task (USD, lower better)
 *   y = task success rate (higher better)
 *   bubble size = p95 total latency (ms)
 *   label = technique
 * Techniques on the frontier (not dominated on cost ↓ / success ↑) are filled;
 * dominated ones are hollow. This is the guard against "saves the most tokens = best":
 * the real winner is a technique on the frontier for the workload.
 */
export function renderParetoSvg(report: BenchmarkReport): string {
  const W = 760;
  const H = 440;
  const M = { top: 52, right: 150, bottom: 64, left: 76 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const points = collectPoints(report);
  const costs = points.map((p) => p.cost);
  const successes = points.map((p) => p.success);
  const p95s = points.map((p) => p.p95);

  const xMax = niceCeil(Math.max(...costs) * 1.12 || 1);
  const yLo = Math.max(0, Math.floor((Math.min(...successes) - 0.06) * 10) / 10);
  const yHi = 1.0;
  const pMin = Math.min(...p95s);
  const pMax = Math.max(...p95s);

  const xOf = (cost: number): number => M.left + (xMax === 0 ? 0 : (cost / xMax) * plotW);
  const yOf = (success: number): number => M.top + plotH - (yHi === yLo ? plotH / 2 : ((success - yLo) / (yHi - yLo)) * plotH);
  const rOf = (p95: number): number => (pMax === pMin ? 13 : 8 + ((p95 - pMin) / (pMax - pMin)) * 15);

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif">`);
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#f6f8fa" stroke="#d0d7de" rx="8"/>`);
  parts.push(`<text x="${M.left}" y="28" font-size="16" font-weight="700" fill="#1f2328">${escapeXml(report.title)} — cost vs. task success</text>`);
  parts.push(`<text x="${M.left}" y="44" font-size="11" fill="#656d76">x: cost per task (USD) · y: task success · bubble: p95 latency · filled = on Pareto frontier</text>`);

  // Axes.
  const axisX0 = M.left;
  const axisY0 = M.top + plotH;
  parts.push(`<line x1="${axisX0}" y1="${axisY0}" x2="${M.left + plotW}" y2="${axisY0}" stroke="#8c959f" stroke-width="1"/>`);
  parts.push(`<line x1="${axisX0}" y1="${M.top}" x2="${axisX0}" y2="${axisY0}" stroke="#8c959f" stroke-width="1"/>`);

  // X ticks (cost).
  for (let i = 0; i <= 4; i++) {
    const cost = (xMax / 4) * i;
    const x = xOf(cost);
    parts.push(`<line x1="${x}" y1="${axisY0}" x2="${x}" y2="${axisY0 + 5}" stroke="#8c959f"/>`);
    parts.push(`<text x="${x}" y="${axisY0 + 19}" font-size="10" fill="#656d76" text-anchor="middle">$${cost.toFixed(4)}</text>`);
  }
  parts.push(`<text x="${M.left + plotW / 2}" y="${H - 14}" font-size="12" fill="#1f2328" text-anchor="middle">total cost per task (USD) — lower is better</text>`);

  // Y ticks (success).
  for (let i = 0; i <= 4; i++) {
    const success = yLo + ((yHi - yLo) / 4) * i;
    const y = yOf(success);
    parts.push(`<line x1="${axisX0 - 5}" y1="${y}" x2="${axisX0}" y2="${y}" stroke="#8c959f"/>`);
    parts.push(`<text x="${axisX0 - 9}" y="${y + 3}" font-size="10" fill="#656d76" text-anchor="end">${(success * 100).toFixed(0)}%</text>`);
    parts.push(`<line x1="${axisX0}" y1="${y}" x2="${M.left + plotW}" y2="${y}" stroke="#eaeef2" stroke-width="1"/>`);
  }
  parts.push(`<text x="18" y="${M.top + plotH / 2}" font-size="12" fill="#1f2328" text-anchor="middle" transform="rotate(-90 18 ${M.top + plotH / 2})">task success — higher is better</text>`);

  // Bubbles (draw larger first so labels stay legible).
  const ordered = [...points].sort((a, b) => rOf(b.p95) - rOf(a.p95));
  for (const point of ordered) {
    const x = xOf(point.cost);
    const y = yOf(point.success);
    const r = rOf(point.p95);
    const color = point.color;
    const fill = point.onFrontier ? color : '#ffffff';
    parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" fill-opacity="${point.onFrontier ? 0.75 : 0.9}" stroke="${color}" stroke-width="2"/>`);
    const labelX = x + r + 4 > M.left + plotW - 40 ? x - r - 4 : x + r + 4;
    const anchor = x + r + 4 > M.left + plotW - 40 ? 'end' : 'start';
    parts.push(`<text x="${labelX.toFixed(1)}" y="${(y - r - 4).toFixed(1)}" font-size="10.5" font-weight="600" fill="#1f2328" text-anchor="${anchor}">${escapeXml(point.short)}</text>`);
  }

  // Legend.
  let ly = M.top + 6;
  parts.push(`<text x="${M.left + plotW + 18}" y="${ly}" font-size="11" font-weight="700" fill="#1f2328">Technique</text>`);
  for (const point of points) {
    ly += 20;
    const fill = point.onFrontier ? point.color : '#ffffff';
    parts.push(`<circle cx="${M.left + plotW + 24}" cy="${ly - 4}" r="6" fill="${fill}" stroke="${point.color}" stroke-width="2"/>`);
    parts.push(`<text x="${M.left + plotW + 36}" y="${ly}" font-size="10.5" fill="#1f2328">${escapeXml(point.short)}${point.onFrontier ? ' ★' : ''}</text>`);
  }
  ly += 26;
  parts.push(`<text x="${M.left + plotW + 18}" y="${ly}" font-size="9.5" fill="#656d76">★ Pareto frontier</text>`);

  parts.push('</svg>');
  return parts.join('\n') + '\n';
}

type ParetoPoint = { key: string; short: string; cost: number; success: number; p95: number; onFrontier: boolean; color: string };

const PALETTE = ['#57606a', '#0969da', '#1a7f37', '#9a6700', '#bf3989', '#8250df', '#cf222e', '#0550ae'];

function collectPoints(report: BenchmarkReport): ParetoPoint[] {
  const all: TechniqueReport[] = [report.baseline, ...report.competitors, report.utk];
  return all.map((tech, index) => ({
    key: tech.technique,
    short: shortName(tech),
    cost: tech.primary.costPerTask,
    success: tech.primary.taskSuccessRate,
    p95: tech.primary.p95LatencyMs,
    onFrontier: tech.onFrontier,
    color: tech.technique === 'utk' ? '#1a7f37' : tech.technique === 'baseline' ? '#57606a' : PALETTE[(index % (PALETTE.length - 1)) + 1] ?? '#0969da'
  }));
}

function shortName(report: TechniqueReport): string {
  if (report.armKind === 'baseline') return 'baseline';
  if (report.armKind === 'utk') return 'UTK';
  return report.technique;
}

function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] ?? c);
}
