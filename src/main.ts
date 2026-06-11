import { initI18n, t, setLang, currentLang, SUPPORTED, LANG_META, type LangCode } from './i18n';
import { setupDropzone, refreshDropzoneLabels } from './dropzone';
import { setupToolbar, setupCommandLine, setupExport, setupMenubar, setupContextMenu, setupKeyboardShortcuts, refreshWorkspaceLabels, setDefaultOpenZoom, getDefaultOpenZoom } from './workspace';

async function main(): Promise<void> {
  await initI18n();
  applyLabels();
  setupDropzone();
  setupMenubar();
  setupToolbar();
  setupCommandLine();
  setupExport();
  setupContextMenu();
  setupKeyboardShortcuts();
  setupLayerButtons();
  setupMeasureClear();
  setupStatusbarControls();
  setupSettings();
  setupInfobar();
  setupHelp();
  setupAbout();
  setupZoomButtons();
  setupTabNew();

  document.addEventListener('lang-changed', () => {
    applyLabels();
  });

  if ('__TAURI_INTERNALS__' in window) {
    const { invoke } = await import('@tauri-apps/api/core');
    const startupFile = await invoke<string | null>('get_startup_file');
    if (startupFile) {
      const { openFilePath } = await import('./workspace');
      await openFilePath(startupFile);
    }
  }
}

// Replace text of a menu/context-menu item while keeping <kbd> children intact
function setMenuItemText(el: Element, text: string): void {
  const kbds = Array.from(el.querySelectorAll('kbd'));
  while (el.firstChild) el.removeChild(el.firstChild);
  el.appendChild(document.createTextNode(text + (kbds.length ? ' ' : '')));
  kbds.forEach(kbd => el.appendChild(kbd));
}

