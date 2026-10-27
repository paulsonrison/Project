import { useEffect,useState,type FormEvent } from 'react';
import { api,save } from '../../services/api';
import { useI18n,type Locale } from '../../i18n';
import { useAccount } from '../workspace/context';
export interface Preferences {revision:number;locale:Locale;localeSaved:boolean;onboardingVersion:number;ai:{revision:number;source:'default'|'custom';provider:'groq';hasCustomKey:boolean;customKeysAvailable:boolean}}
export default function PreferencesPanel({onSaved,onboarding=false}:{onSaved?:()=>void;onboarding?:boolean}){
  const {t,locale,setLocale}=useI18n(),account=useAccount();
  const [startingLocale]=useState(locale);
  const [prefs,setPrefs]=useState<Preferences|null>(null),[choice,setChoice]=useState<'default'|'custom'>('default'),[selectedLocale,setSelectedLocale]=useState<Locale>(locale),[key,setKey]=useState(''),[verification,setVerification]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  useEffect(()=>{const controller=new AbortController();api<Preferences>('/preferences',{signal:controller.signal}).then(data=>{setPrefs(data);setChoice(data.ai.source);setSelectedLocale(data.localeSaved?data.locale:startingLocale);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[account.userId,startingLocale]);
  async function run(action:()=>Promise<void>){setBusy(true);setError('');setNotice('');try{await action();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function testKey(){await run(async()=>{const result=await save<{verificationId:string}>('/preferences/ai-key/test',{key});setVerification(result.verificationId);setNotice(t('Key verified. Save to use it.'));});}
  async function submit(event:FormEvent){event.preventDefault();if(!prefs)return;await run(async()=>{
    let current=prefs;
    if(account.role==='admin'&&choice==='custom'&&key){if(!verification)throw new Error(t('Test your key before saving.'));current=await save<Preferences>('/preferences/ai-key',{key,verificationId:verification,revision:prefs.ai.revision},'PUT');setPrefs(current);setKey('');setVerification('');}
    const result=await save<Preferences>('/preferences',{revision:current.revision,locale:selectedLocale,...(onboarding?{onboardingVersion:1}:{}),...(account.role==='admin'?{aiSource:choice,aiRevision:current.ai.revision}:{})},'PATCH');
    setPrefs(result);setLocale(result.locale,false);setNotice(t('Settings saved.'));onSaved?.();
  });}
  async function removeKey(){if(!prefs||!window.confirm(t('Remove your saved API key and use included AI?')))return;await run(async()=>{const result=await save<Preferences>('/preferences/ai-key',{revision:prefs.ai.revision},'DELETE');setPrefs(result);setChoice('default');setKey('');setVerification('');setNotice(t('API key removed. Included AI is selected.'));});}
  if(!prefs)return <div className="editor-form">{error?<p role="alert">{t(error)} <button className="button" onClick={()=>window.location.reload()}>{t('Retry')}</button></p>:<p role="status">{t('Loading settings…')}</p>}</div>;
  return <section>{!onboarding&&<div className="section-intro"><h1>{t('Preferences')}</h1></div>}<form className="editor-form preferences-panel" onSubmit={submit}>
    <label>{t('Language')}<select aria-label={t('Preferred language')} value={selectedLocale} disabled={busy} onChange={e=>{const value=e.target.value as Locale;setSelectedLocale(value);setLocale(value,false);}}><option value="en-IN">English</option><option value="hi-IN">हिन्दी</option><option value="ml-IN">മലയാളം</option></select></label>
    {account.role==='admin'&&<fieldset className="ai-service-choice"><legend>{t('AI service')}</legend>
      <label><input type="radio" name="ai-source" value="default" checked={choice==='default'} disabled={busy} onChange={()=>setChoice('default')}/><span>{t('Use included AI')}</span></label>
      <label><input type="radio" name="ai-source" value="custom" checked={choice==='custom'} disabled={busy} onChange={()=>setChoice('custom')}/><span>{t('Use my own API key')}</span></label>
      {choice==='custom'&&<div className="custom-key-fields">{!prefs.ai.customKeysAvailable&&<p className="notice">{t('Personal API keys are not available yet. Use included AI.')}</p>}
        {prefs.ai.hasCustomKey&&<p>{t('Key saved')}</p>}
        <label>{t(prefs.ai.hasCustomKey?'Replace Groq API key':'Groq API key')}<input type="password" value={key} maxLength={512} autoComplete="off" spellCheck={false} disabled={busy||!prefs.ai.customKeysAvailable} onChange={e=>{setKey(e.target.value);setVerification('');setNotice('');}}/></label>
        <p>{t('Your provider may charge for requests made with your key.')}</p><a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">{t('Get a Groq API key')}</a>
        <div className="row-actions"><button type="button" className="button" onClick={testKey} disabled={busy||!key.trim()||!prefs.ai.customKeysAvailable}>{t('Test key')}</button>{prefs.ai.hasCustomKey&&<button type="button" className="button" disabled={busy} onClick={removeKey}>{t('Remove key')}</button>}</div>
      </div>}
    </fieldset>}
    {error&&<p className="notice error" role="alert">{t(error)}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
    <div className="form-actions"><button className="button primary" disabled={busy||(choice==='custom'&&(!prefs.ai.customKeysAvailable||(!prefs.ai.hasCustomKey&&!key)))}>{t(busy?'Saving…':onboarding?'Continue':'Save settings')}</button></div>
  </form></section>;
}
