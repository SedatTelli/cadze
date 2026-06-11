import DxfParser from 'dxf-parser';
import { t } from './i18n';

export interface LoadedFile {
  name: string;
  type: 'dxf' | 'dwg' | 'unsupported';
  dwgVersion?: string;
  dwgWarning?: 'ok' | 'partial' | 'unsupported';
  dxf?: any;
}

const GOOD_SUPPORT = new Set(['R10','R12','R13','R14','R2000','R2004','R2007','R2010','R2013']);

// ── Entry points ──────────────────────────────────────────────────────────────

// Called from browser File drop (DXF) or Tauri path drop (both)
export async function loadFile(file: File): Promise<LoadedFile> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'dxf') return parseDxfText(await file.text(), file.name);
  if (ext === 'dwg') {
    // In Tauri we prefer path-based (no big IPC transfer) — but File has no path.
    // Fallback: show unsupported message; real DWG opening goes via loadFromPath.
    return { name: file.name, type: 'dwg', dwgWarning: 'unsupported', dxf: null };
  }
  return { name: file.name, type: 'unsupported' };
}

// Called from Tauri file-drop event (has real path)
export async function loadFromPath(filePath: string): Promise<LoadedFile> {
  const name = filePath.split(/[\\/]/).pop() ?? filePath;
  const ext  = name.split('.').pop()?.toLowerCase() ?? '';

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke<{
      success: boolean;
      file_type: string;
      dxf_content: string | null;
      dwg_version: string | null;
      error: string | null;
    }>('process_cad_file', { path: filePath });

    if (!result.success || !result.dxf_content) {
      const ver = result.dwg_version ?? undefined;
      console.error('CAD load error:', result.error);
      return {
        name,
        type: (ext === 'dwg' ? 'dwg' : ext === 'dxf' ? 'dxf' : 'unsupported') as any,
        dwgVersion: ver,
        dwgWarning: 'unsupported',
        dxf: null,
      };
    }

    const dxf = parseDxf(result.dxf_content);
    const ver = result.dwg_version ?? undefined;
    const dwgWarning = ver
      ? (GOOD_SUPPORT.has(ver) ? 'ok' : 'partial')
      : undefined;

    return {
      name,
      type: result.file_type as 'dxf' | 'dwg',
      dwgVersion: ver,
      dwgWarning,
      dxf,
    };
  } catch (err) {
    console.error('Tauri invoke error:', err);
    return { name, type: 'unsupported', dxf: null };
  }
}

// ── DXF parsing ───────────────────────────────────────────────────────────────

function parseDxf(text: string): any {
  try {
    const dxf = new DxfParser().parseSync(text);
    if (dxf) injectHatches(dxf, text);
    return dxf;
  } catch (e) {
    console.error('DXF parse error:', e);
    return null;
  }
}

function injectHatches(dxf: any, rawText: string): void {
  const hatches = extractHatchEntities(rawText);
  if (hatches.length > 0)
    dxf.entities = [...(dxf.entities ?? []), ...hatches];
}

function extractHatchEntities(text: string): any[] {
  const raw = text.replace(/^﻿/, '');
  const lines = raw.split(/\r?\n/);
  const pairs: [number, string][] = [];
  let i = 0;
  while (i + 1 < lines.length) {
    const code = parseInt(lines[i].trim(), 10);
    if (!isNaN(code)) { pairs.push([code, lines[i + 1].trim()]); i += 2; }
    else i++;
  }
  const hatches: any[] = [];
  let pi = 0;
  while (pi < pairs.length) {
    if (pairs[pi][0] === 0 && pairs[pi][1] === 'HATCH') {
      pi++;
      const r = readHatchEntity(pairs, pi);
      hatches.push(r.entity);
      pi = r.nextPi;
    } else pi++;
  }
  return hatches;
}

function readHatchEntity(pairs: [number, string][], startPi: number): { entity: any; nextPi: number } {
  const ent: any = { type: 'HATCH', boundaryPaths: [], patternLines: [],
    patternName: 'SOLID', isSolid: true, patternAngle: 0, patternScale: 1 };
  let pi = startPi;
  while (pi < pairs.length && pairs[pi][0] !== 0) {
    const [code, val] = pairs[pi];
    switch (code) {
      case 5:  ent.handle = val; pi++; break;
      case 8:  ent.layer = val; pi++; break;
      case 62: ent.colorIndex = Math.abs(parseInt(val, 10)); pi++; break;
      case 420: ent.color = parseInt(val, 10); pi++; break;
      case 2:  ent.patternName = val; pi++; break;
      case 70: ent.isSolid = parseInt(val, 10) === 1; pi++; break;
      case 91: {
        const numPaths = parseInt(val, 10); pi++;
        for (let p = 0; p < numPaths && pi < pairs.length; p++) {
          const r = readBoundaryPath(pairs, pi);
          ent.boundaryPaths.push(r.path); pi = r.nextPi;
        }
        break;
      }
      case 52: ent.patternAngle = parseFloat(val); pi++; break;
      case 41: ent.patternScale = parseFloat(val); pi++; break;
      case 78: {
        const numLines = parseInt(val, 10); pi++;
        for (let l = 0; l < numLines && pi < pairs.length; l++) {
          const r = readPatternLine(pairs, pi);
          ent.patternLines.push(r.line); pi = r.nextPi;
        }
        break;
      }
      case 98: {
        const numSeeds = parseInt(val, 10); pi++;
        for (let s = 0; s < numSeeds && pi < pairs.length; s++) {
          while (pi < pairs.length && pairs[pi][0] !== 10) pi++;
          if (pairs[pi]?.[0] === 10) pi += 2; // skip x,y
        }
        break;
      }
      default: pi++; break;
    }
  }
  return { entity: ent, nextPi: pi };
}

