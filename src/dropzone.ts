import { t } from './i18n';
import { loadFile, addRecentFile, getRecentFiles, formatTimeAgo } from './dxf-loader';
import { showWorkspace } from './workspace';

const SUPPORTED_EXTS = new Set(['dxf', 'dwg', 'stl']);

export function setupDropzone(): void {
  const area      = document.getElementById('dropzone-area')!;
  const fileInput = document.getElementById('file-input') as HTMLInputElement;

  const hasTauri = '__TAURI_INTERNALS__' in window;

  // ── File input fallback (browser / non-Tauri DXF) ────────────────────────
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (file) await handleBrowserFile(file);
    fileInput.value = '';
  });

  // ── Click / Ctrl+O: ALWAYS try native dialog first ───────────────────────
  const openFile = (): void => {
    openTauriDialog();
  };

  // Attach directly to the browse button AND the area (belt + suspenders)
  document.getElementById('dropzone-browse')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openFile();
  });
  area.addEventListener('click', openFile);
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'o') { e.preventDefault(); openFile(); }
  });

  // ── Browser drag-drop (non-Tauri only) ───────────────────────────────────
  if (!hasTauri) {
    area.addEventListener('dragover',  (e) => { e.preventDefault(); area.classList.add('drag-over'); });
    area.addEventListener('dragleave', ()  => area.classList.remove('drag-over'));
    area.addEventListener('drop', async (e) => {
      e.preventDefault();
      area.classList.remove('drag-over');
      const file = e.dataTransfer?.files[0];
      if (file) await handleBrowserFile(file);
    });
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', async (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files[0];
      if (file) await handleBrowserFile(file);
    });
  }

  // ── Tauri native drag-drop ───────────────────────────────────────────────
  if (hasTauri) {
    setupTauriFileDrop().catch(console.error);
  }

  renderRecentFiles();

  // Allow workspace.ts to trigger open without circular import
  document.addEventListener('cadze:open', () => openTauriDialog());
}

async function openTauriDialog(): Promise<void> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const result = await open({
      multiple: false,
      filters: [
        { name: 'CAD Files', extensions: ['dwg', 'dxf', 'stl'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (!result) return;

    const filePath = result as string;
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    if (!SUPPORTED_EXTS.has(ext)) return;

    await handleTauriPath(filePath);
  } catch {
    (document.getElementById('file-input') as HTMLInputElement).click();
  }
}

async function setupTauriFileDrop(): Promise<void> {
  const { getCurrentWebview } = await import('@tauri-apps/api/webview');
  const webview = getCurrentWebview();

  await webview.onDragDropEvent(async (e) => {
    const area = document.getElementById('dropzone-area');
    if (e.payload.type === 'enter') {
      area?.classList.add('drag-over');
    } else if (e.payload.type === 'leave') {
      area?.classList.remove('drag-over');
    } else if (e.payload.type === 'drop') {
      area?.classList.remove('drag-over');
      const paths = e.payload.paths;
      if (!paths?.length) return;
      const filePath = paths[0];
      const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
      if (!SUPPORTED_EXTS.has(ext)) return;
      await handleTauriPath(filePath);
    }
  });
}

async function handleTauriPath(filePath: string): Promise<void> {
  const name = filePath.split(/[\\/]/).pop() ?? filePath;
  const ext  = filePath.split('.').pop()?.toLowerCase() ?? '';
  addRecentFile(name);
  renderRecentFiles();
  await showWorkspace({ name, type: ext as any, dxf: null }, filePath);
}

async function handleBrowserFile(file: File): Promise<void> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!SUPPORTED_EXTS.has(ext)) return;
  addRecentFile(file.name);
  renderRecentFiles();
  const loaded = await loadFile(file);
  await showWorkspace(loaded);
}

export function renderRecentFiles(): void {
  const container = document.getElementById('recent-list');
  const section   = document.getElementById('recent-section');
  if (!container || !section) return;

  const files = getRecentFiles();
  if (!files.length) { section.style.display = 'none'; return; }

  section.style.display = 'block';
  const titleEl = document.getElementById('recent-title');
  if (titleEl) titleEl.textContent = t('dropzone.recent');

  container.innerHTML = files.map(f => `
    <div class="recent-item" data-name="${escHtml(f.name)}">
      <span class="recent-item-icon">📄</span>
      <span class="recent-item-name">${escHtml(f.name)}</span>
      <span class="recent-item-meta">${f.ext.toUpperCase()} · ${formatTimeAgo(f.timestamp)}</span>
    </div>
  `).join('');

  container.querySelectorAll('.recent-item').forEach(el => {
    el.addEventListener('click', () => openTauriDialog());
  });
}

export function refreshDropzoneLabels(): void {
  const set = (id: string, text: string) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  set('dropzone-title',   t('dropzone.title'));
  set('dropzone-formats', t('dropzone.formats'));
  set('dropzone-browse',  t('dropzone.browse'));
  set('dropzone-or',      t('dropzone.or'));
}


function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
