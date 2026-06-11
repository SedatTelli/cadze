// Computational Geometry core — TRIM, EXTEND, OFFSET, OSNAP, B-spline math

export interface Vec2 { x: number; y: number; }

// ── Precision constants ────────────────────────────────────────────────────────
export const EPS      = 1e-9;   // floating-point zero
export const EPS_PAR  = 1e-7;   // near-parallel line denominator
export const EPS_COIN = 1e-6;   // coincident point threshold

// ── Arc specification (for bulge segments and ARC trim/extend) ─────────────────
export interface ArcSpec {
  cx: number; cy: number; r: number;
  startAngle: number; endAngle: number;
  ccw: boolean;
}

/**
 * Convert an LWPOLYLINE bulge segment to an arc.
 * bulge = tan(includedAngle / 4); positive = CCW, negative = CW.
 */
export function bulgeToArc(p1: Vec2, p2: Vec2, bulge: number): ArcSpec {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const d  = Math.sqrt(dx * dx + dy * dy);
  if (d < EPS) return { cx: p1.x, cy: p1.y, r: 0, startAngle: 0, endAngle: 0, ccw: true };
  const theta   = 4 * Math.atan(Math.abs(bulge));
  const sinHalf = Math.sin(theta / 2);
  const r       = sinHalf < EPS ? d * 1e6 : d / (2 * sinHalf);
  const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
  // Left-perpendicular unit vector of p1→p2
  const lx = -dy / d, ly = dx / d;
  // Signed distance from chord midpoint to arc center along left-perpendicular.
  // cos(θ/2) is positive when bulge < 1, negative when bulge > 1.
  const h = r * Math.cos(theta / 2) * (bulge > 0 ? 1 : -1);
  const cx = mx + h * lx, cy = my + h * ly;
  return {
    cx, cy, r,
    startAngle: Math.atan2(p1.y - cy, p1.x - cx),
    endAngle:   Math.atan2(p2.y - cy, p2.x - cx),
    ccw: bulge > 0,
  };
}

/** Mid-angle of an arc sweep (for OSNAP midpoint on arc segments). */
export function arcMidAngle(sa: number, ea: number, ccw: boolean): number {
  if (ccw) { let e = ea; if (e < sa) e += Math.PI * 2; return (sa + e) / 2; }
  let e = ea; if (e > sa) e -= Math.PI * 2; return (sa + e) / 2;
}

/** True if angle `a` lies within the swept region of the arc (CCW or CW). */
export function angleInArcSpan(a: number, sa: number, ea: number, ccw: boolean): boolean {
  const N = Math.PI * 2;
  const norm = (x: number) => ((x % N) + N) % N;
  const an = norm(a), sn = norm(sa), en = norm(ea);
  if (ccw) return sn <= en ? an >= sn && an <= en : an >= sn || an <= en;
  return    sn >= en ? an <= sn && an >= en : an <= sn || an >= en;
}

/** Tight axis-aligned bounding box of an arc, including cardinal-angle extremes. */
export function arcBBox(arc: ArcSpec): { minX: number; minY: number; maxX: number; maxY: number } {
  const { cx, cy, r, startAngle: sa, endAngle: ea, ccw } = arc;
  const ep: Vec2[] = [
    { x: cx + r * Math.cos(sa), y: cy + r * Math.sin(sa) },
    { x: cx + r * Math.cos(ea), y: cy + r * Math.sin(ea) },
  ];
  for (const ang of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2])
    if (angleInArcSpan(ang, sa, ea, ccw))
      ep.push({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  return {
    minX: Math.min(...ep.map(p => p.x)), minY: Math.min(...ep.map(p => p.y)),
    maxX: Math.max(...ep.map(p => p.x)), maxY: Math.max(...ep.map(p => p.y)),
  };
}

/** Signed distance from point (px,py) to the arc stroke. Infinity if cursor angle is outside arc span. */
export function ptToArcDist(px: number, py: number, arc: ArcSpec): number {
  const dx = px - arc.cx, dy = py - arc.cy;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < EPS) return arc.r;
  if (!angleInArcSpan(Math.atan2(dy, dx), arc.startAngle, arc.endAngle, arc.ccw)) return Infinity;
  return Math.abs(d - arc.r);
}

