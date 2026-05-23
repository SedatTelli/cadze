import { Application, Graphics, Container, Text, TextStyle } from 'pixi.js';

export type Tool = 'pan' | 'zoom-window' | 'measure' | 'note' | 'angle-measure' | 'area-measure' | 'trim' | 'extend' | 'offset';
export type SnapType = 'endpoint' | 'midpoint' | 'center' | 'none';

export interface SnapPoint { x: number; y: number; type: SnapType; }

export interface RendererState {
  app: Application;
  scene: Container;
  setTool: (tool: Tool) => void;
  getTool: () => Tool;
  clearMeasure: () => void;
  setBg: (dark: boolean) => void;
  zoomBy: (factor: number) => void;
  setOsnap: (on: boolean) => void;
  getSnap: () => SnapPoint | null;
  getHovered: () => any | null;
  getSelected: () => any | null;
  setSelected: (e: any | null) => void;
  getSelectedSet: () => Set<any>;
  setSelectedSet: (s: Set<any>) => void;
  clearSelection: () => void;
  onCoordUpdate: (x: number, y: number) => void;
  onZoomUpdate: (z: number) => void;
  onEntityClick: (entity: any | null) => void;
  onMeasureResult: (dist: number, dx: number, dy: number) => void;
  onNotePlace: (scx: number, scy: number, sx: number, sy: number) => void;
  onAngleResult: (deg: number) => void;
  onAreaResult: (area: number, perimeter: number) => void;
  onFps: (fps: number) => void;
  onSelectionChange: (entities: any[]) => void;
  onToolAction?: (tool: Tool, entity: any, worldX: number, worldY: number) => void;
}

export interface AABB {
  minX: number; minY: number; maxX: number; maxY: number;
}

// ── ACI 256 color table ────────────────────────────────────────────────────────

const ENTITY_COLOR = 0xe8e8f0;
const BG_DARK  = 0x121214;
const BG_LIGHT = 0xf5f5f8;

const SEL_COLOR   = 0x00e5ff;  // selected entity highlight
const HOVER_COLOR = 0xffdd00;  // hover highlight

function hsvToHex(h: number, s: number, v: number): number {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  let r = 0, g = 0, b = 0;
  switch (i % 6) {
    case 0: r=v; g=t; b=p; break; case 1: r=q; g=v; b=p; break;
    case 2: r=p; g=v; b=t; break; case 3: r=p; g=q; b=v; break;
    case 4: r=t; g=p; b=v; break; case 5: r=v; g=p; b=q; break;
  }
  return ((r * 255 | 0) << 16) | ((g * 255 | 0) << 8) | (b * 255 | 0);
}

const ACI_TABLE: number[] = (() => {
  const t = new Array(256).fill(ENTITY_COLOR);
  t[1]=0xff0000; t[2]=0xffff00; t[3]=0x00ff00;
  t[4]=0x00ffff; t[5]=0x0000ff; t[6]=0xff00ff;
  t[7]=0xffffff; t[8]=0x808080; t[9]=0xc0c0c0;
  const sArr = [1,0.5,1,0.5,1,0.5,1,0.5,1,0.5];
  const vArr = [1,1,0.65,0.65,0.5,0.5,0.35,0.35,0.15,0.15];
  for (let i = 0; i < 240; i++) {
    const hue = (Math.floor(i / 10) * 15) / 360;
    const vi  = i % 10;
    t[10 + i] = hsvToHex(hue, sArr[vi], vArr[vi]);
  }
  [0x333333,0x505050,0x696969,0x828282,0xafafaf,0xc8c8c8].forEach((c,i) => { t[250+i]=c; });
  return t;
})();

function aciToHex(colorIndex?: number): number {
  if (!colorIndex) return ENTITY_COLOR;
  return ACI_TABLE[colorIndex] ?? ENTITY_COLOR;
}

// ── Quadtree spatial index ─────────────────────────────────────────────────────

function aabbIntersects(a: AABB, b: AABB): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}
function aabbContains(outer: AABB, inner: AABB): boolean {
  return inner.minX >= outer.minX && inner.maxX <= outer.maxX &&
         inner.minY >= outer.minY && inner.maxY <= outer.maxY;
}
function ptInAABB(x: number, y: number, r: number, b: AABB): boolean {
  return x + r >= b.minX && x - r <= b.maxX && y + r >= b.minY && y - r <= b.maxY;
}

class QuadTree {
  private static MAX_ITEMS = 12;
  private static MAX_DEPTH = 9;
  private items: Array<{ entity: any; bbox: AABB }> = [];
  private children: [QuadTree,QuadTree,QuadTree,QuadTree] | null = null;

  constructor(private bounds: AABB, private depth = 0) {}

  insert(entity: any, bbox: AABB): void {
    if (!aabbIntersects(this.bounds, bbox)) return;
    if (this.children) {
      for (const c of this.children) c.insert(entity, bbox);
      return;
    }
    this.items.push({ entity, bbox });
    if (this.items.length > QuadTree.MAX_ITEMS && this.depth < QuadTree.MAX_DEPTH) {
      this.subdivide();
    }
  }

  private subdivide(): void {
    const { minX, minY, maxX, maxY } = this.bounds;
    const mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
    this.children = [
      new QuadTree({ minX, minY, maxX: mx, maxY: my }, this.depth + 1),
      new QuadTree({ minX: mx, minY, maxX, maxY: my }, this.depth + 1),
      new QuadTree({ minX, minY: my, maxX: mx, maxY }, this.depth + 1),
      new QuadTree({ minX: mx, minY: my, maxX, maxY }, this.depth + 1),
    ];
    const old = this.items; this.items = [];
    for (const { entity, bbox } of old)
      for (const c of this.children!) c.insert(entity, bbox);
  }

  query(bbox: AABB, out: Set<any> = new Set()): Set<any> {
    if (!aabbIntersects(this.bounds, bbox)) return out;
    for (const { entity, bbox: eb } of this.items)
      if (aabbIntersects(bbox, eb)) out.add(entity);
    if (this.children) for (const c of this.children) c.query(bbox, out);
    return out;
  }

  queryPoint(x: number, y: number, r: number): any[] {
    if (!ptInAABB(x, y, r, this.bounds)) return [];
    const b: AABB = { minX: x-r, minY: y-r, maxX: x+r, maxY: y+r };
    return Array.from(this.query(b));
  }
}

// ── Entity bounding box ────────────────────────────────────────────────────────

