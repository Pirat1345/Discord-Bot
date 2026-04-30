import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { apiFetch } from '@/lib/apiClient';

// Will be populated from the server
const resources: Record<string, { translation: Record<string, unknown> }> = {};

i18n.use(initReactI18next).init({
  resources,
  lng: 'de',
  fallbackLng: 'de',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export async function loadLanguagesFromServer() {
  try {
    const data = await apiFetch<{ languages: Array<{ code: string; name: string }> }>('/languages');
    const currentLang = i18n.language || 'de';

    for (const lang of data.languages) {
      try {
        const translations = await apiFetch<Record<string, unknown>>(`/languages/${lang.code}`);
        i18n.addResourceBundle(lang.code, 'translation', translations, true, true);
      } catch {
        // Skip languages that fail to load
      }
    }

    // Re-set language to trigger re-render with loaded resources
    if (i18n.hasResourceBundle(currentLang, 'translation')) {
      await i18n.changeLanguage(currentLang);
    }
  } catch {
    // Server not reachable — keep defaults
  }
}

export async function setLanguage(code: string) {
  // Always fetch the latest bundle to ensure completeness
  try {
    const translations = await apiFetch<Record<string, unknown>>(`/languages/${code}`);
    i18n.addResourceBundle(code, 'translation', translations, true, true);
  } catch {
    // If fetch fails but bundle exists locally, still switch
    if (!i18n.hasResourceBundle(code, 'translation')) return;
  }
  await i18n.changeLanguage(code);
}

// Eagerly load languages on startup (GET endpoints are public)
export const languagesReady = loadLanguagesFromServer();

export default i18n;