function applyLabels(): void {
  // Titlebar
  document.getElementById('btn-settings')!.title = t('titlebar.settings');

  // Dropzone
  refreshDropzoneLabels();

  // Footer
  document.getElementById('footer-local')!.textContent = t('footer.local');
  document.getElementById('footer-opensource')!.textContent = t('footer.opensource');

  // Infobar report button
  document.getElementById('infobar-report')!.textContent = t('infobar.report');

  // Workspace (only if visible)
  try { refreshWorkspaceLabels(); } catch { /* workspace not mounted yet */ }

  // Settings modal
  document.getElementById('modal-title')!.textContent = t('settings.title');
  document.getElementById('lang-label')!.textContent = t('settings.language');
  const kbLabel = document.getElementById('settings-keyboard-label');
  if (kbLabel) kbLabel.textContent = t('settings.keyboard');
  const zoomLabel = document.getElementById('zoom-label');
  if (zoomLabel) zoomLabel.textContent = t('settings.open_zoom');

  // Toolbar data-tip tooltips
  document.getElementById('tool-zoom')?.setAttribute('data-tip', t('toolbar.zoom'));
  document.getElementById('tool-measure')?.setAttribute('data-tip', t('toolbar.measure'));
  document.getElementById('tool-edit')?.setAttribute('data-tip', t('toolbar.edit'));
  document.getElementById('tool-home')?.setAttribute('data-tip', t('toolbar.home'));
  document.getElementById('tool-pan')?.setAttribute('data-tip', t('toolbar.pan'));
  document.getElementById('tool-zoom-window')?.setAttribute('data-tip', t('toolbar.zoom_window'));
  document.getElementById('tool-measure')?.setAttribute('data-tip', t('toolbar.measure_dist'));
  document.getElementById('tool-angle')?.setAttribute('data-tip', t('toolbar.measure_angle'));
  document.getElementById('tool-area')?.setAttribute('data-tip', t('toolbar.measure_area'));
  document.getElementById('tool-note')?.setAttribute('data-tip', t('toolbar.note'));
  document.getElementById('tool-trim')?.setAttribute('data-tip', t('toolbar.trim'));
  document.getElementById('tool-extend')?.setAttribute('data-tip', t('toolbar.extend'));
  document.getElementById('tool-offset')?.setAttribute('data-tip', t('toolbar.offset'));
  document.getElementById('tool-move')?.setAttribute('data-tip', t('toolbar.move'));
  document.getElementById('tool-copy')?.setAttribute('data-tip', t('toolbar.copy'));
  document.getElementById('tool-rotate')?.setAttribute('data-tip', t('toolbar.rotate'));
  document.getElementById('tool-scale')?.setAttribute('data-tip', t('toolbar.scale'));
  document.getElementById('tool-mirror')?.setAttribute('data-tip', t('toolbar.mirror'));
  document.getElementById('tool-fit')?.setAttribute('data-tip', t('toolbar.fit'));

  // Command input placeholder
  const cmdInput = document.getElementById('cmd-input') as HTMLInputElement;
  if (cmdInput) cmdInput.placeholder = t('cmd.hint');

  // Note input placeholder
  const noteInput = document.getElementById('note-input') as HTMLTextAreaElement | null;
  if (noteInput) noteInput.placeholder = t('note.placeholder');

  // Menubar — top-level labels
  document.querySelectorAll<HTMLElement>('[data-menu]').forEach(item => {
    const key = item.dataset.menu!;
    const label = item.querySelector('.menu-label');
    if (label) label.textContent = t(`menu.${key}`);
  });

  // Menubar — command items (data-cmd → menu.* key)
  const menuCmdKey: Record<string, string> = {
    'new':              'menu.new',
    'open':             'menu.open',
    'export-png':       'menu.export_png',
    'export-pdf':       'menu.export_pdf',
    'export-dxf':       'menu.export_dxf',
    'close-file':       'menu.close_file',
    'zoom-in':          'menu.zoom_in',
    'zoom-out':         'menu.zoom_out',
    'fit-view':         'menu.fit_view',
    'toggle-bg':        'menu.toggle_bg',
    'fullscreen':       'menu.fullscreen',
    'tool-pan':         'menu.tool_pan',
    'tool-zoom-window': 'menu.tool_zoom_window',
    'tool-measure':     'menu.tool_measure',
    'tool-angle':       'menu.tool_angle',
    'tool-area':        'menu.tool_area',
    'tool-note':        'menu.tool_note',
    'tool-move':        'menu.tool_move',
    'tool-copy':        'menu.tool_copy',
    'tool-rotate':      'menu.tool_rotate',
    'tool-scale':       'menu.tool_scale',
    'tool-mirror':      'menu.tool_mirror',
    'toggle-osnap':     'menu.toggle_osnap',
    'toggle-ortho':     'menu.toggle_ortho',
    'layers-all':       'menu.layers_all',
    'layers-none':      'menu.layers_none',
    'undo':             'menu.undo',
    'redo':             'menu.redo',
    'clear-measure':    'menu.clear_measure',
    'clear-notes':      'menu.clear_notes',
    'user-manual':      'menu.user_manual',
    'report':           'menu.report',
    'about':            'menu.about',
    'settings':         'menu.settings',
  };
  document.querySelectorAll<HTMLElement>('.menu-cmd[data-cmd]').forEach(el => {
    const key = menuCmdKey[el.dataset.cmd!];
    if (key) setMenuItemText(el, t(key));
  });

  // Context menu command items
  const ctxCmdKey: Record<string, string> = {
    'fit-view':         'ctx.fit_view',
    'zoom-in':          'ctx.zoom_in',
    'zoom-out':         'ctx.zoom_out',
    'tool-pan':         'ctx.tool_pan',
    'tool-zoom-window': 'ctx.tool_zoom_window',
    'tool-measure':     'ctx.tool_measure',
    'clear-measure':    'ctx.clear_measure',
    'export-png':       'ctx.export_png',
    'export-pdf':       'ctx.export_pdf',
  };
  document.querySelectorAll<HTMLElement>('.ctx-cmd[data-cmd]').forEach(el => {
    const key = ctxCmdKey[el.dataset.cmd!];
    if (key) setMenuItemText(el, t(key));
  });

  // Render lang grid
  buildLangGrid();
}