export function computeEntityBBox(entity: any): AABB | null {
  switch (entity.type) {
    case 'LINE': {
      const v = entity.vertices;
      if (!v?.length || v.length < 2) return null;
      return { minX: Math.min(v[0].x,v[1].x), minY: Math.min(v[0].y,v[1].y),
               maxX: Math.max(v[0].x,v[1].x), maxY: Math.max(v[0].y,v[1].y) };
    }
    case 'CIRCLE': case 'ARC': {
      const c = entity.center, r = entity.radius || 0;
      if (!c) return null;
      return { minX: c.x-r, minY: c.y-r, maxX: c.x+r, maxY: c.y+r };
    }
    case 'LWPOLYLINE': case 'POLYLINE': {
      const v = entity.vertices;
      if (!v?.length) return null;
      let mnX=Infinity,mnY=Infinity,mxX=-Infinity,mxY=-Infinity;
      for (const p of v) {
        if(p.x<mnX)mnX=p.x; if(p.x>mxX)mxX=p.x;
        if(p.y<mnY)mnY=p.y; if(p.y>mxY)mxY=p.y;
      }
      return isFinite(mnX) ? { minX:mnX, minY:mnY, maxX:mxX, maxY:mxY } : null;
    }
    case 'ELLIPSE': {
      const c = entity.center;
      if (!c) return null;
      const rx = Math.sqrt((entity.majorAxisEndPoint?.x??0)**2+(entity.majorAxisEndPoint?.y??0)**2);
      const r = Math.max(rx, rx*(entity.axisRatio??1));
      return { minX:c.x-r, minY:c.y-r, maxX:c.x+r, maxY:c.y+r };
    }
    case 'SPLINE': {
      const pts = entity.controlPoints ?? entity.fitPoints;
      if (!pts?.length) return null;
      let mnX=Infinity,mnY=Infinity,mxX=-Infinity,mxY=-Infinity;
      for (const p of pts) {
        if(p.x<mnX)mnX=p.x; if(p.x>mxX)mxX=p.x;
        if(p.y<mnY)mnY=p.y; if(p.y>mxY)mxY=p.y;
      }
      return isFinite(mnX) ? { minX:mnX, minY:mnY, maxX:mxX, maxY:mxY } : null;
    }
    case 'TEXT': case 'MTEXT': {
      const p = entity.position ?? entity.insertionPoint;
      if (!p) return null;
      const h = entity.textHeight || 2.5;
      return { minX:p.x, minY:p.y, maxX:p.x+h*10, maxY:p.y+h };
    }
    case 'INSERT': {
      const p = entity.position;
      if (!p) return null;
      return { minX:p.x-1, minY:p.y-1, maxX:p.x+1, maxY:p.y+1 };
    }
    default: return null;
  }
}

// ── Entity highlight overlay ───────────────────────────────────────────────────

function drawEntityHighlight(
  g: Graphics, entity: any, color: number,
  scx: number, scy: number, ox: number, oy: number,
): void {
  const sx = (wx: number) => wx * scx + ox;
  const sy = (wy: number) => -wy * scy + oy;
  const W = 2.5;
  switch (entity.type) {
    case 'LINE': {
      const v = entity.vertices;
      if (v?.length >= 2)
        g.moveTo(sx(v[0].x),sy(v[0].y)).lineTo(sx(v[1].x),sy(v[1].y))
         .stroke({ color, width: W });
      break;
    }
    case 'CIRCLE': {
      const c = entity.center;
      if (c) g.circle(sx(c.x), sy(c.y), entity.radius*scx).stroke({ color, width: W });
      break;
    }
    case 'ARC': {
      const c = entity.center;
      if (c) g.arc(sx(c.x), sy(c.y), entity.radius*scx,
                   -(entity.startAngle??0), -(entity.endAngle??0), true)
               .stroke({ color, width: W });
      break;
    }
    case 'LWPOLYLINE': case 'POLYLINE': {
      const v = entity.vertices;
      if (!v?.length) break;
      g.moveTo(sx(v[0].x), sy(v[0].y));
      for (let i=1;i<v.length;i++) g.lineTo(sx(v[i].x), sy(v[i].y));
      if (entity.closed) g.closePath();
      g.stroke({ color, width: W });
      break;
    }
    case 'ELLIPSE': {
      const c = entity.center;
      if (!c) break;
      const rx = Math.sqrt((entity.majorAxisEndPoint?.x??0)**2+(entity.majorAxisEndPoint?.y??0)**2);
      const ry = rx*(entity.axisRatio??1);
      const rot = Math.atan2(entity.majorAxisEndPoint?.y??0, entity.majorAxisEndPoint?.x??0);
      const steps = 48;
      for (let i=0;i<=steps;i++) {
        const a=(i/steps)*Math.PI*2;
        const ex=Math.cos(a)*rx, ey=Math.sin(a)*ry;
        const wx=c.x+ex*Math.cos(rot)-ey*Math.sin(rot);
        const wy=c.y+ex*Math.sin(rot)+ey*Math.cos(rot);
        i===0 ? g.moveTo(sx(wx),sy(wy)) : g.lineTo(sx(wx),sy(wy));
      }
      g.stroke({ color, width: W });
      break;
    }
    case 'SPLINE': {
      const pts = entity.controlPoints ?? entity.fitPoints;
      if (!pts?.length) break;
      g.moveTo(sx(pts[0].x), sy(pts[0].y));
      for (let i=1;i<pts.length;i++) g.lineTo(sx(pts[i].x), sy(pts[i].y));
      g.stroke({ color, width: W });
      break;
    }
    case 'INSERT': {
      const p = entity.position;
      if (!p) break;
      const s = 4;
      g.rect(sx(p.x)-s, sy(p.y)-s, s*2, s*2).stroke({ color, width: W });
      break;
    }
  }
}

// ── createRenderer ────────────────────────────────────────────────────────────

