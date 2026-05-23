// Computational Geometry core — TRIM, EXTEND, OFFSET math

export interface Vec2 { x: number; y: number; }

// ── Line-Line Intersection (Parametric) ────────────────────────────────────────
// L1: P1 + t*(P2-P1),  L2: P3 + u*(P4-P3)
// Returns null if lines are parallel.
export function lineLineIntersect(
  p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2
): { t: number; u: number; x: number; y: number } | null {
  const dx1 = p2.x - p1.x, dy1 = p2.y - p1.y;
  const dx2 = p4.x - p3.x, dy2 = p4.y - p3.y;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((p3.x - p1.x) * dy2 - (p3.y - p1.y) * dx2) / denom;
  const u = ((p3.x - p1.x) * dy1 - (p3.y - p1.y) * dx1) / denom;
  return { t, u, x: p1.x + t * dx1, y: p1.y + t * dy1 };
}

export function lerp2(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// t parameter (0..1) of nearest point on segment P1→P2 to PT
export function nearestT(pt: Vec2, p1: Vec2, p2: Vec2): number {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-10) return 0;
  return Math.max(0, Math.min(1, ((pt.x - p1.x) * dx + (pt.y - p1.y) * dy) / len2));
}

// Which side of line P1→P2 is PT on?  Positive = left, negative = right.
export function sideOfLine(p1: Vec2, p2: Vec2, pt: Vec2): number {
  return (p2.x - p1.x) * (pt.y - p1.y) - (p2.y - p1.y) * (pt.x - p1.x);
}

// ── OFFSET ────────────────────────────────────────────────────────────────────

// Offset a single LINE segment by distance d.
// Positive d = left of travel direction (P1→P2).
export function offsetLineSeg(p1: Vec2, p2: Vec2, d: number): [Vec2, Vec2] {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-10) return [{ ...p1 }, { ...p2 }];
  const nx = -dy / len * d, ny = dx / len * d;
  return [
    { x: p1.x + nx, y: p1.y + ny },
    { x: p2.x + nx, y: p2.y + ny },
  ];
}

export const DEFAULT_MITER_LIMIT = 4.0;

// Compute the offset corner point(s) for the vertex at p2, between segments p1→p2 and p2→p3.
// Returns 1 point (miter join) or 2 points (bevel join when angle is too sharp).
export function calculateCornerOffset(
  p1: Vec2, p2: Vec2, p3: Vec2,
  distance: number,
  miterLimit = DEFAULT_MITER_LIMIT
): Vec2[] {
  // Segment 1 unit direction and left-side unit normal
  const v1x = p2.x - p1.x, v1y = p2.y - p1.y;
  const len1 = Math.hypot(v1x, v1y);
  if (len1 < 1e-10) return [];
  const n1x = -v1y / len1, n1y = v1x / len1;

  // Segment 2 unit direction and left-side unit normal
  const v2x = p3.x - p2.x, v2y = p3.y - p2.y;
  const len2 = Math.hypot(v2x, v2y);
  if (len2 < 1e-10) return [];
  const n2x = -v2y / len2, n2y = v2x / len2;

  // Bisector vector (sum of unit normals)
  const mx = n1x + n2x, my = n1y + n2y;
  const mLenSq = mx * mx + my * my;

  // Nearly parallel segments: just use the first normal
  if (mLenSq < 1e-6) {
    return [{ x: p2.x + n1x * distance, y: p2.y + n1y * distance }];
  }

  // Miter factor = 1/sin(θ/2); mathematically equals 2/|bisector|
  const miterFactor = 2.0 / Math.sqrt(mLenSq);

  if (miterFactor > miterLimit) {
    // Bevel: two flat points — end of seg1 offset, start of seg2 offset
    return [
      { x: p2.x + n1x * distance, y: p2.y + n1y * distance },
      { x: p2.x + n2x * distance, y: p2.y + n2y * distance },
    ];
  }

  // Miter: single intersection point along bisector direction
  const mLen = Math.sqrt(mLenSq);
  return [{
    x: p2.x + (mx / mLen) * distance * miterFactor,
    y: p2.y + (my / mLen) * distance * miterFactor,
  }];
}