// ── Arc–Line / Arc–Arc intersection ───────────────────────────────────────────

/**
 * Intersect the infinite circle (cx,cy,r) with line segment p1→p2.
 * Returns t values in [0,1] along the segment.
 */
export function circleLineIntersectTs(
  cx: number, cy: number, r: number, p1: Vec2, p2: Vec2
): number[] {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const fx = p1.x - cx,   fy = p1.y - cy;
  const a = dx * dx + dy * dy;
  if (a < EPS) return [];
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return [];
  const sq = Math.sqrt(disc);
  const ts = [(-b - sq) / (2 * a), (-b + sq) / (2 * a)];
  return ts.filter(t => t >= -EPS && t <= 1 + EPS)
           .map(t => Math.max(0, Math.min(1, t)))
           .filter((t, i, arr) => i === 0 || Math.abs(t - arr[i - 1]) > EPS);
}

/** Map a world point on arc1's circle to an angular parameter [0,1] along arc1's sweep. Null if outside span. */
function arcAngularParam(arc: ArcSpec, wx: number, wy: number): number | null {
  const ang = Math.atan2(wy - arc.cy, wx - arc.cx);
  if (!angleInArcSpan(ang, arc.startAngle, arc.endAngle, arc.ccw)) return null;
  const N = Math.PI * 2;
  const norm = (x: number) => ((x % N) + N) % N;
  if (arc.ccw) {
    let span = norm(arc.endAngle) - norm(arc.startAngle); if (span < 0) span += N;
    let off  = norm(ang)          - norm(arc.startAngle); if (off  < 0) off  += N;
    return span < EPS ? 0 : off / span;
  }
  let span = norm(arc.startAngle) - norm(arc.endAngle); if (span < 0) span += N;
  let off  = norm(arc.startAngle) - norm(ang);          if (off  < 0) off  += N;
  return span < EPS ? 0 : off / span;
}

/** Angular [0,1] parameters along `arc` where it intersects a line segment. */
export function arcLineAngularTs(arc: ArcSpec, seg: Seg): number[] {
  const result: number[] = [];
  for (const t of circleLineIntersectTs(arc.cx, arc.cy, arc.r, seg.p1, seg.p2)) {
    const wx = seg.p1.x + t * (seg.p2.x - seg.p1.x);
    const wy = seg.p1.y + t * (seg.p2.y - seg.p1.y);
    const at = arcAngularParam(arc, wx, wy);
    if (at !== null) result.push(at);
  }
  return result;
}

/** Angular [0,1] parameters along `arc1` where it intersects `arc2`. */
export function arcArcAngularTs(arc1: ArcSpec, arc2: ArcSpec): number[] {
  const dx = arc2.cx - arc1.cx, dy = arc2.cy - arc1.cy;
  const d  = Math.sqrt(dx * dx + dy * dy);
  if (d < EPS || d > arc1.r + arc2.r + EPS || d < Math.abs(arc1.r - arc2.r) - EPS) return [];
  const a  = (arc1.r * arc1.r - arc2.r * arc2.r + d * d) / (2 * d);
  const h  = Math.sqrt(Math.max(0, arc1.r * arc1.r - a * a));
  const mx = arc1.cx + a * dx / d, my = arc1.cy + a * dy / d;
  const pts: Vec2[] = h < EPS
    ? [{ x: mx, y: my }]
    : [{ x: mx + h * dy / d, y: my - h * dx / d },
       { x: mx - h * dy / d, y: my + h * dx / d }];
  return pts.flatMap(pt => {
    const at = arcAngularParam(arc1, pt.x, pt.y);
    return at !== null ? [at] : [];
  });
}