export async function createRenderer(container: HTMLElement): Promise<RendererState> {
  const app = new Application();
  await app.init({
    width: container.clientWidth,
    height: container.clientHeight,
    backgroundColor: BG_DARK,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio, 2),
    autoDensity: true,
  });

  container.appendChild(app.canvas);

  const scene   = new Container();
  app.stage.addChild(scene);
  const overlay = new Graphics();
  app.stage.addChild(overlay);

  new ResizeObserver(() => {
    app.renderer.resize(container.clientWidth, container.clientHeight);
  }).observe(container);

  // ── Tool state ──────────────────────────────────────────────────────────────
  let currentTool: Tool = 'pan';
  let osnapEnabled = true;

  let isPanning   = false;
  let panStarted  = false;
  let lastPan     = { x: 0, y: 0 };
  let mouseDownPos = { x: 0, y: 0 };
  const PAN_THRESHOLD = 5;

  // Zoom window tool
  let zoomStart: { x: number; y: number } | null = null;
  let zoomRect:  { x: number; y: number; w: number; h: number } | null = null;

  // Selection box (pan tool, drag on empty space)
  let selBoxStart: { x: number; y: number } | null = null;
  let selBoxRect:  { x: number; y: number; w: number; h: number } | null = null;
  let mouseDownOnEntity: any | null = null;  // entity under cursor at mousedown

  // Measure tools
  let measurePt1: { scx: number; scy: number } | null = null;
  let anglePts: { scx: number; scy: number }[] = [];
  let areaPts:  { scx: number; scy: number }[] = [];
  const measureSegs: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  let mouseScreen = { x: 0, y: 0 };

  let snapPoint:      SnapPoint | null = null;
  let hoveredEntity:  any | null = null;
  let selectedEntity: any | null = null;
  const selectedEntities = new Set<any>();

  let spatialEntities: any[] = [];
  let quadTree: QuadTree | null = null;
  let visLayersRef = new Set<string>();

  // FPS
  let fpsFrames = 0, fpsLast = performance.now();

  const state: RendererState = {
    app, scene,
    setTool(tool) {
      currentTool = tool;
      if (tool === 'pan') {
        app.canvas.style.cursor = 'default';
        measurePt1 = null; zoomStart = null; zoomRect = null;
        selBoxStart = null; selBoxRect = null;
        anglePts = []; areaPts = [];
      } else {
        app.canvas.style.cursor = 'crosshair';
        if (tool !== 'measure')       measurePt1 = null;
        if (tool !== 'angle-measure') anglePts = [];
        if (tool !== 'area-measure')  areaPts = [];
      }
    },
    getTool:      () => currentTool,
    clearMeasure: () => { measurePt1 = null; measureSegs.length = 0; anglePts = []; areaPts = []; },
    setBg:        (dark) => { app.renderer.background.color = dark ? BG_DARK : BG_LIGHT; },
    setOsnap:     (on)   => { osnapEnabled = on; },
    getSnap:      () => snapPoint,
    getHovered:   () => hoveredEntity,
    getSelected:  () => selectedEntity,
    setSelected:  (e) => { selectedEntity = e; },
    getSelectedSet: () => selectedEntities,
    setSelectedSet(s) {
      selectedEntities.clear();
      for (const e of s) selectedEntities.add(e);
      selectedEntity = s.size === 1 ? [...s][0] : null;
      state.onSelectionChange([...selectedEntities]);
    },
    clearSelection() {
      selectedEntities.clear();
      selectedEntity = null;
      state.onSelectionChange([]);
    },
    zoomBy(factor) {
      const cx = app.renderer.width / 2, cy = app.renderer.height / 2;
      scene.x = cx + (scene.x - cx) * factor;
      scene.y = cy + (scene.y - cy) * factor;
      scene.scale.x *= factor; scene.scale.y *= factor;
      state.onZoomUpdate(Math.round(1 / scene.scale.x * 100));
    },
    onCoordUpdate:    () => {},
    onZoomUpdate:     () => {},
    onEntityClick:    () => {},
    onMeasureResult:  () => {},
    onNotePlace:      () => {},
    onAngleResult:    () => {},
    onAreaResult:     () => {},
    onFps:            () => {},
    onSelectionChange:() => {},
  };

  // ── Overlay ticker ──────────────────────────────────────────────────────────
  app.ticker.add(() => {
    fpsFrames++;
    const now = performance.now();
    if (now - fpsLast >= 1000) { state.onFps(fpsFrames); fpsFrames = 0; fpsLast = now; }

    overlay.clear();
    const scx = scene.scale.x, scy = scene.scale.y;
    const ox = scene.x, oy = scene.y;
    const toSX = (x: number) => x * scx + ox;
    const toSY = (y: number) => y * scy + oy;  // scene Y (already negated)

    // ── Selected entities highlight ──────────────────────────────────────────
    if (selectedEntities.size > 0) {
      for (const e of selectedEntities) {
        drawEntityHighlight(overlay, e, SEL_COLOR, scx, scy, ox, oy);
      }
      // Selection grip points
      for (const e of selectedEntities) {
        const bbox = (e as any)._bbox as AABB | undefined;
        if (!bbox) continue;
        const cx2 = (bbox.minX+bbox.maxX)/2, cy2 = (bbox.minY+bbox.maxY)/2;
        overlay.circle(toSX(cx2), toSY(-cy2), 4)
               .fill({ color: SEL_COLOR }).stroke({ color: 0x001a22, width: 1 });
      }
    }

    // ── Hover entity highlight ────────────────────────────────────────────────
    if (hoveredEntity && !selectedEntities.has(hoveredEntity)) {
      drawEntityHighlight(overlay, hoveredEntity, HOVER_COLOR, scx, scy, ox, oy);
    }

    // ── Measure segments ──────────────────────────────────────────────────────
    for (const s of measureSegs) {
      overlay.moveTo(toSX(s.x1), toSY(-s.y1)).lineTo(toSX(s.x2), toSY(-s.y2))
             .stroke({ color: 0x00ff88, width: 1.5 });
      overlay.circle(toSX(s.x1), toSY(-s.y1), 3).fill({ color: 0x00ff88 });
      overlay.circle(toSX(s.x2), toSY(-s.y2), 3).fill({ color: 0x00ff88 });
    }
    if (currentTool === 'measure' && measurePt1) {
      const sx1 = toSX(measurePt1.scx), sy1 = toSY(measurePt1.scy);
      overlay.circle(sx1, sy1, 4).fill({ color: 0x00e5ff, alpha: 0.9 });
      overlay.moveTo(sx1, sy1).lineTo(mouseScreen.x, mouseScreen.y)
             .stroke({ color: 0x00e5ff, width: 1, alpha: 0.7 });
    }

    // ── Angle measure ─────────────────────────────────────────────────────────
    if (currentTool === 'angle-measure' && anglePts.length > 0) {
      for (const p of anglePts)
        overlay.circle(toSX(p.scx), toSY(p.scy), 4).fill({ color: 0xffaa00 });
      if (anglePts.length === 1) {
        overlay.moveTo(toSX(anglePts[0].scx), toSY(anglePts[0].scy))
               .lineTo(mouseScreen.x, mouseScreen.y)
               .stroke({ color: 0xffaa00, width: 1, alpha: 0.7 });
      } else if (anglePts.length === 2) {
        overlay.moveTo(toSX(anglePts[0].scx), toSY(anglePts[0].scy))
               .lineTo(toSX(anglePts[1].scx), toSY(anglePts[1].scy))
               .stroke({ color: 0xffaa00, width: 1 });
        overlay.moveTo(toSX(anglePts[1].scx), toSY(anglePts[1].scy))
               .lineTo(mouseScreen.x, mouseScreen.y)
               .stroke({ color: 0xffaa00, width: 1, alpha: 0.7 });
      }
    }

    // ── Area measure ──────────────────────────────────────────────────────────
    if (currentTool === 'area-measure' && areaPts.length > 0) {
      for (let i=0;i<areaPts.length;i++) {
        const a=areaPts[i], b=areaPts[(i+1)%areaPts.length];
        overlay.moveTo(toSX(a.scx),toSY(a.scy)).lineTo(toSX(b.scx),toSY(b.scy))
               .stroke({ color: 0xcc44ff, width: 1 });
        overlay.circle(toSX(a.scx),toSY(a.scy),3).fill({ color: 0xcc44ff });
      }
      const last = areaPts[areaPts.length-1];
      overlay.moveTo(toSX(last.scx),toSY(last.scy)).lineTo(mouseScreen.x,mouseScreen.y)
             .stroke({ color: 0xcc44ff, width: 1, alpha: 0.6 });
    }

    // ── Zoom window rect ──────────────────────────────────────────────────────
    if (currentTool === 'zoom-window' && zoomRect) {
      overlay.rect(zoomRect.x, zoomRect.y, zoomRect.w, zoomRect.h)
             .stroke({ color: 0x00e5ff, width: 1 })
             .fill({ color: 0x00e5ff, alpha: 0.04 });
    }

    // ── Selection box ─────────────────────────────────────────────────────────
    if (selBoxRect && (Math.abs(selBoxRect.w) > 4 || Math.abs(selBoxRect.h) > 4)) {
      const bx = selBoxRect.w < 0 ? selBoxStart!.x + selBoxRect.w : selBoxStart!.x;
      const by = selBoxRect.h < 0 ? selBoxStart!.y + selBoxRect.h : selBoxStart!.y;
      const bw = Math.abs(selBoxRect.w), bh = Math.abs(selBoxRect.h);
      const crossing = selBoxRect.w < 0;
      if (crossing) {
        // Right-to-left crossing: dashed green
        overlay.rect(bx,by,bw,bh).stroke({ color: 0x00ff88, width: 1 })
               .fill({ color: 0x00ff44, alpha: 0.05 });
      } else {
        // Left-to-right window: solid blue
        overlay.rect(bx,by,bw,bh).stroke({ color: 0x0088ff, width: 1 })
               .fill({ color: 0x0044ff, alpha: 0.06 });
      }
    }

    // ── OSNAP indicator ───────────────────────────────────────────────────────
    if (snapPoint && snapPoint.type !== 'none' && currentTool !== 'pan' && currentTool !== 'zoom-window') {
      const sx = toSX(snapPoint.x), sy2 = toSY(-snapPoint.y);
      if (snapPoint.type === 'endpoint') {
        overlay.rect(sx-5,sy2-5,10,10).stroke({ color: 0x00ff88, width: 1.5 });
      } else if (snapPoint.type === 'midpoint') {
        overlay.moveTo(sx-6,sy2+5).lineTo(sx,sy2-5).lineTo(sx+6,sy2+5).closePath()
               .stroke({ color: 0xffdd00, width: 1.5 });
      } else if (snapPoint.type === 'center') {
        overlay.circle(sx,sy2,6).stroke({ color: 0x00aaff, width: 1.5 });
        overlay.circle(sx,sy2,1.5).fill({ color: 0x00aaff });
      }
    }
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const canvasPos = (e: MouseEvent) => {
    const r = app.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const toScene = (sx: number, sy: number) => ({
    scx: (sx - scene.x) / scene.scale.x,
    scy: (sy - scene.y) / scene.scale.y,
  });
  const resolvedScene = (sc: { scx: number; scy: number }) => {
    if (osnapEnabled && snapPoint && snapPoint.type !== 'none')
      return { scx: snapPoint.x, scy: -snapPoint.y };
    return { scx: sc.scx, scy: sc.scy };
  };

  // ── Mouse events ───────────────────────────────────────────────────────────
  app.canvas.addEventListener('contextmenu', e => e.preventDefault());

  app.canvas.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault();
    let f: number;
    if (e.ctrlKey) {
      // Touchpad pinch — deltaY is tiny (±1..±10), make it sensitive
      const raw = e.deltaY * (e.deltaMode === 1 ? 15 : 1);
      f = 1 - raw * 0.025;
      f = Math.max(0.75, Math.min(1.35, f));
    } else {
      // Regular scroll wheel or touchpad two-finger scroll
      const delta = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
      f = delta < 0 ? 1.12 : 1 / 1.12;
    }
    const { x: px, y: py } = canvasPos(e);
    scene.x = px + (scene.x - px) * f;
    scene.y = py + (scene.y - py) * f;
    scene.scale.x *= f; scene.scale.y *= f;
    state.onZoomUpdate(Math.round(1 / scene.scale.x * 100));
  }, { passive: false });

  app.canvas.addEventListener('mousedown', (e: MouseEvent) => {
    const { x: sx, y: sy } = canvasPos(e);

    // Middle button: always pan
    if (e.button === 1) {
      panStarted = true; isPanning = false;
      mouseDownPos = { x: e.clientX, y: e.clientY };
      lastPan      = { x: e.clientX, y: e.clientY };
      return;
    }

    if (e.button === 0) {
      if (currentTool === 'pan') {
        mouseDownPos = { x: e.clientX, y: e.clientY };
        lastPan      = { x: e.clientX, y: e.clientY };
        const sceneX = (sx - scene.x) / scene.scale.x;
        const sceneY = (sy - scene.y) / scene.scale.y;
        const tol = 8 / scene.scale.x;
        mouseDownOnEntity = hitTestEntities(sceneX, -sceneY, spatialEntities, tol, quadTree);
        if (mouseDownOnEntity !== null) {
          panStarted = true; isPanning = false;
        } else if (e.shiftKey) {
          // Shift + drag on empty space = selection box
          selBoxStart = { x: sx, y: sy };
          selBoxRect  = { x: sx, y: sy, w: 0, h: 0 };
        } else {
          // Plain drag on empty space = pan
          panStarted = true; isPanning = false;
        }
      } else if (currentTool === 'zoom-window') {
        zoomStart = { x: sx, y: sy };
        zoomRect  = { x: sx, y: sy, w: 0, h: 0 };
      } else if (currentTool === 'measure') {
        const sc = resolvedScene(toScene(sx, sy));
        if (!measurePt1) {
          measurePt1 = sc;
        } else {
          const dx = sc.scx - measurePt1.scx, dy = sc.scy - measurePt1.scy;
          measureSegs.push({ x1: measurePt1.scx, y1: measurePt1.scy, x2: sc.scx, y2: sc.scy });
          state.onMeasureResult(Math.sqrt(dx*dx+dy*dy), Math.abs(dx), Math.abs(dy));
          measurePt1 = sc;
        }
      } else if (currentTool === 'angle-measure') {
        const sc = resolvedScene(toScene(sx, sy));
        anglePts.push(sc);
        if (anglePts.length === 3) {
          const [p1,p2,p3] = anglePts;
          const a1 = Math.atan2(p1.scy-p2.scy, p1.scx-p2.scx);
          const a2 = Math.atan2(p3.scy-p2.scy, p3.scx-p2.scx);
          let deg = Math.abs((a2-a1)*180/Math.PI);
          if (deg > 180) deg = 360 - deg;
          state.onAngleResult(deg);
          anglePts = [];
        }
      } else if (currentTool === 'area-measure') {
        const sc = resolvedScene(toScene(sx, sy));
        if (e.detail === 2 && areaPts.length >= 3) {
          let area = 0, perim = 0;
          const n = areaPts.length;
          for (let i=0;i<n;i++) {
            const j=(i+1)%n;
            area += areaPts[i].scx*areaPts[j].scy - areaPts[j].scx*areaPts[i].scy;
            const ddx=areaPts[j].scx-areaPts[i].scx, ddy=areaPts[j].scy-areaPts[i].scy;
            perim += Math.sqrt(ddx*ddx+ddy*ddy);
          }
          state.onAreaResult(Math.abs(area)/2, perim);
          areaPts = [];
        } else {
          areaPts.push(sc);
        }
      } else if (currentTool === 'note') {
        const sc = toScene(sx, sy);
        state.onNotePlace(sc.scx, sc.scy, sx, sy);
      }
    }

    if (e.button === 2) { measurePt1 = null; anglePts = []; areaPts = []; }
  });

  window.addEventListener('mousemove', (e: MouseEvent) => {
    const { x: sx, y: sy } = canvasPos(e);
    mouseScreen = { x: sx, y: sy };

    // Pan
    if (panStarted) {
      const dx = e.clientX - mouseDownPos.x, dy = e.clientY - mouseDownPos.y;
      if (!isPanning && Math.sqrt(dx*dx+dy*dy) > PAN_THRESHOLD) {
        isPanning = true;
        app.canvas.style.cursor = 'grabbing';
      }
      if (isPanning) {
        scene.x += e.clientX - lastPan.x;
        scene.y += e.clientY - lastPan.y;
        lastPan = { x: e.clientX, y: e.clientY };
      }
    }

    // Zoom window rect
    if (zoomStart)
      zoomRect = { x: zoomStart.x, y: zoomStart.y, w: sx-zoomStart.x, h: sy-zoomStart.y };

    // Selection box
    if (selBoxStart)
      selBoxRect = { x: selBoxStart.x, y: selBoxStart.y, w: sx-selBoxStart.x, h: sy-selBoxStart.y };

    const sceneX = (sx - scene.x) / scene.scale.x;
    const sceneY = (sy - scene.y) / scene.scale.y;

    // OSNAP
    if (osnapEnabled && currentTool !== 'pan' && currentTool !== 'zoom-window') {
      const r = 15 / scene.scale.x;
      snapPoint = findSnapPoint(sceneX, -sceneY, spatialEntities, r, quadTree);
    } else {
      snapPoint = null;
    }

    // Hover
    if (currentTool === 'pan' && !isPanning) {
      const tol = 5 / scene.scale.x;
      const hit = hitTestEntities(sceneX, -sceneY, spatialEntities, tol, quadTree);
      if (hit !== hoveredEntity) {
        hoveredEntity = hit;
        app.canvas.style.cursor = hit ? 'pointer' : 'default';
      }
    }

    state.onCoordUpdate(sceneX, -sceneY);
  });

  window.addEventListener('mouseup', (e: MouseEvent) => {
    // Pan release
    if (panStarted) {
      panStarted = false;
      if (isPanning) {
        isPanning = false;
        app.canvas.style.cursor = currentTool === 'pan' ? 'default' : 'crosshair';
      } else if (currentTool === 'pan' && e.button === 0) {
        // Click = single/multi select
        const hit = mouseDownOnEntity;
        if (e.shiftKey) {
          if (hit) {
            if (selectedEntities.has(hit)) selectedEntities.delete(hit);
            else selectedEntities.add(hit);
          }
        } else {
          selectedEntities.clear();
          if (hit) selectedEntities.add(hit);
        }
        selectedEntity = hit;
        state.onEntityClick(hit);
        state.onSelectionChange([...selectedEntities]);
      }
      mouseDownOnEntity = null;
    }

    // Zoom window release
    if (zoomStart && zoomRect) {
      const { x, y, w, h } = zoomRect;
      const aw = Math.abs(w), ah = Math.abs(h);
      if (aw > 8 && ah > 8) {
        const rx = w<0?x+w:x, ry = h<0?y+h:y;
        const s1 = toScene(rx,ry), s2 = toScene(rx+aw,ry+ah);
        const ww = s2.scx-s1.scx, wh2 = s2.scy-s1.scy;
        const W = app.renderer.width, H = app.renderer.height;
        const ns = Math.min(W/ww, H/wh2) * 0.92;
        scene.scale.set(ns);
        scene.x = W/2 - (s1.scx+ww/2)*ns;
        scene.y = H/2 - (s1.scy+wh2/2)*ns;
        state.onZoomUpdate(Math.round(1/ns*100));
      }
      zoomStart = null; zoomRect = null;
    }

    // Selection box release
    if (selBoxStart && selBoxRect) {
      const { w, h } = selBoxRect;
      if (Math.abs(w) > 8 && Math.abs(h) > 8) {
        const crossing = w < 0;
        const bx = w<0 ? selBoxStart.x+w : selBoxStart.x;
        const by = h<0 ? selBoxStart.y+h : selBoxStart.y;
        const bw = Math.abs(w), bh = Math.abs(h);
        const s1 = toScene(bx,by), s2 = toScene(bx+bw,by+bh);
        const worldBox: AABB = {
          minX: Math.min(s1.scx,s2.scx), maxX: Math.max(s1.scx,s2.scx),
          minY: Math.min(-s1.scy,-s2.scy), maxY: Math.max(-s1.scy,-s2.scy),
        };
        const picked = selectInBox(spatialEntities, worldBox, crossing, visLayersRef);
        if (!e.shiftKey) selectedEntities.clear();
        for (const en of picked) selectedEntities.add(en);
        selectedEntity = selectedEntities.size === 1 ? [...selectedEntities][0] : null;
        state.onSelectionChange([...selectedEntities]);
      } else if (!e.shiftKey) {
        // Click on empty space without shift: deselect all
        selectedEntities.clear();
        selectedEntity = null;
        state.onEntityClick(null);
        state.onSelectionChange([]);
      }
      selBoxStart = null; selBoxRect = null;
    }

    // Edit tool actions: TRIM, EXTEND, OFFSET
    if ((currentTool === 'trim' || currentTool === 'extend' || currentTool === 'offset')
        && e.button === 0 && !isPanning) {
      const { x: sx, y: sy } = canvasPos(e);
      const wx = (sx - scene.x) / scene.scale.x;
      const wy = -((sy - scene.y) / scene.scale.y);
      const tol = 8 / scene.scale.x;
      const hit = hitTestEntities(wx, wy, spatialEntities, tol, quadTree);
      if (hit) state.onToolAction?.(currentTool, hit, wx, wy);
    }
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      measurePt1 = null; zoomStart = null; zoomRect = null;
      anglePts = []; areaPts = [];
      selBoxStart = null; selBoxRect = null;
    }
  });

  // Allow renderDxf to inject spatial data
  (state as any)._setSpatial = (ents: any[], qt: QuadTree | null, vl: Set<string>) => {
    spatialEntities = ents;
    quadTree = qt;
    visLayersRef = vl;
  };

  return state;
}

