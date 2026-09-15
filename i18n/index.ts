import { useCallback } from 'react';

import { useSettingsStore, type Language } from '@/store/settingsStore';

import { en, type TranslationKey } from './en';
import { tr } from './tr';

export type { TranslationKey };

const dictionaries: Record<Language, Record<TranslationKey, string>> = { en, tr };

export type TranslateParams = Record<string, string | number>;

export function translate(language: Language, key: TranslationKey, params?: TranslateParams): string {
  const template = dictionaries[language][key] ?? en[key] ?? key;
  if (!params) return template;
  return Object.keys(params).reduce(
    (text, name) => text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(params[name])),
    template,
  );
}

export type Translator = (key: TranslationKey, params?: TranslateParams) => string;

/** Hook returning a translator bound to the current language. */
export function useT(): Translator {
  const language = useSettingsStore((s) => s.language);
  return useCallback((key: TranslationKey, params?: TranslateParams) => translate(language, key, params), [language]);
}

export function useLanguage(): Language {
  return useSettingsStore((s) => s.language);
}

/** Non-hook access for services / stores. */
export function t(key: TranslationKey, params?: TranslateParams): string {
  return translate(useSettingsStore.getState().language, key, params);
}

/** Locale-aware case conversion (Turkish dotted/dotless I) without relying on Intl availability. */
export function upperCase(text: string, language: Language): string {
  if (language === 'tr') return text.replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase();
  return text.toUpperCase();
}

export function lowerCase(text: string, language: Language): string {
  if (language === 'tr') return text.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
  return text.toLowerCase();
}