/** Trim an arc at angular break-points (t ∈ [0,1]). Returns 0, 1, or 2 arc slices. */
export function trimArcByAngularTs(arc: ArcSpec, ts: number[], clickAngT: number): ArcSpec[] {
  const interior = [...new Set(ts.filter(t => t > EPS && t < 1 - EPS))].sort((a, b) => a - b);
  const breaks   = [0, ...interior, 1];
  const N = Math.PI * 2;
  let span: number;
  if (arc.ccw) { span = arc.endAngle - arc.startAngle; if (span < 0) span += N; }
  else         { span = arc.startAngle - arc.endAngle; if (span < 0) span += N; }
  const angAtT = (t: number) => arc.ccw ? arc.startAngle + t * span : arc.startAngle - t * span;

  for (let i = 0; i < breaks.length - 1; i++) {
    if (clickAngT >= breaks[i] - EPS && clickAngT <= breaks[i + 1] + EPS) {
      const result: ArcSpec[] = [];
      if (breaks[i] > EPS)         result.push({ ...arc, endAngle:   angAtT(breaks[i]) });
      if (breaks[i + 1] < 1 - EPS) result.push({ ...arc, startAngle: angAtT(breaks[i + 1]) });
      return result;
    }
  }
  return [{ ...arc }];
}

/** Extend an arc to the nearest line boundary beyond its start/end. */
export function extendArcToBoundaries(
  arc: ArcSpec, boundaries: Seg[], clickAngT: number
): { newArc: ArcSpec; extendedEnd: boolean } | null {
  const extendEnd = clickAngT > 0.5;
  const N = Math.PI * 2;
  let span: number;
  if (arc.ccw) { span = arc.endAngle - arc.startAngle; if (span < 0) span += N; }
  else         { span = arc.startAngle - arc.endAngle; if (span < 0) span += N; }
  if (span < EPS) return null;

  let bestT: number | null = null;
  for (const seg of boundaries) {
    for (const t of circleLineIntersectTs(arc.cx, arc.cy, arc.r, seg.p1, seg.p2)) {
      const wx  = seg.p1.x + t * (seg.p2.x - seg.p1.x);
      const wy  = seg.p1.y + t * (seg.p2.y - seg.p1.y);
      const ang = Math.atan2(wy - arc.cy, wx - arc.cx);
      const norm = (x: number) => ((x % N) + N) % N;
      let at: number;
      if (arc.ccw) {
        let off = norm(ang) - norm(arc.startAngle); if (off < 0) off += N;
        at = off / span;
      } else {
        let off = norm(arc.startAngle) - norm(ang); if (off < 0) off += N;
        at = off / span;
      }
      if (extendEnd ? at > 1 + EPS : at < -EPS) {
        if (bestT === null || (extendEnd ? at < bestT : at > bestT)) bestT = at;
      }
    }
  }
  if (bestT === null) return null;
  const angAtT = (t: number) => arc.ccw ? arc.startAngle + t * span : arc.startAngle - t * span;
  const newArc = { ...arc };
  if (extendEnd) newArc.endAngle   = angAtT(bestT);
  else           newArc.startAngle = angAtT(bestT);
  return { newArc, extendedEnd: extendEnd };
}

// ── B-Spline / NURBS — De Boor algorithm ──────────────────────────────────────

/**
 * Evaluate a B-spline / NURBS curve at parameter t using De Boor's algorithm.
 * weights=null → non-rational (uniform weight 1).
 */
