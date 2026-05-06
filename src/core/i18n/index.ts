import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import es from './translations/es';
import en from './translations/en';
import type { TranslationKeys } from './translations/es';

type Language = 'es' | 'en';

const translations: Record<Language, TranslationKeys> = { es, en };

const LANG_KEY = '@obratrack_lang';

interface LangState {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  loadLanguage: () => Promise<void>;
}

export const useLangStore = create<LangState>((set) => ({
  language: 'es',

  setLanguage: async (lang) => {
    set({ language: lang });
    await AsyncStorage.setItem(LANG_KEY, lang);
  },

  loadLanguage: async () => {
    try {
      const stored = await AsyncStorage.getItem(LANG_KEY);
      if (stored === 'es' || stored === 'en') {
        set({ language: stored });
      }
    } catch {
      // keep default
    }
  },
}));

export function useT(): TranslationKeys {
  const language = useLangStore((s) => s.language);
  return translations[language];
}
