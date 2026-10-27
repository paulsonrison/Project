import { createElement, createContext, useCallback, useContext, useEffect, useRef,useState, type ReactNode } from 'react';
import { normalizeLocale, translateFor, type Locale, type Params } from './messages';
import { api,save } from '../services/api';
export { dictionaries, normalizeLocale, translateFor, type Locale, type Params } from './messages';
export { formatBusinessDate, formatMoney } from './format';

const storageKey = 'presstrack.locale';
export function getLocale(): Locale {
  try { return normalizeLocale(typeof window === 'undefined' ? null : window.localStorage.getItem(storageKey)||(typeof navigator==='undefined'?null:navigator.language)); }
  catch { return 'en-IN'; }
}
export function translate(key: string, params?: Params): string { return translateFor(getLocale(), key, params); }
interface I18nContextValue { locale: Locale; setLocale: (locale: Locale,persist?:boolean) => void; setAccount: (id: string | null) => void; t: (key: string, params?: Params) => string }
const I18nContext = createContext<I18nContextValue>({ locale: 'en-IN', setLocale: () => {}, setAccount: () => {}, t: key => key });
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getLocale);
  const [accountId, setAccountId] = useState<string | null>(null);
  const activeAccount=useRef<string|null>(null),changeVersion=useRef(0),saveQueue=useRef<Promise<void>>(Promise.resolve());
  const setAccount = useCallback((id: string | null) => {
    setAccountId(id);activeAccount.current=id;
    if (!id) return;
    try { const saved = window.localStorage.getItem(`${storageKey}.${id}`); if (saved) { const locale = normalizeLocale(saved); setLocaleState(locale); window.localStorage.setItem(storageKey, locale); } } catch { /* Keep the browser preference when storage is unavailable. */ }
    const version=changeVersion.current;
    api<{locale:Locale;localeSaved:boolean}>('/preferences').then(data=>{
      if(activeAccount.current!==id||changeVersion.current!==version||!data.localeSaved)return;
      const locale=normalizeLocale(data.locale);setLocaleState(locale);try{window.localStorage.setItem(`${storageKey}.${id}`,locale);window.localStorage.setItem(storageKey,locale);}catch{/* Local preference remains usable. */}
    }).catch(()=>{});
  }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const setLocale=useCallback((value: Locale,persist=true) => {
    changeVersion.current++;
    const normalized = normalizeLocale(value); setLocaleState(normalized);
    try { window.localStorage.setItem(storageKey, normalized); if (accountId) window.localStorage.setItem(`${storageKey}.${accountId}`, normalized); } catch { /* Language still works when storage is unavailable. */ }
    if(persist&&accountId){
      const id=accountId;
      saveQueue.current=saveQueue.current.catch(()=>{}).then(async()=>{
        if(activeAccount.current!==id)return;
        for(let attempt=0;attempt<2;attempt++){
          const current=await api<{revision:number}>('/preferences');
          if(activeAccount.current!==id)return;
          try{await save('/preferences',{revision:current.revision,locale:normalized},'PATCH');return;}catch(error){if(attempt===1)throw error;}
        }
      }).catch(()=>{});
    }
  },[accountId]);
  const value: I18nContextValue = { locale, setLocale, setAccount, t: (key, params) => translateFor(locale, key, params) };
  // The context contains callbacks that use refs only when invoked, never during render.
  // eslint-disable-next-line react-hooks/refs
  return createElement(I18nContext.Provider, { value }, children);
}
export function useI18n(): I18nContextValue { return useContext(I18nContext); }