export function deBoor(
  degree: number, knots: number[], controlPoints: Vec2[],
  weights: number[] | null, t: number
): Vec2 {
  const n = controlPoints.length;
  if (n === 0) return { x: 0, y: 0 };
  if (n === 1) return { ...controlPoints[0] };
  const tMin = knots[degree] ?? 0;
  const tMax = knots[knots.length - 1 - degree] ?? 1;
  t = Math.max(tMin, Math.min(tMax - EPS * 100, t));
  // Find knot span k: largest i where knots[i] <= t, within [degree, len-1-degree-1]
  let k = degree;
  for (let i = degree; i < knots.length - 1 - degree; i++) {
    if (knots[i] <= t) k = i; else break;
  }
  // Homogeneous control points [w*x, w*y, w]
  type H = [number, number, number];
  const d: H[] = [];
  for (let j = 0; j <= degree; j++) {
    const idx = Math.max(0, Math.min(n - 1, k - degree + j));
    const w   = weights ? (weights[idx] ?? 1) : 1;
    d.push([controlPoints[idx].x * w, controlPoints[idx].y * w, w]);
  }
  for (let r = 1; r <= degree; r++) {
    for (let j = degree; j >= r; j--) {
      const i     = k - degree + j;
      // Standard De Boor: alpha = (t - knots[i]) / (knots[i + degree - r + 1] - knots[i])
      const lower = knots[i]                ?? tMin;
      const upper = knots[i + degree - r + 1] ?? tMax;
      const denom = upper - lower;
      const alpha = denom < EPS ? 0 : (t - lower) / denom;
      d[j][0] = (1 - alpha) * d[j - 1][0] + alpha * d[j][0];
      d[j][1] = (1 - alpha) * d[j - 1][1] + alpha * d[j][1];
      d[j][2] = (1 - alpha) * d[j - 1][2] + alpha * d[j][2];
    }
  }
  const w = d[degree][2];
  return w < EPS
    ? { x: d[degree][0], y: d[degree][1] }
    : { x: d[degree][0] / w, y: d[degree][1] / w };
}

/** Build a clamped uniform knot vector for n control points at given degree. */
export function uniformOpenKnots(n: number, degree: number): number[] {
  const knots: number[] = [];
  for (let i = 0; i < n + degree + 1; i++) {
    if (i <= degree)     knots.push(0);
    else if (i >= n)     knots.push(n - degree);
    else                 knots.push(i - degree);
  }
  return knots;
}

/** Sample a B-spline / NURBS curve at `steps` equidistant parameter values. */
export function sampleBSpline(
  degree: number, knots: number[], controlPoints: Vec2[],
  weights: number[] | null, steps: number,
): Vec2[] {
  if (controlPoints.length < 2) return controlPoints.map(p => ({ ...p }));
  const tMin = knots[degree] ?? 0, tMax = knots[knots.length - 1 - degree] ?? 1;
  if (tMax <= tMin + EPS) return controlPoints.map(p => ({ ...p }));
  const pts: Vec2[] = [];
  for (let i = 0; i <= steps; i++)
    pts.push(deBoor(degree, knots, controlPoints, weights, tMin + (i / steps) * (tMax - tMin)));
  return pts;
}

// ── OSNAP geometry helpers ─────────────────────────────────────────────────────

/** Nearest point on the circle boundary (cx,cy,r) to (px,py). */
export function nearestOnCircle(px: number, py: number, cx: number, cy: number, r: number): Vec2 {
  const dx = px - cx, dy = py - cy;
  const d  = Math.sqrt(dx * dx + dy * dy);
  if (d < EPS) return { x: cx + r, y: cy };
  return { x: cx + (dx / d) * r, y: cy + (dy / d) * r };
}

/** Foot of perpendicular from `pt` to the infinite line through p1→p2. */
export function perpFoot(pt: Vec2, p1: Vec2, p2: Vec2): Vec2 {
  return lerp2(p1, p2, nearestT(pt, p1, p2));
}

