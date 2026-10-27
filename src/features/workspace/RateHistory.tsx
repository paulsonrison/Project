import { useEffect, useState } from 'react';
import { api, money } from '../../services/api';
import { useI18n, formatBusinessDate } from '../../i18n/index';
interface Day { date:string;priceMinor:number|null;status:string;snapshots:{priceMinor:number;invoiceId?:string;billableQuantity:number;status:string}[] }
export default function RateHistory({publicationId}:{publicationId:string}) {
  const {t,locale}=useI18n(),[month,setMonth]=useState(new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}).slice(0,7)),[days,setDays]=useState<Day[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{const controller=new AbortController();api<{items:Day[]}>(`/rates/${publicationId}/history?month=${month}`,{signal:controller.signal}).then(data=>{setDays(data.items);setError('');setLoading(false);}).catch(e=>{if(!controller.signal.aborted){setError(e.message);setLoading(false);}});return()=>controller.abort();},[publicationId,month]);
  return <section aria-label={t('Daily rate history')}><h2>{t('Daily rate history')}</h2><label>{t('Month')}<input type="month" value={month} onChange={e=>{if(e.target.value){setMonth(e.target.value);setLoading(true);}}}/></label>{error&&<p role="alert" className="notice error">{t(error)}</p>}{loading?<p role="status">{t('Loading…')}</p>:<div className="data-table"><table><thead><tr><th>{t('Date')}</th><th>{t('Scheduled rate')}</th><th>{t('Recorded billed prices')}</th></tr></thead><tbody>{days.map(day=><tr key={day.date}><td>{formatBusinessDate(day.date,locale)}</td><td>{day.priceMinor===null?t('Missing rate'):money(day.priceMinor)}</td><td>{[...new Set(day.snapshots.filter(s=>s.invoiceId).map(s=>s.priceMinor))].map(price=>money(price)).join(', ')||t('Not billed')}</td></tr>)}</tbody></table></div>}</section>;
}