// ── Rendering ──────────────────────────────────────────────────────────────────

const MAX_ENTITIES_FULL = 50_000;

const LINETYPES: Record<string, number[]> = {
  DASHED:   [8,4],  DASHED2:  [4,2],  DASHEDX2: [16,8],
  HIDDEN:   [4,2],  HIDDEN2:  [2,1],
  CENTER:   [16,4,4,4],  CENTER2: [8,2,2,2],
  PHANTOM:  [20,4,4,4,4,4],
  DOT:      [0,4],  DIVIDE:   [12,4,0,4],
};

const LW_MAP: Record<number, number> = {
  0:0.25, 5:0.35, 9:0.5, 13:0.7, 15:0.7, 18:1.0,
  20:1.0, 25:1.4, 30:2.0, 35:2.8, 40:3.5, 50:4.9,
  53:5.3, 60:6.3, 70:8.5, 80:10.6, 90:12.7, 100:14.2,
  106:15.0, 120:18.0, 140:21.2,
};

function resolveLineweight(entity: any, dxf: any): number {
  const lw = entity.lineweight ?? entity.lineWeight;
  if (lw && lw > 0) return (LW_MAP[lw] ?? 0.5) * 0.04;
  const layerDef = dxf?.tables?.layer?.layers?.[entity.layer];
  const llw = layerDef?.lineweight ?? layerDef?.lineWeight;
  if (llw && llw > 0) return (LW_MAP[llw] ?? 0.5) * 0.04;
  return 0.5;
}

