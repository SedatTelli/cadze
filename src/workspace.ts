import { t } from './i18n';
import { loadFromPath } from './dxf-loader';
import { HELP_HTML } from './help-content';
import { createRenderer, renderDxf, getLayers, calcPolylineStats, type RendererState, type Tool } from './renderer';
import {
  type Vec2, type Seg,
  nearestT, sideOfLine,
  offsetLineSeg, offsetPolyline,
  collectIntersectionTs, trimLineByTs,
  extendLineToBoundary,
} from './geo';
import type { LoadedFile } from './dxf-loader';

let rendererState: RendererState | null = null;
let currentDxf: any = null;
let layerVisibility = new Set<string>();
let frozenLayers   = new Set<string>();
let isDarkBg = true;
let offsetDistance = 1;

// Unit system
type UnitCode = 'unit' | 'mm' | 'cm' | 'm' | 'inch' | 'ft';
let currentUnit: UnitCode = 'unit';
let drawingScale = 1; // multiply scene units → currentUnit
const UNIT_LABELS: Record<UnitCode, string> = {
  unit: 'unit', mm: 'mm', cm: 'cm', m: 'm', inch: 'in', ft: 'ft',
};
function toDisplay(val: number): string {
  return (val * drawingScale).toFixed(2) + ' ' + UNIT_LABELS[currentUnit];
}

type UndoOp =
  | { type: 'note-add'; note: Note }
  | { type: 'note-del'; note: Note; idx: number }
  | { type: 'edit'; label: string; undo: () => void; redo: () => void };

const undoStack: UndoOp[] = [];
const redoStack: UndoOp[] = [];

// Command history
const cmdHistory: string[] = [];
let cmdHistIdx = -1;

// ── Notes ──────────────────────────────────────────────────────────────────────
interface Note { scx: number; scy: number; text: string; el: HTMLDivElement; }
const notes: Note[] = [];
let noteRafId = 0;

// ── Tab system ─────────────────────────────────────────────────────────────────
interface TabState {
  id: string;
  loaded: LoadedFile;
  filePath?: string;
  dxf: any;
  layerVisibility: Set<string>;
  frozenLayers: Set<string>;
  viewport: { x: number; y: number; scale: number } | null;
}

const tabs: TabState[] = [];
let activeTabId: string | null = null;
function nextTabId(): string { return Math.random().toString(36).slice(2, 9); }

function renderTabBar(): void {
  const list = document.getElementById('tab-list');
  if (!list) return;
  list.innerHTML = '';
  for (const tab of tabs) {
    const el = document.createElement('div');
    el.className = `tab${tab.id === activeTabId ? ' active' : ''}`;
    const name = document.createElement('span');
    name.className = 'tab-name';
    name.textContent = tab.loaded.name;
    name.title = tab.filePath ?? tab.loaded.name;
    const close = document.createElement('button');
    close.className = 'tab-close';
    close.textContent = '✕';
    close.title = 'Close';
    close.addEventListener('click', (e) => { e.stopPropagation(); closeTab(tab.id); });
    el.appendChild(name);
    el.appendChild(close);
    el.addEventListener('click', () => activateTab(tab.id));
    list.appendChild(el);
  }
}

function saveActiveTabViewport(): void {
  if (!activeTabId || !rendererState) return;
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab) return;
  tab.viewport = {
    x: rendererState.scene.x,
    y: rendererState.scene.y,
    scale: rendererState.scene.scale.x,
  };
}

function activateTab(id: string): void {
  if (id === activeTabId) return;
  saveActiveTabViewport();
  const tab = tabs.find(t => t.id === id);
  if (!tab) return;
  activeTabId = id;
  currentDxf = tab.dxf;
  layerVisibility = tab.layerVisibility;
  frozenLayers = tab.frozenLayers;
  rendererState?.clearSelection();
  clearNotes();
  hideMeasureBar();
  undoStack.length = 0;
  redoStack.length = 0;
  if (currentDxf && rendererState) {
    buildLayerPanel(getLayers(currentDxf));
    renderDxf(rendererState, currentDxf, layerVisibility);
    if (tab.viewport) {
      rendererState.scene.x = tab.viewport.x;
      rendererState.scene.y = tab.viewport.y;
      rendererState.scene.scale.set(tab.viewport.scale, tab.viewport.scale);
    }
  }
  updateTitlebarFilename(tab.loaded.name, tab.filePath);
  renderTabBar();
}

function closeTab(id: string): void {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx === -1) return;
  tabs.splice(idx, 1);
  if (id === activeTabId) {
    if (tabs.length === 0) {
      activeTabId = null;
      currentDxf = null;
      layerVisibility = new Set();
      frozenLayers = new Set();
      rendererState?.clearSelection();
      rendererState?.clearMeasure();
      clearNotes();
      hideMeasureBar();
      undoStack.length = 0;
      redoStack.length = 0;
      updateTitlebarFilename('');
      document.getElementById('workspace-screen')!.classList.remove('visible');
      document.getElementById('dropzone-screen')!.style.display = '';
    } else {
      const next = tabs[Math.min(idx, tabs.length - 1)];
      activeTabId = null;
      activeTabId = next.id;
      currentDxf = next.dxf;
      layerVisibility = next.layerVisibility;
      frozenLayers = next.frozenLayers;
      rendererState?.clearSelection();
      clearNotes();
      hideMeasureBar();
      undoStack.length = 0;
      redoStack.length = 0;
      if (currentDxf && rendererState) {
        buildLayerPanel(getLayers(currentDxf));
        renderDxf(rendererState, currentDxf, layerVisibility);
        if (next.viewport) {
          rendererState.scene.x = next.viewport.x;
          rendererState.scene.y = next.viewport.y;
          rendererState.scene.scale.set(next.viewport.scale, next.viewport.scale);
        }
      }
      updateTitlebarFilename(next.loaded.name, next.filePath);
    }
  }
  renderTabBar();
}