function buildLangGrid(): void {
  const grid = document.getElementById('lang-grid')!;
  const cur = currentLang();
  grid.innerHTML = '';

  for (const code of SUPPORTED) {
    const meta = LANG_META[code];
    const opt = document.createElement('div');
    opt.className = `lang-option${code === cur ? ' active' : ''}`;
    opt.innerHTML = `
      <span class="lang-option-flag">${meta.flag}</span>
      <span class="lang-option-name">${meta.name}</span>
      <span class="lang-option-native">${meta.native}</span>
    `;
    opt.addEventListener('click', () => {
      setLang(code as LangCode);
      buildLangGrid();
    });
    grid.appendChild(opt);
  }
}

function setupSettings(): void {
  const modal = document.getElementById('settings-modal')!;
  document.getElementById('btn-settings')!.addEventListener('click', () => {
    modal.classList.add('visible');
  });
  document.getElementById('modal-close')!.addEventListener('click', () => {
    modal.classList.remove('visible');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('visible');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('visible')) {
      modal.classList.remove('visible');
    }
  });
  document.addEventListener('cadze:open-settings', () => {
    modal.classList.add('visible');
  });

  // Zoom slider
  const zoomSlider  = document.getElementById('zoom-slider') as HTMLInputElement | null;
  const zoomDisplay = document.getElementById('zoom-value-display') as HTMLElement | null;
  if (zoomSlider && zoomDisplay) {
    zoomSlider.value = String(getDefaultOpenZoom());
    zoomDisplay.textContent = zoomSlider.value + '%';
    zoomSlider.addEventListener('input', () => {
      const val = parseInt(zoomSlider.value, 10);
      zoomDisplay.textContent = val + '%';
      setDefaultOpenZoom(val);
    });
  }
}

function setupHelp(): void {
  const modal = document.getElementById('help-modal')!;
  document.getElementById('help-close')!.addEventListener('click', () => {
    modal.classList.remove('visible');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('visible');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('visible')) {
      modal.classList.remove('visible');
    }
  });
}

function setupAbout(): void {
  const modal = document.getElementById('about-modal')!;
  document.getElementById('about-close')!.addEventListener('click', () => {
    modal.classList.remove('visible');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('visible');
  });
  document.getElementById('about-github')!.addEventListener('click', (e) => {
    e.preventDefault();
    window.open('https://github.com/SedatTelli/cadze', '_blank');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('visible')) {
      modal.classList.remove('visible');
    }
  });
}

function setupInfobar(): void {
  document.getElementById('infobar-close')!.addEventListener('click', () => {
    document.getElementById('infobar')!.classList.remove('visible');
  });
  document.getElementById('infobar-report')!.addEventListener('click', () => {
    window.open('https://github.com/sedattelli/cadze/issues', '_blank');
  });
}

function setupZoomButtons(): void {
  document.getElementById('tool-zoom-in')?.addEventListener('click', () => {
    import('./workspace').then(m => m.executeCmd('zoom-in'));
  });
  document.getElementById('tool-zoom-out')?.addEventListener('click', () => {
    import('./workspace').then(m => m.executeCmd('zoom-out'));
  });
}

function setupTabNew(): void {
  document.getElementById('tab-new')?.addEventListener('click', () => {
    import('./workspace').then(m => m.executeCmd('open'));
  });
}

function setupLayerButtons(): void {
  document.getElementById('layers-all-btn')?.addEventListener('click', () => {
    import('./workspace').then(m => m.executeCmd('layers-all'));
  });
  document.getElementById('layers-none-btn')?.addEventListener('click', () => {
    import('./workspace').then(m => m.executeCmd('layers-none'));
  });
}

function setupMeasureClear(): void {
  document.getElementById('status-measure-clear')?.addEventListener('click', () => {
    import('./workspace').then(m => m.executeCmd('clear-measure'));
  });
}

function setupStatusbarControls(): void {
  document.getElementById('osnap-indicator')?.addEventListener('click', () => {
    import('./workspace').then(m => m.executeCmd('toggle-osnap'));
  });

  const unitSel = document.getElementById('unit-select') as HTMLSelectElement | null;
  unitSel?.addEventListener('change', () => {
    import('./workspace').then(m => m.executeCmd('unit-' + unitSel.value));
  });
}

main().catch(console.error);
