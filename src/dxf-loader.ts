import DxfParser from 'dxf-parser';

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
    return new DxfParser().parseSync(text);
  } catch (e) {
    console.error('DXF parse error:', e);
    return null;
  }
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
  if (d > 0) return `${d} gün önce`;
  if (h > 0) return `${h} saat önce`;
  if (m > 0) return `${m} dk önce`;
  return 'az önce';
}