// ── Workspace display ──────────────────────────────────────────────────────────

export async function showWorkspace(loaded: LoadedFile, filePath?: string): Promise<void> {
  const dropzone  = document.getElementById('dropzone-screen')!;
  const workspace = document.getElementById('workspace-screen')!;
  dropzone.style.display = 'none';
  workspace.classList.add('visible');

  const loading = document.getElementById('loading-overlay')!;
  loading.classList.add('visible');
  document.getElementById('loading-text')!.textContent = t('loading.parsing');
  await new Promise(r => setTimeout(r, 10));

  if (filePath && '__TAURI_INTERNALS__' in window) {
    loaded = await loadFromPath(filePath);
  }

  showInfobar(loaded);

  if (!rendererState) {
    const wrap = document.getElementById('canvas-wrap')!;
    rendererState = await createRenderer(wrap);
    setupRendererCallbacks(rendererState);
  }

  // Save current tab's viewport before creating the new tab
  saveActiveTabViewport();

  // Create new tab
  const tabId = nextTabId();
  const tabDxf = loaded.dxf ?? null;
  const tabLayerVis: Set<string> = tabDxf
    ? new Set(getLayers(tabDxf).map((l: any) => l.name))
    : new Set();
  const tabFrozen: Set<string> = new Set();
  const tab: TabState = { id: tabId, loaded, filePath, dxf: tabDxf, layerVisibility: tabLayerVis, frozenLayers: tabFrozen, viewport: null };
  tabs.push(tab);
  activeTabId = tabId;

  // Point module-level globals to the new tab's sets (shared references)
  currentDxf = tabDxf;
  layerVisibility = tabLayerVis;
  frozenLayers = tabFrozen;

  if (tabDxf) {
    buildLayerPanel(getLayers(tabDxf));
    document.getElementById('loading-text')!.textContent =
      t('loading.rendering', { n: tabDxf.entities?.length ?? 0 });
    await new Promise(r => setTimeout(r, 10));
    renderDxf(rendererState, tabDxf, tabLayerVis);
  }

  loading.classList.remove('visible');
  updateTitlebarFilename(loaded.name, filePath);
  renderTabBar();
}

function updateTitlebarFilename(name: string, fullPath?: string): void {
  const el = document.getElementById('titlebar-filename');
  if (!el) return;
  el.textContent = name;
  el.title = fullPath ?? name;
}

function showInfobar(loaded: LoadedFile): void {
  const bar = document.getElementById('infobar')!;
  const txt = document.getElementById('infobar-text')!;
  if (loaded.type === 'dwg') {
    if (loaded.dwgWarning === 'unsupported' || !loaded.dxf) {
      txt.textContent = t('infobar.dwg_unsupported', { version: loaded.dwgVersion ?? '' });
      bar.classList.add('visible');
    } else if (loaded.dwgWarning === 'partial') {
      txt.textContent = t('infobar.dwg_partial', { version: loaded.dwgVersion ?? '' });
      bar.classList.add('visible');
    } else {
      bar.classList.remove('visible');
    }
  } else {
    bar.classList.remove('visible');
  }
}

function setupRendererCallbacks(state: RendererState): void {
  state.onCoordUpdate = (x, y) => {
    const el = document.getElementById('status-coord');
    if (el) el.innerHTML = `X: <span>${x.toFixed(2)}</span>&nbsp;&nbsp;Y: <span>${y.toFixed(2)}</span>`;
  };
  state.onZoomUpdate = (z) => {
    const el = document.getElementById('status-zoom');
    if (el) el.innerHTML = `1:<span>${z}</span>`;
  };
  state.onEntityClick = (entity) => {
    if (state.getSelectedSet().size <= 1) updateProperties(entity);
  };
  state.onSelectionChange = (entities) => {
    if (entities.length === 0)       updateProperties(null);
    else if (entities.length === 1)  updateProperties(entities[0]);
    else                             updatePropertiesMulti(entities);
  };
  state.onNotePlace = (scx, scy, sx, sy) => showNoteInput(scx, scy, sx, sy);
  state.onToolAction = (tool, entity, wx, wy) => {
    if (tool === 'trim')   trimEntity(entity, wx, wy);
    else if (tool === 'extend') extendEntity(entity, wx, wy);
    else if (tool === 'offset') offsetEntity(entity, wx, wy);
  };
  state.onMeasureResult = (dist, dx, dy) => {
    const bar = document.getElementById('status-measure');
    const val = document.getElementById('status-measure-val');
    if (bar && val) {
      bar.style.display = 'flex';
      val.textContent = `${toDisplay(dist)}  ΔX:${toDisplay(dx)}  ΔY:${toDisplay(dy)}`;
    }
  };
  state.onAngleResult = (deg) => {
    const bar = document.getElementById('status-measure');
    const val = document.getElementById('status-measure-val');
    if (bar && val) {
      bar.style.display = 'flex';
      val.textContent = `∠ ${deg.toFixed(2)}°`;
    }
  };
  state.onAreaResult = (area, perimeter) => {
    const bar = document.getElementById('status-measure');
    const val = document.getElementById('status-measure-val');
    if (bar && val) {
      bar.style.display = 'flex';
      val.textContent = `Area: ${toDisplay(area)}²  Perim: ${toDisplay(perimeter)}`;
    }
  };
  state.onFps = (fps) => {
    const el = document.getElementById('status-fps');
    if (el) el.textContent = `${fps} fps`;
  };
}