export function renderDxf(state: RendererState, dxf: any, visibleLayers: Set<string>): void {
  state.scene.removeChildren();
  if (!dxf?.entities?.length) return;

  const g = new Graphics();
  state.scene.addChild(g);

  const entities: any[] = dxf.entities;

  // Cache bboxes + build quadtree
  let mnX=Infinity,mnY=Infinity,mxX=-Infinity,mxY=-Infinity;
  const expand = (x: number, y: number) => {
    if(x<mnX)mnX=x; if(x>mxX)mxX=x; if(y<mnY)mnY=y; if(y>mxY)mxY=y;
  };
  for (const e of entities) {
    if (!isLayerVisible(e.layer, visibleLayers)) continue;
    if (!e._bbox) e._bbox = computeEntityBBox(e);
    const bb = e._bbox as AABB | null;
    if (bb) { expand(bb.minX,bb.minY); expand(bb.maxX,bb.maxY); }
    else for (const [x,y] of getEntityPoints(e, dxf)) expand(x, y);
  }

  if (!isFinite(mnX)) return;

  const worldBounds: AABB = { minX:mnX, minY:mnY, maxX:mxX, maxY:mxY };
  const qt = new QuadTree(worldBounds);
  for (const e of entities) {
    if (!isLayerVisible(e.layer, visibleLayers)) continue;
    const bb = e._bbox as AABB | null;
    if (bb) qt.insert(e, bb);
  }
  (state as any)._setSpatial?.(entities, qt, visibleLayers);

  const { app, scene } = state;
  const W = app.renderer.width, H = app.renderer.height;
  const bw = mxX-mnX||1, bh = mxY-mnY||1;
  const scl = Math.min(W/bw, H/bh) * 0.85;
  scene.scale.set(scl);
  scene.x = (W - bw*scl)/2 - mnX*scl;
  scene.y = (H + bh*scl)/2 + mnY*scl;
  state.onZoomUpdate(Math.round(100/scl));

  for (const e of entities) {
    if (!isLayerVisible(e.layer, visibleLayers)) continue;
    if (e.type === 'HATCH') drawHatch(g, e, resolveColor(e, dxf));
  }
  for (const e of entities) {
    if (!isLayerVisible(e.layer, visibleLayers)) continue;
    if (e.type === 'TEXT' || e.type === 'MTEXT' || e.type === 'HATCH') continue;
    drawEntity(g, e, resolveColor(e, dxf), dxf, null, 0, resolveLineweight(e, dxf));
  }
  if (entities.length <= MAX_ENTITIES_FULL) {
    for (const e of entities) {
      if (!isLayerVisible(e.layer, visibleLayers)) continue;
      if (e.type === 'TEXT' || e.type === 'MTEXT') drawText(scene, e);
    }
  }
}