// ── Line-Line Intersection (Parametric) ────────────────────────────────────────
// L1: P1 + t*(P2-P1),  L2: P3 + u*(P4-P3)
// Returns null if lines are parallel.
export function lineLineIntersect(
  p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2
): { t: number; u: number; x: number; y: number } | null {
  const dx1 = p2.x - p1.x, dy1 = p2.y - p1.y;
  const dx2 = p4.x - p3.x, dy2 = p4.y - p3.y;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < EPS_PAR) return null;
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
  if (len2 < EPS) return 0;
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

// ── Transformation Matrix (3×3 homogeneous, row-major) ────────────────────────
// [a, b, tx]
// [c, d, ty]
// [0, 0,  1]
export interface Mat3 {
  a: number; b: number; tx: number;
  c: number; d: number; ty: number;
}

export function matIdentity(): Mat3 {
  return { a: 1, b: 0, tx: 0, c: 0, d: 1, ty: 0 };
}

export function matTranslate(dx: number, dy: number): Mat3 {
  return { a: 1, b: 0, tx: dx, c: 0, d: 1, ty: dy };
}

export function matRotate(angle: number): Mat3 {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return { a: cos, b: -sin, tx: 0, c: sin, d: cos, ty: 0 };
}

export function matScale(sx: number, sy: number): Mat3 {
  return { a: sx, b: 0, tx: 0, c: 0, d: sy, ty: 0 };
}

export function matMul(m1: Mat3, m2: Mat3): Mat3 {
  return {
    a:  m1.a * m2.a  + m1.b * m2.c,
    b:  m1.a * m2.b  + m1.b * m2.d,
    tx: m1.a * m2.tx + m1.b * m2.ty + m1.tx,
    c:  m1.c * m2.a  + m1.d * m2.c,
    d:  m1.c * m2.b  + m1.d * m2.d,
    ty: m1.c * m2.tx + m1.d * m2.ty + m1.ty,
  };
}

export function matApply(m: Mat3, p: Vec2): Vec2 {
  return { x: m.a * p.x + m.b * p.y + m.tx, y: m.c * p.x + m.d * p.y + m.ty };
}

/** Build a matrix that rotates/scales around a given pivot point. */
export function matAroundPivot(pivot: Vec2, inner: Mat3): Mat3 {
  return matMul(matMul(matTranslate(pivot.x, pivot.y), inner), matTranslate(-pivot.x, -pivot.y));
}

/**
 * Apply a Mat3 transform to a DXF entity (deep-clone first).
 * Handles LINE, CIRCLE, ARC, LWPOLYLINE, POLYLINE, TEXT, MTEXT, INSERT, SPLINE.
 */
export function transformEntity(entity: any, m: Mat3): any {
  const e = JSON.parse(JSON.stringify(entity));
  e._bbox = null;

  const pt  = (v: any) => { const r = matApply(m, { x: v.x ?? 0, y: v.y ?? 0 }); v.x = r.x; v.y = r.y; };
  const scl = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)); // uniform scale factor

  switch (e.type) {
    case 'LINE':
      if (e.vertices?.length >= 2) { pt(e.vertices[0]); pt(e.vertices[1]); }
      break;

    case 'CIRCLE':
      if (e.center) pt(e.center);
      e.radius = (e.radius ?? 0) * scl;
      break;

    case 'ARC': {
      if (e.center) pt(e.center);
      e.radius = (e.radius ?? 0) * scl;
      // Rotate start/end angles by the matrix rotation
      const rot = Math.atan2(m.c, m.a);
      e.startAngle = (e.startAngle ?? 0) + rot;
      e.endAngle   = (e.endAngle   ?? 0) + rot;
      break;
    }

    case 'LWPOLYLINE':
    case 'POLYLINE':
      (e.vertices ?? []).forEach((v: any) => pt(v));
      break;

    case 'TEXT':
    case 'MTEXT':
      if (e.insertionPoint) pt(e.insertionPoint);
      if (e.position)       pt(e.position);
      e.textHeight = (e.textHeight ?? 1) * scl;
      break;

    case 'INSERT':
      if (e.position) pt(e.position);
      e.xScale = (e.xScale ?? 1) * Math.sqrt(m.a * m.a + m.c * m.c);
      e.yScale = (e.yScale ?? 1) * Math.sqrt(m.b * m.b + m.d * m.d);
      e.rotation = (e.rotation ?? 0) + Math.atan2(m.c, m.a) * (180 / Math.PI);
      break;

    case 'SPLINE':
      (e.controlPoints ?? []).forEach((v: any) => pt(v));
      (e.fitPoints     ?? []).forEach((v: any) => pt(v));
      break;

    case 'ELLIPSE':
      if (e.center) pt(e.center);
      if (e.majorAxisEndPoint) {
        const ep = matApply(m, { x: e.majorAxisEndPoint.x ?? 0, y: e.majorAxisEndPoint.y ?? 0 });
        const o  = matApply(m, { x: 0, y: 0 });
        e.majorAxisEndPoint.x = ep.x - o.x;
        e.majorAxisEndPoint.y = ep.y - o.y;
      }
      break;
  }

  return e;
}