// ── Central command dispatcher ─────────────────────────────────────────────────

export function executeCmd(cmd: string): void {
  switch (cmd) {
    case 'open':
      document.dispatchEvent(new Event('cadze:open'));
      break;
    case 'close-file':
      closeFile();
      break;
    case 'delete-selected':
      deleteSelected();
      break;
    case 'select-all':
      selectAll();
      break;
    case 'export-png':
      exportPng();
      break;
    case 'export-pdf':
      window.print();
      break;
    case 'export-dxf':
      exportDxf();
      break;
    case 'zoom-in':
      rendererState?.zoomBy(1.4);
      break;
    case 'zoom-out':
      rendererState?.zoomBy(1 / 1.4);
      break;
    case 'fit-view':
      if (rendererState && currentDxf) renderDxf(rendererState, currentDxf, layerVisibility);
      break;
    case 'toggle-bg':
      toggleBackground();
      break;
    case 'fullscreen':
      toggleFullscreen();
      break;
    case 'tool-pan':
      setActiveTool('pan');
      break;
    case 'tool-zoom-window':
      setActiveTool('zoom-window');
      break;
    case 'tool-measure':
      setActiveTool('measure');
      break;
    case 'layers-all':
      setAllLayersVisible(true);
      break;
    case 'layers-none':
      setAllLayersVisible(false);
      break;
    case 'clear-measure':
      clearMeasure();
      break;
    case 'tool-note':
      setActiveTool('note');
      break;
    case 'clear-notes':
      clearNotes();
      break;
    case 'tool-angle':
      setActiveTool('angle-measure');
      break;
    case 'tool-area':
      setActiveTool('area-measure');
      break;
    case 'tool-trim':
      setActiveTool('trim');
      break;
    case 'tool-extend':
      setActiveTool('extend');
      break;
    case 'tool-offset':
      setActiveTool('offset');
      break;
    case 'toggle-osnap':
      toggleOsnap();
      break;
    case 'undo':
      undoAction();
      break;
    case 'redo':
      redoAction();
      break;
    default:
      if (cmd.startsWith('unit-')) {
        const unitCodes2: Record<string, UnitCode> = { unit:'unit', mm:'mm', cm:'cm', m:'m', inch:'inch', ft:'ft' };
        const u = unitCodes2[cmd.slice(5)];
        if (u) setUnit(u);
      }
      break;
    case 'user-manual':
      showHelp();
      break;
    case 'report':
      window.open('https://github.com/sedattelli/cadze/issues', '_blank');
      break;
    case 'about':
      showAbout();
      break;
  }
}

// ── Menubar ────────────────────────────────────────────────────────────────────

export function setupMenubar(): void {
  const menubar = document.getElementById('menubar');
  if (!menubar) return;

  let openItem: HTMLElement | null = null;

  const closeAll = () => { openItem?.classList.remove('open'); openItem = null; };

  menubar.addEventListener('click', (e) => {
    const cmd  = (e.target as HTMLElement).closest<HTMLElement>('[data-cmd]')?.dataset.cmd;
    const item = (e.target as HTMLElement).closest<HTMLElement>('.menu-item');

    if (cmd) { executeCmd(cmd); closeAll(); return; }

    if (item) {
      if (openItem === item) { closeAll(); }
      else { closeAll(); item.classList.add('open'); openItem = item; }
      e.stopPropagation();
    }
  });

  menubar.addEventListener('mouseover', (e) => {
    if (!openItem) return;
    const item = (e.target as HTMLElement).closest<HTMLElement>('.menu-item');
    if (item && item !== openItem) { closeAll(); item.classList.add('open'); openItem = item; }
  });

  document.addEventListener('click', closeAll);
}

// ── Context menu ───────────────────────────────────────────────────────────────

export function setupContextMenu(): void {
  const menu = document.getElementById('context-menu');
  if (!menu) return;

  document.getElementById('canvas-wrap')?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!rendererState) return;
    const maxX = window.innerWidth - 200;
    const maxY = window.innerHeight - 220;
    menu.style.left = `${Math.min(e.clientX, maxX)}px`;
    menu.style.top  = `${Math.min(e.clientY, maxY)}px`;
    menu.classList.add('visible');
    e.stopPropagation();
  });

  menu.addEventListener('click', (e) => {
    const cmd = (e.target as HTMLElement).closest<HTMLElement>('[data-cmd]')?.dataset.cmd;
    if (cmd) { executeCmd(cmd); menu.classList.remove('visible'); }
  });

  document.addEventListener('click', () => menu.classList.remove('visible'));
}

// ── Toolbar ────────────────────────────────────────────────────────────────────

export function setupToolbar(): void {
  document.getElementById('tool-pan')?.addEventListener('click', () => setActiveTool('pan'));
  document.getElementById('tool-zoom-window')?.addEventListener('click', () => setActiveTool('zoom-window'));
  document.getElementById('tool-measure')?.addEventListener('click', () => setActiveTool('measure'));
  document.getElementById('tool-angle')?.addEventListener('click', () => setActiveTool('angle-measure'));
  document.getElementById('tool-area')?.addEventListener('click', () => setActiveTool('area-measure'));
  document.getElementById('tool-note')?.addEventListener('click', () => setActiveTool('note'));
  document.getElementById('tool-fit')?.addEventListener('click', () => executeCmd('fit-view'));
  document.getElementById('tool-trim')?.addEventListener('click', () => setActiveTool('trim'));
  document.getElementById('tool-extend')?.addEventListener('click', () => setActiveTool('extend'));
  document.getElementById('tool-offset')?.addEventListener('click', () => setActiveTool('offset'));
}

