import { initI18n, t, setLang, currentLang, SUPPORTED, LANG_META, type LangCode } from './i18n';
import { setupDropzone, refreshDropzoneLabels } from './dropzone';
import { setupToolbar, setupCommandLine, setupExport, setupMenubar, setupContextMenu, setupKeyboardShortcuts, refreshWorkspaceLabels } from './workspace';

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
  setupZoomButtons();
  setupTabNew();

  // Re-apply all labels when language changes
  document.addEventListener('lang-changed', () => {
    applyLabels();
  });
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

  // Toolbar tooltips
  document.getElementById('tool-zoom')?.setAttribute('data-tip', t('toolbar.zoom'));
  document.getElementById('tool-measure')?.setAttribute('data-tip', t('toolbar.measure'));
  document.getElementById('tool-edit')?.setAttribute('data-tip', t('toolbar.edit'));
  document.getElementById('tool-home')?.setAttribute('data-tip', t('toolbar.home'));

  // Command input placeholder
  const cmdInput = document.getElementById('cmd-input') as HTMLInputElement;
  if (cmdInput) cmdInput.placeholder = t('cmd.hint');

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
