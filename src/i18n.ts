import i18next, { type Resource } from 'i18next';

const SUPPORTED = ['en', 'tr', 'de', 'zh', 'ja'] as const;
export type LangCode = typeof SUPPORTED[number];

const LANG_META: Record<LangCode, { flag: string; name: string; native: string }> = {
  en: { flag: '🇬🇧', name: 'English',  native: 'English'  },
  tr: { flag: '🇹🇷', name: 'Türkçe',   native: 'Türkçe'   },
  de: { flag: '🇩🇪', name: 'Deutsch',  native: 'Deutsch'  },
  zh: { flag: '🇨🇳', name: '中文',     native: '中文'      },
  ja: { flag: '🇯🇵', name: '日本語',   native: '日本語'    },
};

function detectBrowserLang(): LangCode {
  const nav = navigator.language || (navigator as any).userLanguage || 'en';
  const code = nav.split('-')[0].toLowerCase();
  return SUPPORTED.includes(code as LangCode) ? (code as LangCode) : 'en';
}

async function detectSystemLang(): Promise<LangCode> {
  // Try Tauri native OS locale first
  if ('__TAURI_INTERNALS__' in window) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const code = await invoke<string>('get_system_locale');
      if (SUPPORTED.includes(code as LangCode)) return code as LangCode;
    } catch { /* fall through */ }
  }
  return detectBrowserLang();
}

export async function initI18n(): Promise<void> {
  const saved = localStorage.getItem('cadze_lang') as LangCode | null;
  const lang = (saved && SUPPORTED.includes(saved)) ? saved : await detectSystemLang();

  const resources: Resource = {};
  const imports = await Promise.all(
    SUPPORTED.map(code =>
      import(`./locales/${code}.json`).then(m => ({ code, data: m.default as Record<string, unknown> }))
    )
  );
  imports.forEach(({ code, data }) => { resources[code] = { translation: data }; });

  await i18next.init({
    lng: lang,
    fallbackLng: 'en',
    resources,
    interpolation: { escapeValue: false },
  });
}

export function t(key: string, vars?: Record<string, string | number>): string {
  return i18next.t(key, vars as any) as string;
}

export function currentLang(): LangCode {
  return (i18next.language as LangCode) || 'en';
}

export function setLang(code: LangCode): void {
  localStorage.setItem('cadze_lang', code);
  i18next.changeLanguage(code);
  document.dispatchEvent(new Event('lang-changed'));
}

export { SUPPORTED, LANG_META };