function setActiveTool(name: Tool): void {
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tool-${name}`)?.classList.add('active');
  document.querySelectorAll('[data-cmd^="tool-"]').forEach(el => el.classList.remove('menu-active'));
  document.querySelector(`[data-cmd="tool-${name}"]`)?.classList.add('menu-active');
  rendererState?.setTool(name);
}

// ── Keyboard shortcuts ─────────────────────────────────────────────────────────

export function setupKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.ctrlKey && e.key === 'p') { e.preventDefault(); window.print(); return; }
    if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undoAction(); return; }
    if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redoAction(); return; }
    if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) { e.preventDefault(); selectAll(); return; }

    switch (e.key) {
      case 'v': case 'V': case 'p': case 'P':
        if (!e.ctrlKey) { e.preventDefault(); setActiveTool('pan'); } break;
      case 'z': case 'Z':
        if (!e.ctrlKey) { e.preventDefault(); setActiveTool('zoom-window'); } break;
      case 'm': case 'M':
        if (!e.ctrlKey) { e.preventDefault(); setActiveTool('measure'); } break;
      case 'a': case 'A':
        if (!e.ctrlKey) { e.preventDefault(); setActiveTool('angle-measure'); } break;
      case 'r': case 'R':
        if (!e.ctrlKey) { e.preventDefault(); setActiveTool('area-measure'); } break;
      case 'n': case 'N':
        if (!e.ctrlKey) { e.preventDefault(); setActiveTool('note'); } break;
      case 'F3':
        e.preventDefault(); toggleOsnap(); break;
      case 'Home':
        e.preventDefault(); executeCmd('fit-view'); break;
      case '+': case '=':
        if (!e.ctrlKey) { e.preventDefault(); rendererState?.zoomBy(1.4); } break;
      case '-':
        if (!e.ctrlKey) { e.preventDefault(); rendererState?.zoomBy(1 / 1.4); } break;
      case 'b': case 'B':
        if (!e.ctrlKey) { e.preventDefault(); toggleBackground(); } break;
      case 'F1':
        e.preventDefault(); showHelp(); break;
      case 'F11':
        e.preventDefault(); toggleFullscreen(); break;
      case 'Delete':
        e.preventDefault();
        if (rendererState && rendererState.getSelectedSet().size > 0) deleteSelected();
        else clearMeasure();
        break;
    }
  });
}

// ── Command line ───────────────────────────────────────────────────────────────

export function setupCommandLine(): void {
  const input = document.getElementById('cmd-input') as HTMLInputElement;
  if (!input) return;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistIdx < cmdHistory.length - 1) cmdHistIdx++;
      input.value = cmdHistory[cmdHistIdx] ?? '';
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (cmdHistIdx > 0) cmdHistIdx--;
      else { cmdHistIdx = -1; input.value = ''; return; }
      input.value = cmdHistory[cmdHistIdx] ?? '';
      return;
    }
    if (e.key !== 'Enter') return;
    const cmd = input.value.trim().toUpperCase();
    if (!cmd) return;
    input.value = '';
    cmdHistory.unshift(cmd);
    if (cmdHistory.length > 50) cmdHistory.pop();
    cmdHistIdx = -1;
    handleCommand(cmd);
  });
}

function handleCommand(raw: string): void {
  // Handle unit switch: e.g. "MM", "CM", "M", "INCH", "FT", "UNIT"
  const unitCodes: Record<string, UnitCode> = { MM:'mm', CM:'cm', M:'m', INCH:'inch', FT:'ft', UNIT:'unit', IN:'inch' };
  if (unitCodes[raw]) { setUnit(unitCodes[raw]); return; }

  // Handle SCALE <number>
  if (raw.startsWith('SCALE ')) {
    const n = parseFloat(raw.slice(6));
    if (!isNaN(n) && n > 0) { drawingScale = n; return; }
  }

  switch (raw) {
    case 'ZOOM': case 'Z': case 'ZA':
      executeCmd('fit-view'); break;
    case 'ZI': case 'ZOOMIN':
      rendererState?.zoomBy(1.4); break;
    case 'ZO': case 'ZOOMOUT':
      rendererState?.zoomBy(1 / 1.4); break;
    case 'PAN': case 'P':
      setActiveTool('pan'); break;
    case 'MEASURE': case 'DIST':
      setActiveTool('measure'); break;
    case 'ANGLE': case 'ANG':
      setActiveTool('angle-measure'); break;
    case 'AREA':
      setActiveTool('area-measure'); break;
    case 'NOTE':
      setActiveTool('note'); break;
    case 'BG': case 'BACKGROUND':
      toggleBackground(); break;
    case 'OSNAP': case 'OS':
      toggleOsnap(); break;
    case 'U': case 'UNDO':
      undoAction(); break;
    case 'REDO':
      redoAction(); break;
    case 'LAON': case 'LAALL':
      executeCmd('layers-all'); break;
    case 'LAOFF': case 'LANONE':
      executeCmd('layers-none'); break;
    case 'CLRMEAS':
      clearMeasure(); break;
    case 'TRIM': case 'TR':
      setActiveTool('trim'); break;
    case 'EXTEND': case 'EX':
      setActiveTool('extend'); break;
    case 'OFFSET': case 'O': case 'OF':
      setActiveTool('offset'); break;
    default:
      // OFFSET with distance: e.g. "OFFSET 50"
      if (raw.startsWith('OFFSET ') || raw.startsWith('O ') || raw.startsWith('OF ')) {
        const n = parseFloat(raw.split(' ')[1]);
        if (!isNaN(n) && n > 0) offsetDistance = n;
        setActiveTool('offset');
      } else {
        console.log(t('cmd.unknown', { cmd: raw }));
      }
  }
}

function setUnit(u: UnitCode): void {
  currentUnit = u;
  const el = document.getElementById('status-unit');
  if (el) el.textContent = UNIT_LABELS[u];
}

function toggleOsnap(): void {
  const on = !(rendererState as any)?._osnapOn;
  (rendererState as any)._osnapOn = on;
  rendererState?.setOsnap(on);
  const el = document.getElementById('osnap-indicator');
  if (el) { el.classList.toggle('active', on); el.title = `OSNAP ${on ? 'ON' : 'OFF'}`; }
}

// ── Export ─────────────────────────────────────────────────────────────────────

export function setupExport(): void {
  document.getElementById('export-png')?.addEventListener('click', exportPng);
  document.getElementById('export-pdf')?.addEventListener('click', () => window.print());
  document.getElementById('export-dxf')?.addEventListener('click', exportDxf);
}

function exportPng(): void {
  if (!rendererState) return;
  const canvas = rendererState.app.canvas as HTMLCanvasElement;
  const link = document.createElement('a');
  link.download = 'cadze-export.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function exportDxf(): void {
  if (!currentDxf) return;
  alert('DXF export — coming soon in v0.2');
}

// ── Notes ──────────────────────────────────────────────────────────────────────

function showNoteInput(scx: number, scy: number, sx: number, sy: number): void {
  const wrap = document.getElementById('note-input-wrap')!;
  const input = document.getElementById('note-input') as HTMLTextAreaElement;
  wrap.style.left = `${sx + 10}px`;
  wrap.style.top  = `${sy - 10}px`;
  wrap.style.display = 'block';
  input.value = '';
  input.focus();

  const commit = () => {
    const text = input.value.trim();
    wrap.style.display = 'none';
    if (text) createNote(scx, scy, text);
  };
  const cancel = () => { wrap.style.display = 'none'; };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); cleanup(); }
    if (e.key === 'Escape') { cancel(); cleanup(); }
  };
  const onBlur = () => { commit(); cleanup(); };
  const cleanup = () => { input.removeEventListener('keydown', onKey); input.removeEventListener('blur', onBlur); };

  input.addEventListener('keydown', onKey);
  setTimeout(() => input.addEventListener('blur', onBlur), 100);
}

function createNote(scx: number, scy: number, text: string): void {
  const layer = document.getElementById('note-layer')!;

  const pin = document.createElement('div');
  pin.className = 'note-pin';

  const dot = document.createElement('div');
  dot.className = 'note-dot';

  const bubble = document.createElement('div');
  bubble.className = 'note-bubble';

  const textEl = document.createElement('span');
  textEl.className = 'note-text';
  textEl.textContent = text;

  const del = document.createElement('button');
  del.className = 'note-del';
  del.textContent = '✕';
  del.title = 'Delete note';

  bubble.appendChild(textEl);
  bubble.appendChild(del);
  pin.appendChild(dot);
  pin.appendChild(bubble);
  layer.appendChild(pin);

  const note: Note = { scx, scy, text, el: pin };
  notes.push(note);

  del.addEventListener('click', (e) => {
    e.stopPropagation();
    const idx = notes.indexOf(note);
    if (idx !== -1) {
      undoStack.push({ type: 'note-del', note, idx });
      redoStack.length = 0;
      notes.splice(idx, 1);
      pin.remove();
    }
  });

  undoStack.push({ type: 'note-add', note });
  redoStack.length = 0;

  if (!noteRafId) startNoteLoop();
}

function undoAction(): void {
  const op = undoStack.pop();
  if (!op) return;
  if (op.type === 'note-add') {
    const idx = notes.indexOf(op.note);
    if (idx !== -1) { notes.splice(idx, 1); op.note.el.remove(); }
    redoStack.push({ type: 'note-del', note: op.note, idx });
  } else if (op.type === 'note-del') {
    const layer = document.getElementById('note-layer')!;
    notes.splice(op.idx, 0, op.note);
    layer.appendChild(op.note.el);
    redoStack.push({ type: 'note-add', note: op.note });
  } else if (op.type === 'edit') {
    op.undo();
    redoStack.push(op);
  }
}

function redoAction(): void {
  const op = redoStack.pop();
  if (!op) return;
  if (op.type === 'note-add') {
    const layer = document.getElementById('note-layer')!;
    notes.push(op.note);
    layer.appendChild(op.note.el);
    undoStack.push({ type: 'note-add', note: op.note });
  } else if (op.type === 'note-del') {
    const idx = notes.indexOf(op.note);
    if (idx !== -1) { notes.splice(idx, 1); op.note.el.remove(); }
    undoStack.push({ type: 'note-del', note: op.note, idx });
  } else if (op.type === 'edit') {
    op.redo();
    undoStack.push(op);
  }
}

function startNoteLoop(): void {
  const tick = () => {
    if (!rendererState) { noteRafId = requestAnimationFrame(tick); return; }
    const { scene } = rendererState;
    for (const n of notes) {
      const sx = n.scx * scene.scale.x + scene.x;
      const sy = n.scy * scene.scale.y + scene.y;
      n.el.style.left = `${sx}px`;
      n.el.style.top  = `${sy}px`;
    }
    noteRafId = requestAnimationFrame(tick);
  };
  noteRafId = requestAnimationFrame(tick);
}

function clearNotes(): void {
  const layer = document.getElementById('note-layer');
  if (layer) layer.innerHTML = '';
  notes.length = 0;
}

// ── Actions ────────────────────────────────────────────────────────────────────

function toggleBackground(): void {
  isDarkBg = !isDarkBg;
  rendererState?.setBg(isDarkBg);
  document.getElementById('canvas-wrap')?.classList.toggle('bg-light', !isDarkBg);
  const el = document.querySelector('[data-cmd="toggle-bg"]');
  if (el) el.textContent = isDarkBg ? 'Light Background  B' : 'Dark Background  B';
}

function toggleFullscreen(): void {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
}

function deleteSelected(): void {
  if (!rendererState || !currentDxf) return;
  const sel = rendererState.getSelectedSet();
  if (!sel.size) return;
  // Snapshot deleted items with their indices for undo
  const deleted: Array<{ idx: number; entity: any }> = [];
  (currentDxf.entities as any[]).forEach((e, i) => { if (sel.has(e)) deleted.push({ idx: i, entity: e }); });
  currentDxf.entities = currentDxf.entities.filter((e: any) => !sel.has(e));
  rendererState.clearSelection();
  rerender();
  undoStack.push({
    type: 'edit', label: 'Delete',
    undo: () => {
      // Reinsert in original order (sorted by idx, insert back to front to preserve indices)
      for (let i = deleted.length - 1; i >= 0; i--) {
        const { idx, entity } = deleted[i];
        currentDxf.entities.splice(Math.min(idx, currentDxf.entities.length), 0, entity);
      }
      rendererState?.clearSelection();
      rerender();
    },
    redo: () => {
      const set = new Set(deleted.map(d => d.entity));
      currentDxf.entities = currentDxf.entities.filter((e: any) => !set.has(e));
      rendererState?.clearSelection();
      rerender();
    },
  });
  redoStack.length = 0;
}

// ── Edit geometry helpers ──────────────────────────────────────────────────────

function entityToLineBoundaries(exclude: any): Seg[] {
  if (!currentDxf) return [];
  return (currentDxf.entities as any[])
    .filter(e => e !== exclude && e.type === 'LINE'
      && layerVisibility.has(e.layer ?? '0')
      && e.vertices?.length >= 2)
    .map(e => ({
      p1: { x: e.vertices[0].x, y: e.vertices[0].y } as Vec2,
      p2: { x: e.vertices[1].x, y: e.vertices[1].y } as Vec2,
    }));
}

function pushEditOp(label: string, undoFn: () => void, redoFn: () => void): void {
  undoStack.push({ type: 'edit', label, undo: undoFn, redo: redoFn });
  redoStack.length = 0;
}

function trimEntity(entity: any, worldX: number, worldY: number): void {
  if (!rendererState || !currentDxf) return;
  if (entity.type !== 'LINE') return;
  const v = entity.vertices;
  if (!v || v.length < 2) return;
  const p1: Vec2 = { x: v[0].x, y: v[0].y };
  const p2: Vec2 = { x: v[1].x, y: v[1].y };
  const clickT = nearestT({ x: worldX, y: worldY }, p1, p2);
  const boundaries = entityToLineBoundaries(entity);
  const ts = collectIntersectionTs(p1, p2, boundaries);
  if (ts.length === 0) return;
  const segs = trimLineByTs(p1, p2, ts, clickT);
  const idx = currentDxf.entities.indexOf(entity);
  if (idx === -1) return;

  // Build replacement entities BEFORE applying
  const newEnts: any[] = segs.map(seg => {
    const ne = JSON.parse(JSON.stringify(entity));
    ne.vertices[0] = { ...ne.vertices[0], x: seg.p1.x, y: seg.p1.y };
    ne.vertices[1] = { ...ne.vertices[1], x: seg.p2.x, y: seg.p2.y };
    ne._bbox = null;
    return ne;
  });

  pushEditOp('Trim',
    () => { // undo: find first new entity (or use stored idx), restore original
      const cur = newEnts.length > 0
        ? currentDxf.entities.indexOf(newEnts[0])
        : Math.min(idx, currentDxf.entities.length);
      if (newEnts.length > 0 && cur !== -1) {
        currentDxf.entities.splice(cur, newEnts.length, entity);
      } else if (newEnts.length === 0) {
        currentDxf.entities.splice(Math.min(idx, currentDxf.entities.length), 0, entity);
      }
      entity._bbox = null;
      rendererState?.clearSelection(); rerender();
    },
    () => { // redo
      const cur = currentDxf.entities.indexOf(entity);
      if (cur !== -1) currentDxf.entities.splice(cur, 1, ...newEnts);
      rendererState?.clearSelection(); rerender();
    }
  );

  currentDxf.entities.splice(idx, 1, ...newEnts);
  rendererState.clearSelection();
  rerender();
}

function extendEntity(entity: any, worldX: number, worldY: number): void {
  if (!rendererState || !currentDxf) return;
  if (entity.type !== 'LINE') return;
  const v = entity.vertices;
  if (!v || v.length < 2) return;
  const p1: Vec2 = { x: v[0].x, y: v[0].y };
  const p2: Vec2 = { x: v[1].x, y: v[1].y };
  const clickT = nearestT({ x: worldX, y: worldY }, p1, p2);
  const boundaries = entityToLineBoundaries(entity);
  const result = extendLineToBoundary(p1, p2, boundaries, clickT);
  if (!result) return;

  // Snapshot old state before mutation
  const oldV0 = { ...v[0] }, oldV1 = { ...v[1] };
  const newPt = result.newPt;
  const isP2 = result.extendP2;

  pushEditOp('Extend',
    () => { // undo
      if (isP2) entity.vertices[1] = oldV1; else entity.vertices[0] = oldV0;
      entity._bbox = null;
      rendererState?.clearSelection(); rerender();
    },
    () => { // redo
      if (isP2) entity.vertices[1] = { ...oldV1, x: newPt.x, y: newPt.y };
      else      entity.vertices[0] = { ...oldV0, x: newPt.x, y: newPt.y };
      entity._bbox = null;
      rendererState?.clearSelection(); rerender();
    }
  );

  if (isP2) entity.vertices[1] = { ...v[1], x: newPt.x, y: newPt.y };
  else      entity.vertices[0] = { ...v[0], x: newPt.x, y: newPt.y };
  entity._bbox = null;
  rendererState.clearSelection();
  rerender();
}

function offsetEntity(entity: any, worldX: number, worldY: number): void {
  if (!rendererState || !currentDxf) return;
  if (offsetDistance <= 0) return;
  let ne: any = null;

  if (entity.type === 'LINE') {
    const v = entity.vertices;
    if (!v || v.length < 2) return;
    const p1: Vec2 = { x: v[0].x, y: v[0].y };
    const p2: Vec2 = { x: v[1].x, y: v[1].y };
    const d = sideOfLine(p1, p2, { x: worldX, y: worldY }) >= 0 ? offsetDistance : -offsetDistance;
    const [np1, np2] = offsetLineSeg(p1, p2, d);
    ne = JSON.parse(JSON.stringify(entity));
    ne.vertices[0] = { ...ne.vertices[0], x: np1.x, y: np1.y };
    ne.vertices[1] = { ...ne.vertices[1], x: np2.x, y: np2.y };
    ne._bbox = null;

  } else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
    const v = entity.vertices;
    if (!v?.length || v.length < 2) return;
    const pts: Vec2[] = v.map((p: any) => ({ x: p.x, y: p.y }));
    const d = (pts.length >= 2 ? sideOfLine(pts[0], pts[1], { x: worldX, y: worldY }) : 1) >= 0
      ? offsetDistance : -offsetDistance;
    const newVerts = offsetPolyline(pts, d, !!entity.closed);
    ne = JSON.parse(JSON.stringify(entity));
    // Bevel corners can increase vertex count — rebuild the vertices array entirely
    ne.vertices = newVerts.map((p, i) => {
      // Inherit DXF vertex properties (z, bulge, etc.) from nearest original vertex
      const origIdx = Math.min(Math.round(i * (v.length - 1) / Math.max(newVerts.length - 1, 1)), v.length - 1);
      return { ...(v[origIdx] ?? {}), x: p.x, y: p.y };
    });
    ne._bbox = null;
  }

  if (!ne) return;
  currentDxf.entities.push(ne);
  rerender();

  pushEditOp('Offset',
    () => { // undo: remove the added entity
      const i = currentDxf.entities.indexOf(ne);
      if (i !== -1) currentDxf.entities.splice(i, 1);
      rerender();
    },
    () => { // redo: push it back
      currentDxf.entities.push(ne);
      rerender();
    }
  );
}

function selectAll(): void {
  if (!rendererState || !currentDxf) return;
  const visible = currentDxf.entities.filter(
    (e: any) => layerVisibility.has(e.layer ?? '0')
  );
  rendererState.setSelectedSet(new Set(visible));
}

function closeFile(): void {
  if (activeTabId) closeTab(activeTabId);
}

function clearMeasure(): void {
  rendererState?.clearMeasure();
  hideMeasureBar();
}

function hideMeasureBar(): void {
  const bar = document.getElementById('status-measure');
  if (bar) bar.style.display = 'none';
}

function setAllLayersVisible(visible: boolean): void {
  if (!rendererState || !currentDxf) return;
  if (visible) {
    getLayers(currentDxf).forEach(l => {
      if (!frozenLayers.has(l.name)) layerVisibility.add(l.name);
    });
  } else {
    layerVisibility.clear();
  }
  document.querySelectorAll<HTMLElement>('.layer-item').forEach(item => {
    const name = item.dataset.layer ?? '';
    const frozen = frozenLayers.has(name);
    const on = !frozen && (visible || layerVisibility.has(name));
    item.classList.toggle('hidden', !on);
    const visBtn = item.querySelector<HTMLElement>('.layer-toggle:not(.layer-freeze)');
    if (visBtn) visBtn.style.opacity = on ? '1' : '0.3';
  });
  rerender();
}

function showHelp(): void {
  const modal = document.getElementById('help-modal');
  const body  = document.getElementById('help-body');
  if (!modal || !body) return;
  if (!body.innerHTML) body.innerHTML = HELP_HTML;
  modal.classList.add('visible');
}

function showAbout(): void {
  const msg = 'Cadze v0.1 — Free & Open Source CAD Viewer\nDXF · DWG · STL\ngithub.com/sedattelli/cadze';
  const el = document.createElement('div');
  el.id = '_about';
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center';
  el.innerHTML = `<div style="background:#1e1e24;border:1px solid #2a2a3a;border-radius:12px;padding:32px 40px;max-width:360px;text-align:center;color:#e8e8f0;font-size:13px;line-height:1.7">
    <div style="font-size:22px;font-weight:700;color:#00e5ff;letter-spacing:1px;margin-bottom:16px">⬡ CADZE</div>
    <div style="white-space:pre-line;color:#8888aa">${msg}</div>
    <button onclick="this.closest('#_about').remove()" style="margin-top:24px;background:transparent;border:1px solid #2a2a3a;color:#8888aa;padding:6px 20px;border-radius:6px;cursor:pointer">Close</button>
  </div>`;
  document.body.appendChild(el);
  el.addEventListener('click', (e) => { if (e.target === el) el.remove(); });
}

// ── Layer panel ────────────────────────────────────────────────────────────────

function buildLayerPanel(layers: { name: string; color: number; visible: boolean }[]): void {
  const list = document.getElementById('layer-list')!;
  list.innerHTML = '';

  for (const layer of layers) {
    const item = document.createElement('div');
    item.className = 'layer-item';
    item.dataset.layer = layer.name;

    const dot = document.createElement('div');
    dot.className = 'layer-dot';
    dot.style.background = `#${layer.color.toString(16).padStart(6, '0')}`;

    const nameEl = document.createElement('div');
    nameEl.className = 'layer-name';
    nameEl.textContent = layer.name;
    nameEl.title = layer.name;

    // Visibility toggle
    const visBtn = document.createElement('button');
    visBtn.className = 'layer-toggle';
    visBtn.textContent = '👁';
    visBtn.title = 'Toggle visibility';
    visBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (layerVisibility.has(layer.name)) {
        layerVisibility.delete(layer.name);
        item.classList.add('hidden');
        visBtn.style.opacity = '0.3';
      } else {
        layerVisibility.add(layer.name);
        item.classList.remove('hidden');
        visBtn.style.opacity = '1';
      }
      rerender();
    });

    // Freeze toggle
    const frzBtn = document.createElement('button');
    frzBtn.className = 'layer-toggle layer-freeze';
    frzBtn.textContent = '❄';
    frzBtn.title = 'Freeze layer';
    frzBtn.style.opacity = '0.3';
    frzBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (frozenLayers.has(layer.name)) {
        frozenLayers.delete(layer.name);
        item.classList.remove('frozen');
        frzBtn.style.opacity = '0.3';
        layerVisibility.add(layer.name);
        visBtn.style.opacity = '1';
      } else {
        frozenLayers.add(layer.name);
        item.classList.add('frozen');
        frzBtn.style.opacity = '1';
        layerVisibility.delete(layer.name);
        visBtn.style.opacity = '0.3';
      }
      rerender();
    });

    item.appendChild(dot);
    item.appendChild(nameEl);
    item.appendChild(frzBtn);
    item.appendChild(visBtn);
    list.appendChild(item);
  }
}

