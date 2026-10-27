import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { normalizeLocale, translateFor, type Locale, type Params } from './messages';
export { dictionaries, normalizeLocale, translateFor, type Locale, type Params } from './messages';
export { formatBusinessDate, formatMoney } from './format';

const storageKey = 'presstrack.locale';
export function getLocale(): Locale {
  try { return normalizeLocale(typeof window === 'undefined' ? null : window.localStorage.getItem(storageKey)); }
  catch { return 'en-IN'; }
}
export function translate(key: string, params?: Params): string { return translateFor(getLocale(), key, params); }
interface I18nContextValue { locale: Locale; setLocale: (locale: Locale) => void; setAccount: (id: string | null) => void; t: (key: string, params?: Params) => string }
const I18nContext = createContext<I18nContextValue>({ locale: 'en-IN', setLocale: () => {}, setAccount: () => {}, t: key => key });
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getLocale);
  const [accountId, setAccountId] = useState<string | null>(null);
  const setAccount = useCallback((id: string | null) => {
    setAccountId(id);
    if (!id) return;
    try { const saved = window.localStorage.getItem(`${storageKey}.${id}`); if (saved) { const locale = normalizeLocale(saved); setLocaleState(locale); window.localStorage.setItem(storageKey, locale); } } catch { /* Keep the browser preference when storage is unavailable. */ }
  }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  function setLocale(value: Locale) {
    const normalized = normalizeLocale(value); setLocaleState(normalized);
    try { window.localStorage.setItem(storageKey, normalized); if (accountId) window.localStorage.setItem(`${storageKey}.${accountId}`, normalized); } catch { /* Language still works when storage is unavailable. */ }
  }
  const value: I18nContextValue = { locale, setLocale, setAccount, t: (key, params) => translateFor(locale, key, params) };
  return createElement(I18nContext.Provider, { value }, children);
}
export function useI18n(): I18nContextValue { return useContext(I18nContext); }
