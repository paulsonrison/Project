import { useState } from 'react';
import Dialog from '../../components/common/Dialog';
import { save, money } from '../../services/api';
import { useI18n } from '../../i18n';
type Mode='add'|'update'|'remove'|'replace';
interface Parsed {templateId?:string;headers:string[];rows:Record<string,string>[]}
interface Preview {id:string;errors:{row:number;message:string}[];changes:{action:string;collection:string;label:string;data:Record<string,unknown>}[]}
const headers=['Name','Number','Address/Flat','Address','Start Date','Customer ID','Newspaper ID','Revision','Code','Edition/City','Amount (INR)','From Date','To Date (optional)','Schedule','Remove?'];
const labels:Record<string,string>={name:'Name',phone:'Number',unit:'Address/Flat',address:'Address',code:'Code',edition:'Edition/City',schedule:'Schedule',startDate:'Start Date',endDate:'Stop date (not delivered)',quantity:'Copies',routeOrder:'Route order',archivedDate:'Stop date (not delivered)',basePrice:'Price per issue',instructions:'Delivery instructions'};
function inclusiveEnd(date:string){const value=new Date(`${date}T12:00:00Z`);value.setUTCDate(value.getUTCDate()-1);return value.toISOString().slice(0,10);}
export default function ExcelWizard({entity,onSaved}:{entity:'residents'|'publications';onSaved:()=>void}) {
  const {t,locale}=useI18n();
  const [open,setOpen]=useState(false),[mode,setMode]=useState<Mode>('add'),[parsed,setParsed]=useState<Parsed|null>(null),[mapping,setMapping]=useState<Record<string,string>>({}),[preview,setPreview]=useState<Preview|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[effective,setEffective]=useState(''),[confirmed,setConfirmed]=useState(false),[result,setResult]=useState('');
  async function run(fn:()=>Promise<void>){setBusy(true);setError('');try{await fn();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function download(){await run(async()=>{
    const response=await fetch('/api/v1/imports/template',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({entity,mode,locale:locale.split('-')[0]})});
    if(!response.ok){const body=await response.json();throw new Error(body.error?.message||'Download failed');}
    const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download=`presstrack-${entity}-${mode}.xlsx`;link.click();URL.revokeObjectURL(url);
  });}
  async function upload(file:File){await run(async()=>{
    if(file.size>10*1024*1024)throw new Error(t('Choose a workbook smaller than 10 MB'));
    const form=new FormData();form.append('file',file);
    const response=await fetch('/api/v1/imports/upload',{method:'POST',credentials:'same-origin',body:form});const body=await response.json();if(!response.ok)throw new Error(body.error?.message||'Upload failed');
    setParsed(body);setMapping({});setPreview(null);setConfirmed(false);setResult('');
  });}
  async function review(){if(!parsed)return;await run(async()=>{setPreview(await save<Preview>('/imports/preview',{entity,mode,...parsed,mapping,effectiveDate:effective||undefined}));setConfirmed(false);});}
  async function commit(){if(!preview)return;await run(async()=>{const response=await save<{changed:number}>(`/imports/${preview.id}/commit`,{});setResult(t('Saved {count} changes',{count:response.changed}));setPreview(null);setParsed(null);onSaved();});}
  function reset(next:Mode){setMode(next);setParsed(null);setPreview(null);setMapping({});setConfirmed(false);setResult('');setError('');}
  return <><button type="button" className="button" onClick={()=>setOpen(true)}>{t('Add using Excel')}</button>{open&&<Dialog title={t('Add using Excel')} onClose={()=>!busy&&setOpen(false)}><div className="excel-wizard">
    <p>{t('Download a workbook, fill it, upload it and review before saving.')}</p>
    <label>{t('1. Choose what to do')}<select value={mode} disabled={busy} onChange={e=>reset(e.target.value as Mode)}><option value="add">{t('Add new')}</option><option value="update">{t('Update existing')}</option><option value="remove">{t('Remove selected')}</option><option value="replace">{t('Replace selected scope')}</option></select></label>
    <p className="notice">{t(mode==='add'?'A blank workbook creates new records. Existing records stay unchanged.':mode==='update'?'Your current records are included. Blank cells mean no change.':mode==='remove'?'Your current records are included. Only Remove? Yes archives a record.':'Every exported ID must stay in the workbook. Mark Remove? Yes explicitly. History is retained.')}</p>
    <button className="button" disabled={busy} onClick={download}>{t('2. Download Excel format')}</button>
    <label>{t('3. Upload completed workbook')}<input aria-label={t('Upload Excel workbook')} type="file" accept=".xlsx" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.target.value='';}} /></label>
    {parsed&&<><p>{t('{count} rows found',{count:parsed.rows.length})}</p><details><summary>{t('Check field mapping')}</summary><p>{t('Keep subscription headers as Subscription: CODE. Unknown codes need correction.')}</p>{parsed.headers.map(header=><label key={header}>{header}<select value={mapping[header]||header} onChange={e=>{setMapping({...mapping,[header]:e.target.value});setPreview(null);}}><option value={header}>{header}</option>{headers.filter(h=>h!==header).map(h=><option key={h} value={h}>{t(h)}</option>)}</select></label>)}</details><label>{t('Effective date for subscription changes')}<input type="date" value={effective} onChange={e=>{setEffective(e.target.value);setPreview(null);}} /></label><button disabled={busy} className="button primary" onClick={review}>{t('4. Review changes')}</button></>}
    {preview&&<div aria-live="polite"><h3>{t('Review changes')}</h3><p>{t('{count} changes proposed',{count:preview.changes.length})}</p><div className="import-preview-list">{preview.changes.map((change,i)=><article key={i}><strong>{t(change.action)} · {change.label}</strong><p>{Object.entries(change.data).filter(([key])=>labels[key]).map(([key,value])=>`${t(labels[key])}: ${key==='basePrice'?money(Number(value)):key==='schedule'?t(String(value)):String(value)}`).join(' · ')}</p>{Array.isArray(change.data.rateIntervals)&&<div>{(change.data.rateIntervals as {validFrom:string;validToExclusive?:string;price:number}[]).map((rate,index)=><p key={index}>{t('From date')}: {rate.validFrom} · {t('To Date (optional)')}: {rate.validToExclusive?inclusiveEnd(rate.validToExclusive):t('Until changed')} · {money(rate.price)}</p>)}</div>}</article>)}</div>{preview.errors.length>0?<><p role="alert">{t('Correct these errors before saving')}</p><ul>{preview.errors.map((item,i)=><li key={i}>{t('Row')} {item.row}: {t(item.message)}</li>)}</ul><a className="button" href={`/api/v1/imports/${preview.id}/errors`}>{t('Download error workbook')}</a></>:<><label className="import-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} />{t('I reviewed these changes, including any removals and rate changes.')}</label><button className="button primary" disabled={busy||!confirmed||!preview.changes.length} onClick={commit}>{t('5. Save reviewed changes')}</button></>}</div>}
    {busy&&<p role="status">{t('Working…')}</p>}{error&&<p className="notice error" role="alert">{t(error)}</p>}{result&&<p className="notice" role="status">{result}</p>}
  </div></Dialog>}</>;
}
