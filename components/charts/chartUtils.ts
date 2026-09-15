import type { SeriesPoint } from '@/types/app';

export interface Point {
  x: number;
  y: number;
}

export function scalePoints(
  data: readonly SeriesPoint[],
  width: number,
  height: number,
  padding: { top: number; bottom: number; left: number; right: number },
  domain?: { min: number; max: number },
): { points: Point[]; min: number; max: number } {
  const values = data.map((d) => d.value);
  const rawMin = domain?.min ?? Math.min(...values, 0);
  const rawMax = domain?.max ?? Math.max(...values, 1);
  const min = rawMin;
  const max = rawMax === min ? min + 1 : rawMax;
  const innerW = Math.max(1, width - padding.left - padding.right);
  const innerH = Math.max(1, height - padding.top - padding.bottom);
  const n = data.length;
  const points = data.map((d, i) => ({
    x: padding.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW),
    y: padding.top + innerH - ((d.value - min) / (max - min)) * innerH,
  }));
  return { points, min, max };
}

/** Smooth cubic path through points (Catmull-Rom → Bezier). */
export function smoothPath(points: Point[], tension = 0.2): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0]?.x} ${points[0]?.y}`;
  let d = `M ${points[0]?.x} ${points[0]?.y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    if (!p0 || !p1 || !p2 || !p3) continue;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function areaPath(points: Point[], baselineY: number, tension = 0.2): string {
  if (points.length === 0) return '';
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return '';
  return `${smoothPath(points, tension)} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
}

export function polylineLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len * 1.05;
}

export function nearestIndex(points: Point[], x: number): number {
  if (points.length === 0) return -1;
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  points.forEach((p, i) => {
    const d = Math.abs(p.x - x);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

/** Nice axis ticks (3 values) for the given max. */
export function niceTicks(min: number, max: number, count = 3): number[] {
  if (max <= min) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(min + step * i));
}