function rerender(): void {
  if (rendererState && currentDxf) renderDxf(rendererState, currentDxf, layerVisibility);
}

// ── Properties panel ───────────────────────────────────────────────────────────

function updatePropertiesMulti(entities: any[]): void {
  const list = document.getElementById('props-list')!;
  const typeCounts: Record<string, number> = {};
  for (const e of entities) typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
  const summary = Object.entries(typeCounts).map(([type, n]) => `${n}× ${type}`).join(', ');
  list.innerHTML = `
    <div class="prop-row"><span class="prop-key">${t('props.selected')}</span><span class="prop-val">${entities.length}</span></div>
    <div class="prop-row"><span class="prop-key">${t('props.type')}</span><span class="prop-val prop-types">${summary}</span></div>
    <div class="prop-row prop-hint"><span class="prop-key">${t('props.delete_hint')}</span></div>
  `;
}

function updateProperties(entity: any | null): void {
  const list = document.getElementById('props-list')!;
  if (!entity) { list.innerHTML = `<div class="no-selection">${t('no_selection')}</div>`; return; }

  const rows: [string, string][] = [
    [t('props.type'),  entity.type],
    [t('props.layer'), entity.layer ?? '0'],
  ];

  if (entity.type === 'LINE' && entity.vertices?.length >= 2) {
    const dx = entity.vertices[1].x - entity.vertices[0].x;
    const dy = entity.vertices[1].y - entity.vertices[0].y;
    rows.push([t('props.length'), Math.sqrt(dx * dx + dy * dy).toFixed(2)]);
  }
  if (entity.radius !== undefined) rows.push([t('props.radius'), entity.radius.toFixed(2)]);

  if ((entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') && entity.closed) {
    const stats = calcPolylineStats(entity);
    if (stats) {
      rows.push([t('props.area'),      stats.area.toFixed(2)]);
      rows.push([t('props.perimeter'), stats.perimeter.toFixed(2)]);
    }
  }

  list.innerHTML = rows.map(([k, v]) =>
    `<div class="prop-row"><span class="prop-key">${k}</span><span class="prop-val">${v}</span></div>`
  ).join('');
}

// ── Labels ─────────────────────────────────────────────────────────────────────

export function refreshWorkspaceLabels(): void {
  const set = (id: string, text: string) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  set('panel-layers-title', t('layers'));
  set('panel-props-title',  t('properties'));
  set('export-pdf', `📄 ${t('export.pdf')}`);
  set('export-png', `🖼 ${t('export.png')}`);
  set('export-dxf', `💾 ${t('export.dxf')}`);
  const cmdInput = document.getElementById('cmd-input') as HTMLInputElement | null;
  if (cmdInput) cmdInput.placeholder = t('cmd.hint');
}