/** Mirror a DXF entity across the line from (x1,y1) to (x2,y2). */
export function mirrorEntityAcrossLine(entity: any, x1: number, y1: number, x2: number, y2: number): any {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx*dx + dy*dy;
  if (len2 < 1e-10) return JSON.parse(JSON.stringify(entity));
  const cos2 = (dx*dx - dy*dy) / len2;
  const sin2 = 2*dx*dy / len2;

  const e = JSON.parse(JSON.stringify(entity));
  e._bbox = null;

  const mirrorPt = (v: any) => {
    const rx = cos2*(v.x - x1) + sin2*(v.y - y1) + x1;
    const ry = sin2*(v.x - x1) - cos2*(v.y - y1) + y1;
    v.x = rx; v.y = ry;
  };
  const mirrorAngle = Math.atan2(dy, dx);
  const reflDeg = (a: number) => (2 * mirrorAngle - a * Math.PI / 180) * 180 / Math.PI;

  switch (e.type) {
    case 'LINE':
      if (e.vertices?.length >= 2) { mirrorPt(e.vertices[0]); mirrorPt(e.vertices[1]); }
      break;
    case 'CIRCLE':
      if (e.center) mirrorPt(e.center);
      break;
    case 'ARC': {
      if (e.center) mirrorPt(e.center);
      const sa = e.startAngle ?? 0, ea = e.endAngle ?? 0;
      e.startAngle = reflDeg(ea);
      e.endAngle   = reflDeg(sa);
      break;
    }
    case 'LWPOLYLINE':
    case 'POLYLINE':
      (e.vertices ?? []).forEach((v: any) => mirrorPt(v));
      break;
    case 'TEXT':
    case 'MTEXT':
      if (e.insertionPoint) mirrorPt(e.insertionPoint);
      if (e.position) mirrorPt(e.position);
      if (e.rotation !== undefined) e.rotation = reflDeg(e.rotation);
      break;
    case 'INSERT':
      if (e.position) mirrorPt(e.position);
      if (e.rotation !== undefined) e.rotation = reflDeg(e.rotation);
      break;
    case 'SPLINE':
      (e.controlPoints ?? []).forEach((v: any) => mirrorPt(v));
      (e.fitPoints ?? []).forEach((v: any) => mirrorPt(v));
      break;
    case 'ELLIPSE':
      if (e.center) mirrorPt(e.center);
      if (e.majorAxisEndPoint) {
        const vx = e.majorAxisEndPoint.x ?? 0, vy = e.majorAxisEndPoint.y ?? 0;
        e.majorAxisEndPoint.x = cos2 * vx + sin2 * vy;
        e.majorAxisEndPoint.y = sin2 * vx - cos2 * vy;
      }
      break;
  }
  return e;
}