// Offset a LWPOLYLINE (vertex array) by distance d.
// Returns potentially more vertices than input when bevel corners are applied.
export function offsetPolyline(verts: Vec2[], d: number, closed: boolean): Vec2[] {
  const n = verts.length;
  if (n < 2) return verts.map(v => ({ ...v }));

  const result: Vec2[] = [];

  if (!closed) {
    // Start cap: offset start of first segment
    const [start] = offsetLineSeg(verts[0], verts[1], d);
    result.push(start);
    // Interior corners
    for (let i = 1; i < n - 1; i++) {
      for (const pt of calculateCornerOffset(verts[i - 1], verts[i], verts[i + 1], d))
        result.push(pt);
    }
    // End cap: offset end of last segment
    const [, end] = offsetLineSeg(verts[n - 2], verts[n - 1], d);
    result.push(end);
  } else {
    // All corners (closed — wrap around)
    for (let i = 0; i < n; i++) {
      const prev = verts[(i + n - 1) % n];
      const curr = verts[i];
      const next = verts[(i + 1) % n];
      for (const pt of calculateCornerOffset(prev, curr, next, d))
        result.push(pt);
    }
  }

  return result;
}

// ── TRIM ──────────────────────────────────────────────────────────────────────

export interface Seg { p1: Vec2; p2: Vec2; }

// Collect t-values where segment P1→P2 is crossed by boundary segments.
// Only interior intersections (t ∈ (0,1)) and boundary within its own extent.
export function collectIntersectionTs(p1: Vec2, p2: Vec2, boundaries: Seg[]): number[] {
  const ts: number[] = [];
  for (const b of boundaries) {
    const r = lineLineIntersect(p1, p2, b.p1, b.p2);
    if (!r) continue;
    if (r.t < 1e-6 || r.t > 1 - 1e-6) continue; // outside target segment
    if (r.u < -1e-6 || r.u > 1 + 1e-6) continue; // outside boundary segment
    ts.push(r.t);
  }
  return ts.sort((a, b) => a - b);
}

// Trim: remove the interval around clickT, return 0/1/2 replacement segments.
export function trimLineByTs(p1: Vec2, p2: Vec2, ts: number[], clickT: number): Seg[] {
  const interior = ts.filter(t => t > 1e-6 && t < 1 - 1e-6).sort((a, b) => a - b);
  const breaks = [0, ...interior, 1];
  for (let i = 0; i < breaks.length - 1; i++) {
    if (clickT >= breaks[i] - 1e-6 && clickT <= breaks[i + 1] + 1e-6) {
      const result: Seg[] = [];
      if (breaks[i] > 1e-6)
        result.push({ p1: { ...p1 }, p2: lerp2(p1, p2, breaks[i]) });
      if (breaks[i + 1] < 1 - 1e-6)
        result.push({ p1: lerp2(p1, p2, breaks[i + 1]), p2: { ...p2 } });
      return result;
    }
  }
  return [{ p1: { ...p1 }, p2: { ...p2 } }];
}

// ── EXTEND ────────────────────────────────────────────────────────────────────

// Extend the end of P1→P2 (determined by clickT) to the nearest boundary.
export function extendLineToBoundary(
  p1: Vec2, p2: Vec2,
  boundaries: Seg[],
  clickT: number
): { newPt: Vec2; extendP2: boolean } | null {
  const extendP2 = clickT > 0.5;
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  let bestT: number | null = null;

  for (const b of boundaries) {
    const r = lineLineIntersect(p1, p2, b.p1, b.p2);
    if (!r) continue;
    if (r.u < -1e-6 || r.u > 1 + 1e-6) continue;
    if (extendP2) {
      if (r.t > 1 + 1e-6 && (bestT === null || r.t < bestT)) bestT = r.t;
    } else {
      if (r.t < -1e-6 && (bestT === null || r.t > bestT)) bestT = r.t;
    }
  }

  if (bestT === null) return null;
  return {
    newPt: { x: p1.x + bestT * dx, y: p1.y + bestT * dy },
    extendP2,
  };
}