function isLayerVisible(layerName: string, visible: Set<string>): boolean {
  if (!visible.size) return true;
  return visible.has(layerName ?? '0');
}

function resolveColor(entity: any, dxf: any): number {
  if (entity.color !== undefined && entity.color !== 256) return aciToHex(entity.color);
  const layerDef = dxf?.tables?.layer?.layers?.[entity.layer];
  if (layerDef?.color !== undefined) return aciToHex(layerDef.color);
  return ENTITY_COLOR;
}

function resolveLinetype(entity: any, dxf: any): number[] | null {
  const lt = (entity.lineType || entity.lineTypeName || '').toUpperCase().replace(/\s/g, '');
  if (!lt || lt === 'BYLAYER' || lt === 'CONTINUOUS' || lt === 'BYBLOCK') {
    const layerDef = dxf?.tables?.layer?.layers?.[entity.layer];
    const layerLt = (layerDef?.lineType || '').toUpperCase().replace(/\s/g, '');
    return LINETYPES[layerLt] ?? null;
  }
  return LINETYPES[lt] ?? null;
}

function xformPt(x: number, y: number, ins: any): { x: number; y: number } {
  const sx=ins.xScale??1, sy=ins.yScale??1;
  const r=((ins.rotation??0)*Math.PI)/180;
  const px=ins.position?.x??0, py=ins.position?.y??0;
  return { x: Math.cos(r)*x*sx - Math.sin(r)*y*sy + px,
           y: Math.sin(r)*x*sx + Math.cos(r)*y*sy + py };
}

