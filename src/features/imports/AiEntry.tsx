import { useState } from 'react';
import Dialog from '../../components/common/Dialog';
import { save } from '../../services/api';
import { useData } from '../workspace/useData';
import { useI18n } from '../../i18n';

interface PublicPayload { startDate: string; publications: { code: string; name: string; quantity: number }[] }
interface PayloadPreview { payload: PublicPayload; hash: string }
interface Suggestion { subscriptions: { code: string; quantity: number; startDate: string }[] }
interface ChangePreview { id: string; changes: { action: string; label: string }[]; errors: { row: number; message: string }[] }

export default function AiEntry({ entity, onSaved }: { entity: 'residents' | 'publications'; onSaved: () => void }) {
  const { t } = useI18n();
  const catalog = useData('/publications');
  const [open, setOpen] = useState(false), [name, setName] = useState(''), [unit, setUnit] = useState(''), [phone, setPhone] = useState(''), [address, setAddress] = useState('');
  const [date, setDate] = useState(''), [quantities, setQuantities] = useState<Record<string, string>>({});
  const [payload, setPayload] = useState<PayloadPreview | null>(null), [suggestion, setSuggestion] = useState<Suggestion | null>(null), [preview, setPreview] = useState<ChangePreview | null>(null);
  const [consent, setConsent] = useState(false), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState('');
  if (entity !== 'residents') return null;

  function clearPublicReview() { setPayload(null); setSuggestion(null); setPreview(null); setConsent(false); setConfirmed(false); setResult(''); }
  function clearPrivateReview() { setPreview(null); setConfirmed(false); setResult(''); }
  const selections = catalog.items.filter(paper => quantities[paper.id] && Number(quantities[paper.id]) > 0).map(paper => ({ code: paper.code || paper.id.slice(0, 8).toUpperCase(), quantity: Number(quantities[paper.id]) }));
  async function run(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function showPayload() {
    clearPublicReview();
    await run(async () => setPayload(await save<PayloadPreview>('/ai-entry/payload', { startDate: date, selections })));
  }
  async function askAi() {
    if (!payload || !consent) return;
    await run(async () => setSuggestion(await save<Suggestion>('/ai-entry/propose', { request: { consentToGroq: true, startDate: date, selections }, expectedPayloadHash: payload.hash })));
  }
  async function review() {
    if (!suggestion) return;
    await run(async () => {
      const row: Record<string, string> = { Name: name, Number: phone, 'Address/Flat': unit, Address: address, 'Start Date': date };
      for (const subscription of suggestion.subscriptions) row[`Subscription: ${subscription.code}`] = String(subscription.quantity);
      setPreview(await save<ChangePreview>('/imports/preview', { entity: 'residents', mode: 'add', rows: [row] }));
      setConfirmed(false);
    });
  }
  async function commit() {
    if (!preview || !confirmed) return;
    await run(async () => {
      await save(`/imports/${preview.id}/commit`, {});
      setResult(t('Customer and subscriptions saved.')); setPreview(null); setSuggestion(null); setPayload(null); setConsent(false);
      setName(''); setPhone(''); setUnit(''); setAddress(''); setDate(''); setQuantities({}); onSaved();
    });
  }
  return <><button className="button" type="button" onClick={() => setOpen(true)}>{t('Add with AI')}</button>{open && <Dialog title={t('Add with AI')} onClose={() => { if (!busy) setOpen(false); }}><div className="excel-wizard">
    <p>{t('AI helps prepare newspaper subscriptions. You review every change before saving.')}</p>
    <p className="notice">{t('Customer names, phones, flats and addresses are never sent to Groq. Only the newspaper choices shown below can be sent after your consent.')}</p>
    <fieldset disabled={busy}><legend>{t('Private customer details — PressTrack only')}</legend>
      <label>{t('Full name')}<input value={name} maxLength={200} onChange={e => { setName(e.target.value); clearPrivateReview(); }} /></label>
      <label>{t('Address/Flat')}<input value={unit} maxLength={200} onChange={e => { setUnit(e.target.value); clearPrivateReview(); }} /></label>
      <label>{t('Phone')}<input type="tel" value={phone} maxLength={200} onChange={e => { setPhone(e.target.value); clearPrivateReview(); }} /></label>
      <label>{t('Address')}<input value={address} maxLength={200} onChange={e => { setAddress(e.target.value); clearPrivateReview(); }} /></label>
    </fieldset>
    <fieldset disabled={busy}><legend>{t('Public newspaper choices')}</legend>
      <label>{t('First delivery date')}<input type="date" value={date} onChange={e => { setDate(e.target.value); clearPublicReview(); }} /></label>
      {catalog.loading ? <p>{t('Loading newspapers…')}</p> : catalog.error ? <p role="alert">{t(catalog.error)}</p> : !catalog.items.length ? <p>{t('Add newspapers before preparing subscriptions.')}</p> : catalog.items.map(paper => <label key={paper.id}>{paper.name} · {paper.code || paper.id.slice(0, 8).toUpperCase()}<input type="number" min="0" max="100" step="1" value={quantities[paper.id] || ''} placeholder="0" onChange={e => { setQuantities(values => ({ ...values, [paper.id]: e.target.value })); clearPublicReview(); }} /></label>)}
    </fieldset>
    <button className="button" disabled={busy || !date || !selections.length || catalog.loading} onClick={showPayload}>{t('Review what Groq would receive')}</button>
    {payload && <section className="notice"><h3>{t('Newspaper choices for Groq')}</h3><div className="data-table"><table><thead><tr><th>{t('Newspaper')}</th><th>{t('Code')}</th><th>{t('Copies')}</th><th>{t('Start date')}</th></tr></thead><tbody>{payload.payload.publications.map(paper => <tr key={paper.code}><td>{paper.name}</td><td>{paper.code}</td><td>{paper.quantity}</td><td>{payload.payload.startDate}</td></tr>)}</tbody></table></div><label><input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)} />{t('I agree to send only these newspaper choices to Groq.')}</label><button className="button" disabled={busy || !consent} onClick={askAi}>{t(busy ? 'Working…' : 'Prepare with Groq')}</button></section>}
    {suggestion && <section><h3>{t('Proposed subscriptions')}</h3>{suggestion.subscriptions.map(item => <p key={item.code}>{item.code} · {item.quantity} · {item.startDate}</p>)}<button className="button primary" disabled={busy || !name.trim() || !unit.trim()} onClick={review}>{t('Review customer and subscriptions')}</button></section>}
    {preview && <section aria-live="polite"><h3>{t('Review changes')}</h3><p>{name} · {unit} · {phone} · {address}</p>{preview.changes.map((change, index) => <p key={index}>{t(change.action)} · {change.label}</p>)}{preview.errors.map((item, index) => <p className="error" role="alert" key={index}>{t(item.message)}</p>)}{!preview.errors.length && <><label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />{t('I reviewed these changes')}</label><button className="button primary" disabled={busy || !confirmed} onClick={commit}>{t('Save reviewed changes')}</button></>}</section>}
    {error && <p role="alert" className="notice error">{t(error)}</p>}{result && <p role="status" className="notice">{result}</p>}
  </div></Dialog>}</>;
}