function readBoundaryPath(pairs: [number, string][], startPi: number): { path: any; nextPi: number } {
  let pi = startPi;
  const path: any = { edges: [], vertices: [] };
  if (pi >= pairs.length || pairs[pi][0] !== 92) return { path, nextPi: pi };
  const pathType = parseInt(pairs[pi][1], 10); pi++;
  const isPolyline = !!(pathType & 2);

  if (isPolyline) {
    while (pi < pairs.length && pairs[pi][0] !== 0 && pairs[pi][0] !== 92 && pairs[pi][0] !== 75) {
      const [code, val] = pairs[pi];
      if (code === 93) {
        const numVerts = parseInt(val, 10); pi++;
        for (let v = 0; v < numVerts && pi < pairs.length; v++) {
          const vert: any = {};
          if (pairs[pi]?.[0] === 10) { vert.x = parseFloat(pairs[pi][1]); pi++; }
          if (pairs[pi]?.[0] === 20) { vert.y = parseFloat(pairs[pi][1]); pi++; }
          if (pairs[pi]?.[0] === 42) { vert.bulge = parseFloat(pairs[pi][1]); pi++; }
          path.vertices.push(vert);
        }
      } else { pi++; }
    }
  } else {
    while (pi < pairs.length && pairs[pi][0] !== 0 && pairs[pi][0] !== 92 && pairs[pi][0] !== 75) {
      const [code, val] = pairs[pi];
      if (code === 93) {
        const numEdges = parseInt(val, 10); pi++;
        for (let e2 = 0; e2 < numEdges && pi < pairs.length; e2++) {
          if (pairs[pi]?.[0] !== 72) break;
          const edgeType = parseInt(pairs[pi][1], 10); pi++;
          const edge: any = { type: edgeType };
          const stop = (c: number) => c === 72 || c === 92 || c === 97 || c === 0;
          if (edgeType === 1) {
            edge.startPoint = { x: 0, y: 0 }; edge.endPoint = { x: 0, y: 0 };
            while (pi < pairs.length && !stop(pairs[pi][0])) {
              const [c, v] = pairs[pi];
              if (c === 10) edge.startPoint.x = parseFloat(v);
              else if (c === 20) edge.startPoint.y = parseFloat(v);
              else if (c === 11) edge.endPoint.x = parseFloat(v);
              else if (c === 21) edge.endPoint.y = parseFloat(v);
              pi++;
            }
          } else if (edgeType === 2) {
            edge.center = { x: 0, y: 0 };
            while (pi < pairs.length && !stop(pairs[pi][0])) {
              const [c, v] = pairs[pi];
              if (c === 10) edge.center.x = parseFloat(v);
              else if (c === 20) edge.center.y = parseFloat(v);
              else if (c === 40) edge.radius = parseFloat(v);
              else if (c === 50) edge.startAngle = parseFloat(v);
              else if (c === 51) edge.endAngle = parseFloat(v);
              else if (c === 73) edge.isCounterClockwise = parseInt(v, 10) === 1;
              pi++;
            }
          } else {
            while (pi < pairs.length && !stop(pairs[pi][0])) pi++;
          }
          path.edges.push(edge);
        }
      } else { pi++; }
    }
  }
  // skip source-objects section (97 + handles)
  while (pi < pairs.length && pairs[pi][0] !== 92 && pairs[pi][0] !== 75 &&
         pairs[pi][0] !== 52 && pairs[pi][0] !== 78 && pairs[pi][0] !== 98 && pairs[pi][0] !== 0)
    pi++;
  return { path, nextPi: pi };
}

function readPatternLine(pairs: [number, string][], startPi: number): { line: any; nextPi: number } {
  let pi = startPi;
  const line: any = { dashes: [] };
  if (!pairs[pi] || pairs[pi][0] !== 53) return { line, nextPi: pi };
  line.angle = parseFloat(pairs[pi][1]); pi++;
  if (pairs[pi]?.[0] === 43) { line.baseX  = parseFloat(pairs[pi][1]); pi++; }
  if (pairs[pi]?.[0] === 44) { line.baseY  = parseFloat(pairs[pi][1]); pi++; }
  if (pairs[pi]?.[0] === 45) { line.offsetX = parseFloat(pairs[pi][1]); pi++; }
  if (pairs[pi]?.[0] === 46) { line.offsetY = parseFloat(pairs[pi][1]); pi++; }
  if (pairs[pi]?.[0] === 79) {
    const numDashes = parseInt(pairs[pi][1], 10); pi++;
    for (let d = 0; d < numDashes && pairs[pi]?.[0] === 49; d++) {
      line.dashes.push(parseFloat(pairs[pi][1])); pi++;
    }
  }
  return { line, nextPi: pi };
}

async function parseDxfText(text: string, name: string): Promise<LoadedFile> {
  const dxf = parseDxf(text);
  return { name, type: 'dxf', dxf };
}

// ── Recent files ──────────────────────────────────────────────────────────────

export interface RecentFile { name: string; ext: string; timestamp: number; }

const RECENT_KEY = 'cadze_recent';
const MAX_RECENT = 5;

export function addRecentFile(name: string): void {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const list = getRecentFiles().filter(f => f.name !== name);
  list.unshift({ name, ext, timestamp: Date.now() });
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
}

export function getRecentFiles(): RecentFile[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); }
  catch { return []; }
}

export function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d > 0) return t('time.days_ago', { d });
  if (h > 0) return t('time.hours_ago', { h });
  if (m > 0) return t('time.minutes_ago', { m });
  return t('time.just_now');
}