function drawEntity(g: Graphics, entity: any, color: number, dxf: any, ins: any, depth: number, lw=0.5): void {
  const w = lw;
  const pt = (x: number, y: number) => ins ? xformPt(x,y,ins) : { x, y };
  const lt = resolveLinetype(entity, dxf);

  switch (entity.type) {
    case 'LINE': {
      const v = entity.vertices;
      if (v?.length >= 2) {
        const a = pt(v[0].x,v[0].y), b = pt(v[1].x,v[1].y);
        if (lt) drawDashed(g,a.x,-a.y,b.x,-b.y,lt,color,w);
        else g.moveTo(a.x,-a.y).lineTo(b.x,-b.y).stroke({ color, width: w });
      }
      break;
    }
    case 'CIRCLE': {
      const c = pt(entity.center.x, entity.center.y);
      g.circle(c.x,-c.y,entity.radius*(ins?.xScale??1)).stroke({ color, width: w });
      break;
    }
    case 'ARC': {
      const c = pt(entity.center.x, entity.center.y);
      const rotOff = ((ins?.rotation??0)*Math.PI)/180;
      g.arc(c.x,-c.y,entity.radius*(ins?.xScale??1),
            -entity.startAngle-rotOff,-entity.endAngle-rotOff,true)
       .stroke({ color, width: w });
      break;
    }
    case 'LWPOLYLINE': case 'POLYLINE': {
      const v = entity.vertices;
      if (!v?.length) break;
      const first = pt(v[0].x,v[0].y);
      g.moveTo(first.x,-first.y);
      for (let i=1;i<v.length;i++) { const p=pt(v[i].x,v[i].y); g.lineTo(p.x,-p.y); }
      if (entity.closed) g.closePath();
      g.stroke({ color, width: w });
      break;
    }
    case 'ELLIPSE': {
      const c = pt(entity.center.x, entity.center.y);
      const rx = Math.sqrt(entity.majorAxisEndPoint.x**2+entity.majorAxisEndPoint.y**2)*(ins?.xScale??1);
      const ry = rx*entity.axisRatio;
      const rot = Math.atan2(entity.majorAxisEndPoint.y,entity.majorAxisEndPoint.x)+((ins?.rotation??0)*Math.PI)/180;
      drawEllipse(g,c.x,-c.y,rx,ry,rot,color,w);
      break;
    }
    case 'SPLINE': {
      const pts = entity.controlPoints ?? entity.fitPoints;
      if (!pts?.length) break;
      const first = pt(pts[0].x,pts[0].y);
      g.moveTo(first.x,-first.y);
      for (let i=1;i<pts.length;i++) { const p=pt(pts[i].x,pts[i].y); g.lineTo(p.x,-p.y); }
      g.stroke({ color, width: w });
      break;
    }
    case 'SOLID': case '3DFACE': {
      const v = entity.vertices;
      if (v?.length >= 3) {
        const first = pt(v[0].x,v[0].y);
        g.moveTo(first.x,-first.y);
        for (let i=1;i<v.length;i++) { const p=pt(v[i].x,v[i].y); g.lineTo(p.x,-p.y); }
        g.closePath().fill({ color });
      }
      break;
    }
    case 'INSERT': {
      if (depth >= 4) break;
      const block = dxf?.blocks?.[entity.name];
      if (!block?.entities?.length) break;
      const composed = ins ? composeInsert(ins, entity) : entity;
      for (const be of block.entities) {
        if (be.type === 'INSERT' && be.name === entity.name) continue;
        drawEntity(g, be, resolveBlockColor(be, color, dxf), dxf, composed, depth+1, w);
      }
      break;
    }
    case 'DIMENSION': {
      const blockName = entity.block ?? entity.dimensionBlock;
      if (blockName) {
        const block = dxf?.blocks?.[blockName];
        if (block?.entities?.length)
          for (const be of block.entities)
            drawEntity(g, be, color, dxf, null, depth+1, w);
      }
      break;
    }
  }
}

function composeInsert(parent: any, child: any): any {
  const sx=(parent.xScale??1)*(child.xScale??1), sy=(parent.yScale??1)*(child.yScale??1);
  const rot=(parent.rotation??0)+(child.rotation??0);
  const composed = xformPt(child.position?.x??0, child.position?.y??0, parent);
  return { position: composed, xScale: sx, yScale: sy, rotation: rot };
}

function resolveBlockColor(entity: any, parentColor: number, dxf: any): number {
  if (entity.color === 0) return parentColor;
  return resolveColor(entity, dxf);
}

function drawHatch(g: Graphics, entity: any, color: number): void {
  if (!entity.boundaryPaths?.length) return;
  const isSolid = (entity.patternName ?? '').toUpperCase() === 'SOLID' || entity.isSolid;
  for (const path of entity.boundaryPaths) {
    const pts = extractBoundaryPoints(path);
    if (pts.length < 3) continue;
    g.moveTo(pts[0].x,-pts[0].y);
    for (let i=1;i<pts.length;i++) g.lineTo(pts[i].x,-pts[i].y);
    g.closePath();
    isSolid ? g.fill({ color, alpha: 0.75 }) : g.stroke({ color, width: 0.3, alpha: 0.5 });
  }
}

function extractBoundaryPoints(path: any): { x: number; y: number }[] {
  if (path.vertices?.length) return path.vertices.map((v: any) => ({ x: v.x, y: v.y }));
  const pts: { x: number; y: number }[] = [];
  for (const edge of path.edges ?? []) {
    if (edge.type === 1) {
      pts.push({ x: edge.startPoint?.x??0, y: edge.startPoint?.y??0 });
    } else if (edge.type === 2) {
      const cx=edge.center?.x??0, cy=edge.center?.y??0, r=edge.radius??0;
      const sa=(edge.startAngle??0)*Math.PI/180, ea=(edge.endAngle??360)*Math.PI/180;
      for (let i=0;i<=16;i++) {
        const a = sa+(ea-sa)*(i/16);
        pts.push({ x: cx+Math.cos(a)*r, y: cy+Math.sin(a)*r });
      }
    }
  }
  return pts;
}

function drawDashed(g: Graphics, x1: number, y1: number, x2: number, y2: number, pattern: number[], color: number, w: number): void {
  const dx=x2-x1, dy=y2-y1, len=Math.sqrt(dx*dx+dy*dy);
  if (len < 0.001) return;
  const nx=dx/len, ny=dy/len;
  let pos=0, draw=true, pi=0;
  while (pos < len) {
    const seg = Math.max(pattern[pi % pattern.length], 0.001);
    const end = Math.min(pos+seg, len);
    if (draw && end > pos)
      g.moveTo(x1+nx*pos,y1+ny*pos).lineTo(x1+nx*end,y1+ny*end).stroke({ color, width: w });
    pos=end; draw=!draw; pi++;
  }
}

function drawEllipse(g: Graphics, cx: number, cy: number, rx: number, ry: number, rot: number, color: number, w: number): void {
  const steps = 60;
  for (let i=0;i<=steps;i++) {
    const a=(i/steps)*Math.PI*2;
    const x=Math.cos(a)*rx, y=Math.sin(a)*ry;
    const px = cx+x*Math.cos(rot)-y*Math.sin(rot);
    const py = cy+x*Math.sin(rot)+y*Math.cos(rot);
    i===0 ? g.moveTo(px,py) : g.lineTo(px,py);
  }
  g.stroke({ color, width: w });
}

function drawText(container: Container, entity: any): void {
  const pos = entity.position ?? entity.insertionPoint;
  if (!pos) return;
  const raw: string = entity.text ?? entity.string ?? '';
  const text = raw.replace(/[^\x20-\x7EÀ-ɏĀ-ž]/g, '?');
  const style = new TextStyle({
    fontSize: Math.max((entity.textHeight || 2.5) * 8, 10),
    fill: 0xe8e8f0, fontFamily: 'Segoe UI, Arial, sans-serif',
  });
  const t = new Text({ text, style });
  t.x=pos.x; t.y=-pos.y; t.scale.set(1/8);
  container.addChild(t);
}

