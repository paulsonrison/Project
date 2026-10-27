import {useEffect,useState} from 'react';
import Dialog from '../../components/common/Dialog';
import {api,save} from '../../services/api';
import {useI18n} from '../../i18n';
import {useData} from '../workspace/useData';
type Entity='residents'|'publications';type Mode='add'|'update'|'remove'|'replace';
interface Job {id:string;revision:number;status:string;filename?:string;rows?:Record<string,string>[];issues?:{row:number;message:string}[];unmapped?:string[];warnings?:string[];notice?:string;error?:string}
interface Preview {id:string;revision:number;changes:{action:string;label:string;collection:string}[];errors:{row:number;message:string}[]}
const label:Record<string,string>={Name:'Name',Number:'Phone','Address/Flat':'Flat / house',Address:'Address',Code:'Code','Edition/City':'Edition','Amount (INR)':'Price (₹)','From Date':'From date','To Date (optional)':'To date','Start Date':'Start date','Remove?':'Remove?'};
export default function UploadDialog({entity,onSaved}:{entity:Entity;onSaved:()=>void}){
  const {t,locale}=useI18n(),catalog=useData('/publications');
  const [open,setOpen]=useState(false),[job,setJob]=useState<Job|null>(null),[rows,setRows]=useState<Record<string,string>[]>([]),[preview,setPreview]=useState<Preview|null>(null),[mode,setMode]=useState<Mode>('add'),[effective,setEffective]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[acknowledged,setAcknowledged]=useState(false),[confirmed,setConfirmed]=useState(false),[page,setPage]=useState(0);
  const reading=!!job&&['uploaded','extracting','interpreting'].includes(job.status),saving=busy||reading;
  const base=entity==='residents'?['Name','Number','Address/Flat','Address']:['Name','Code','Edition/City','Amount (INR)','From Date','To Date (optional)'];
  const columns=[...new Set([...base,...rows.flatMap(row=>Object.keys(row)).filter(key=>key==='Start Date'||key.startsWith('Subscription: ')),...(['remove','replace'].includes(mode)?['Remove?']:[]),...(job?.issues?.length&&entity==='residents'?catalog.items.map(p=>`Subscription: ${p.code||p.id.slice(0,8).toUpperCase()}`):[])])];
  async function prepare(currentRows:Record<string,string>[],currentJob:Job){
    setBusy(true);setError('');setConfirmed(false);
    try{const data=await save<Preview>(`/uploads/${currentJob.id}/preview`,{rows:currentRows,mode,effectiveDate:effective||undefined,revision:currentJob.revision,acknowledgeIssues:acknowledged});setPreview(data);setJob(value=>value?{...value,revision:data.revision}:value);}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  useEffect(()=>{
    if(!job||!reading)return;const id=job.id,controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
    async function poll(){try{const data=await api<Job>(`/uploads/${id}`,{signal:controller.signal});if(controller.signal.aborted)return;setJob(data);if(data.status==='needs-review'){setRows(data.rows||[]);setPage(0);if(!data.issues?.length)void prepare(data.rows||[],data);}else if(['uploaded','extracting','interpreting'].includes(data.status))timer=setTimeout(poll,900);else if(data.status==='failed')setError(data.error||'We could not read this file.');}catch(e){if(!controller.signal.aborted)setError((e as Error).message);}}
    timer=setTimeout(poll,400);return()=>{controller.abort();clearTimeout(timer);};
    // Polling is tied to a single uploaded job; edits are reviewed explicitly after reading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[job?.id,reading]);
  async function choose(file:File){
    setBusy(true);setError('');setMessage('');setPreview(null);setRows([]);setAcknowledged(false);setConfirmed(false);setPage(0);
    try{if(file.size>10*1024*1024)throw new Error(t('Choose a file smaller than 10 MB.'));const form=new FormData();form.append('file',file);form.append('entity',entity);const response=await fetch('/api/v1/uploads',{method:'POST',credentials:'same-origin',body:form});const data=await response.json();if(!response.ok)throw new Error(data.error?.message||'Upload failed.');setJob(data);}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function close(){if(busy)return;if(job&&reading){if(!window.confirm(t('Stop reading this file?')))return;await api(`/uploads/${job.id}`,{method:'DELETE'}).catch(()=>{});}else if(rows.length&&!message&&!window.confirm(t('Discard these unsaved details?')))return;setOpen(false);}
  function edit(index:number,key:string,value:string){setRows(current=>current.map((row,i)=>i===index?{...row,[key]:value}:row));setPreview(null);setConfirmed(false);}
  async function commit(){if(!job||!preview)return;setBusy(true);setError('');try{const result=await save<{changed:number}>(`/uploads/${job.id}/save`,{batchId:preview.id});setMessage(t('Saved {count} changes',{count:result.changed}));setRows([]);setPreview(null);setJob(null);onSaved();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function sample(){setBusy(true);try{const response=await fetch('/api/v1/imports/template',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({entity,mode,locale:locale.split('-')[0]})});if(!response.ok)throw new Error('Download failed.');const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download=`sample-${entity}.xlsx`;a.click();URL.revokeObjectURL(url);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <><button className="button" type="button" onClick={()=>setOpen(true)}>{t('Upload file')}</button>{open&&<Dialog title={t('Upload file')} onClose={()=>void close()}><div className="upload-panel">
    <label className="file-drop">{t('Choose a file')}<input type="file" accept=".xlsx,.csv,.tsv,.txt,.pdf,.docx,.png,.jpg,.jpeg,.webp" disabled={saving} onChange={event=>{const file=event.target.files?.[0];if(file)void choose(file);event.target.value='';}}/><small>{t('Excel, CSV, PDF, Word or a clear photo · up to 10 MB')}</small></label>
    {reading&&<div className="upload-progress" role="status"><span className="progress-dot"/>{t(job.status==='interpreting'?'Checking the details…':'Reading your file…')}<button type="button" onClick={()=>void close()}>{t('Cancel')}</button></div>}
    {job?.status==='needs-review'&&<><div className="review-heading"><h3>{t('Check details')}</h3><span>{t('{count} records',{count:rows.length})}</span></div>
      {!!job.issues?.length&&<div className="notice"><p>{t('Some details need checking.')}</p>{job.issues.map((issue,index)=><p key={index}>{t('Row')} {issue.row}: {t(issue.message)}</p>)}<label className="check-line"><input type="checkbox" disabled={busy} checked={acknowledged} onChange={e=>{setAcknowledged(e.target.checked);setPreview(null);}}/>{t('I checked the uncertain fields.')}</label></div>}
      {job.notice&&<p className="muted">{t(job.notice)}</p>}
      {!!job.unmapped?.length&&<details><summary>{t('{count} unused columns',{count:job.unmapped.length})}</summary><p>{job.unmapped.join(', ')}</p></details>}
      <div className="data-table upload-review"><table><thead><tr><th>{t('Row')}</th>{columns.map(key=><th key={key}>{key.startsWith('Subscription: ')?key.slice(14):t(label[key]||key)}</th>)}</tr></thead><tbody>{rows.slice(page*50,(page+1)*50).map((row,index)=><tr key={page*50+index}><td>{page*50+index+1}</td>{columns.map(key=><td key={key}><input aria-label={`${t(label[key]||key)} ${page*50+index+1}`} value={row[key]||''} disabled={busy} onChange={e=>edit(page*50+index,key,e.target.value)}/></td>)}</tr>)}</tbody></table></div>
      {rows.length>50&&<div className="review-paging"><button disabled={!page} onClick={()=>setPage(p=>p-1)}>{t('Previous')}</button><span>{page+1} / {Math.ceil(rows.length/50)}</span><button disabled={(page+1)*50>=rows.length} onClick={()=>setPage(p=>p+1)}>{t('Next')}</button></div>}
      {entity==='residents'&&rows.some(row=>Object.keys(row).some(k=>k.startsWith('Subscription: ')))&&<label>{t('Start date for subscriptions')}<input type="date" disabled={busy} value={effective} onChange={e=>{setEffective(e.target.value);setPreview(null);}}/></label>}
      <details className="upload-options"><summary>{t('More options')}</summary><label>{t('How should these records be added?')}<select value={mode} disabled={busy} onChange={e=>{setMode(e.target.value as Mode);setPreview(null);setConfirmed(false);}}><option value="add">{t('Add new')}</option><option value="update">{t('Update matching records')}</option><option value="remove">{t('Remove selected')}</option><option value="replace">{t('Replace selected records')}</option></select></label><button type="button" className="text-action" disabled={busy} onClick={sample}>{t('Download sample')}</button></details>
      {!preview&&<button className="button primary" disabled={busy||!rows.length||(!!job.issues?.length&&!acknowledged)} onClick={()=>void prepare(rows,job)}>{t(busy?'Checking…':'Check changes')}</button>}
      {preview&&<div className="upload-result" aria-live="polite">{preview.errors.length?<><p role="alert">{t('Fix these details before saving.')}</p>{preview.errors.map((issue,index)=><p key={index}>{t('Row')} {issue.row}: {t(issue.message)}</p>)}</>:<><p>{t('{count} changes ready',{count:preview.changes.length})}</p>{mode!=='add'&&<><details open><summary>{t('Changes to existing records')}</summary>{preview.changes.map((change,index)=><p key={index}>{t(change.action)} · {change.label}</p>)}</details><label className="check-line"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>{t('I checked these changes.')}</label></>}<button className="button primary" disabled={busy||!preview.changes.length||(mode!=='add'&&!confirmed)} onClick={commit}>{t(busy?'Saving…':'Save records')}</button></>}</div>}
    </>}
    {!job&&<button className="text-action" disabled={busy} onClick={sample}>{t('Download sample')}</button>}
    {error&&<p role="alert" className="notice error">{t(error)}</p>}{message&&<p role="status" className="notice">{message}</p>}
  </div></Dialog>}</>;
}