function getEntityPoints(entity: any, _dxf?: any): [number, number][] {
  switch (entity.type) {
    case 'LINE': return entity.vertices?.map((v: any) => [v.x, v.y]) ?? [];
    case 'CIRCLE': case 'ARC': {
      const c=entity.center, r=entity.radius||0;
      return [[c.x-r,c.y-r],[c.x+r,c.y+r]];
    }
    case 'LWPOLYLINE': case 'POLYLINE':
      return entity.vertices?.map((v: any) => [v.x, v.y]) ?? [];
    case 'TEXT': case 'MTEXT': {
      const p=entity.position??entity.insertionPoint;
      return p ? [[p.x,p.y]] : [];
    }
    case 'INSERT': {
      const pos=entity.position; return pos ? [[pos.x,pos.y]] : [];
    }
    default: return [];
  }
}

export function getLayers(dxf: any): { name: string; color: number; visible: boolean }[] {
  const lt = dxf?.tables?.layer?.layers;
  if (!lt) return [];
  return Object.entries(lt).map(([name, def]: [string, any]) => ({
    name, color: aciToHex(def.color), visible: def.visible !== false,
  }));
}

export function calcPolylineStats(entity: any): { area: number; perimeter: number } | null {
  const verts: { x: number; y: number }[] = entity.vertices;
  if (!verts?.length || verts.length < 3) return null;
  let area=0, perimeter=0;
  const n=verts.length;
  for (let i=0;i<n;i++) {
    const j=(i+1)%n;
    area += verts[i].x*verts[j].y - verts[j].x*verts[i].y;
    const dx=verts[j].x-verts[i].x, dy=verts[j].y-verts[i].y;
    perimeter += Math.sqrt(dx*dx+dy*dy);
  }
  return { area: Math.abs(area)/2, perimeter };
}

// ── Selection box ─────────────────────────────────────────────────────────────

function selectInBox(entities: any[], box: AABB, crossing: boolean, visibleLayers: Set<string>): any[] {
  const result: any[] = [];
  for (const e of entities) {
    if (!isLayerVisible(e.layer, visibleLayers)) continue;
    const bbox = e._bbox as AABB | undefined;
    if (!bbox) continue;
    if (crossing ? aabbIntersects(bbox, box) : aabbContains(box, bbox))
      result.push(e);
  }
  return result;
}

// ── OSNAP ─────────────────────────────────────────────────────────────────────

export function findSnapPoint(wx: number, wy: number, entities: any[], radius: number, qt?: QuadTree | null): SnapPoint | null {
  const candidates = qt ? qt.queryPoint(wx, wy, radius * 2) : entities;
  let best: SnapPoint | null = null;
  let bestD = radius;

  const check = (x: number, y: number, type: SnapType) => {
    const d = Math.sqrt((x-wx)**2+(y-wy)**2);
    if (d < bestD) { bestD=d; best={ x, y, type }; }
  };

  for (const e of candidates) {
    switch (e.type) {
      case 'LINE': {
        const v = e.vertices;
        if (v?.length >= 2) {
          check(v[0].x,v[0].y,'endpoint');
          check(v[1].x,v[1].y,'endpoint');
          check((v[0].x+v[1].x)/2,(v[0].y+v[1].y)/2,'midpoint');
        }
        break;
      }
      case 'CIRCLE':
        if (e.center) check(e.center.x,e.center.y,'center');
        break;
      case 'ARC':
        if (e.center) {
          check(e.center.x,e.center.y,'center');
          const sa=e.startAngle??0, ea=e.endAngle??0, r=e.radius??0;
          check(e.center.x+Math.cos(sa)*r, e.center.y+Math.sin(sa)*r,'endpoint');
          check(e.center.x+Math.cos(ea)*r, e.center.y+Math.sin(ea)*r,'endpoint');
        }
        break;
      case 'LWPOLYLINE': case 'POLYLINE': {
        const v = e.vertices;
        if (!v?.length) break;
        for (let i=0;i<v.length;i++) {
          check(v[i].x,v[i].y,'endpoint');
          const j=(i+1)%v.length;
          if (j!==0||e.closed) check((v[i].x+v[j].x)/2,(v[i].y+v[j].y)/2,'midpoint');
        }
        break;
      }
      case 'ELLIPSE':
        if (e.center) check(e.center.x,e.center.y,'center');
        break;
    }
  }
  return best;
}

// ── Hit Test ──────────────────────────────────────────────────────────────────

export function hitTestEntities(wx: number, wy: number, entities: any[], tol: number, qt?: QuadTree | null): any | null {
  const candidates = qt
    ? qt.queryPoint(wx, wy, tol * 4)
    : entities;
  // Reverse order so top-drawn entity wins
  const arr = Array.isArray(candidates) ? candidates : [...candidates];
  for (let i=arr.length-1;i>=0;i--) {
    if (hitTestEntity(wx,wy,arr[i],tol)) return arr[i];
  }
  return null;
}

function hitTestEntity(wx: number, wy: number, e: any, tol: number): boolean {
  switch (e.type) {
    case 'LINE': {
      const v = e.vertices;
      return v?.length>=2 ? ptToSegDist(wx,wy,v[0].x,v[0].y,v[1].x,v[1].y)<tol : false;
    }
    case 'CIRCLE':
      return e.center ? Math.abs(Math.sqrt((wx-e.center.x)**2+(wy-e.center.y)**2)-e.radius)<tol : false;
    case 'ARC': {
      if (!e.center) return false;
      const d=Math.sqrt((wx-e.center.x)**2+(wy-e.center.y)**2);
      if (Math.abs(d-e.radius)>tol) return false;
      let ang=Math.atan2(wy-e.center.y,wx-e.center.x);
      if (ang<0) ang+=Math.PI*2;
      let sa=e.startAngle??0, ea=e.endAngle??Math.PI*2;
      if (ea<sa) ea+=Math.PI*2;
      return ang>=sa && ang<=ea;
    }
    case 'LWPOLYLINE': case 'POLYLINE': {
      const v = e.vertices;
      if (!v?.length) return false;
      for (let i=0;i<v.length-1;i++)
        if (ptToSegDist(wx,wy,v[i].x,v[i].y,v[i+1].x,v[i+1].y)<tol) return true;
      if (e.closed && v.length>2) {
        const last=v[v.length-1];
        return ptToSegDist(wx,wy,last.x,last.y,v[0].x,v[0].y)<tol;
      }
      return false;
    }
    default: return false;
  }
}

function ptToSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx=bx-ax, dy=by-ay, lenSq=dx*dx+dy*dy;
  if (lenSq<1e-10) return Math.sqrt((px-ax)**2+(py-ay)**2);
  const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/lenSq));
  return Math.sqrt((px-ax-t*dx)**2+(py-ay-t*dy)**2);
}
