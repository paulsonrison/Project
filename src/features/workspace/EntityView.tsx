import { useState, type FormEvent } from 'react';
import { api, save, type Row } from '../../services/api';
import Dialog from '../../components/common/Dialog';
import { useData } from './useData';
import { useAccount } from './context';
import { useI18n, formatMoney } from '../../i18n';
import ExcelWizard from '../imports/ExcelWizard';
import AiEntry from '../imports/AiEntry';
export interface Field { key: string; label: string; type?: string; options?: { value: string; label: string }[]; required?: boolean }
export default function EntityView({ endpoint, title, description, fields, columns }: { endpoint: string; title: string; description: string; fields: Field[]; columns: { key: keyof Row; label: string }[] }) {
  const { t, locale } = useI18n();
  const entityLabel = t(({ residents: 'Customer', publications: 'Newspaper', subscriptions: 'Subscription', pauses: 'Pause' } as Record<string, string>)[endpoint] ?? title);
  const account = useAccount(), data = useData(`/${endpoint}`);
  const [editing, setEditing] = useState<Row | 'new' | null>(null), [error, setError] = useState(''), [saving, setSaving] = useState(false), [search, setSearch] = useState(''), [invite, setInvite] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError('');
    const form = new FormData(e.currentTarget), body: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.type === 'days') { body[field.key] = form.getAll(field.key).map(Number); continue; }
      const value = String(form.get(field.key) ?? ''); if (value) body[field.key] = field.type === 'number' ? Number(value) : field.type === 'money' ? Math.round(Number(value) * 100) : value;
    }
    if (editing !== 'new' && editing) body.revision = editing.revision;
    try { await save(`/${endpoint}${editing && editing !== 'new' ? `/${editing.id}` : ''}`, body, editing === 'new' ? 'POST' : 'PATCH'); setEditing(null); data.refresh(); } catch (err) { setError((err as Error).message); } finally { setSaving(false); }
  }
  async function archive(row: Row) {
    if (!window.confirm(t('Archive {name}? Its history will be retained.', { name: row.name ?? t('this record') }))) return;
    try { await api(`/${endpoint}/${row.id}`, { method: 'DELETE' }); data.refresh(); } catch (err) { setError((err as Error).message); }
  }
  async function invitation(row: Row) {
    const email = window.prompt(t('Email address for this account invitation:')); if (!email) return;
    try { const result = await save<{ token: string }>('/invitations', { email, role: endpoint === 'staff' ? 'staff' : 'resident', [endpoint === 'staff' ? 'staffId' : 'residentId']: row.id }); setInvite(`${window.location.origin}/signin?invite=${result.token}`); } catch (err) { setError((err as Error).message); }
  }
  const filtered = data.items.filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
  return <section><div className="section-intro"><div><p className="eyebrow">{t(title)}</p><h1>{t(description)}</h1></div>{(account.role === 'admin' || (account.role === 'resident' && endpoint === 'pauses')) && <button className="button primary" onClick={() => { setError(''); setEditing('new'); }}>＋ {t('Add {entity}', { entity: entityLabel })}</button>}</div>
    <div className="toolbar"><label className="search">{t('Search {entity}', { entity: t(title) })}<input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Find {entity}…', { entity: t(title) })} /></label><span className="mono">{t('{count} records', { count: filtered.length })}</span></div>
    {account.role === 'admin' && (endpoint === 'residents' || endpoint === 'publications') && <ExcelWizard entity={endpoint} onSaved={data.refresh} />}
    {account.role === 'admin' && endpoint === 'residents' && <AiEntry entity="residents" onSaved={data.refresh} />}
    {(error || data.error) && <p role="alert" className="notice error">{t(error || data.error)} <button onClick={data.refresh}>{t('Retry')}</button></p>}
    {invite && <div className="notice"><strong>{t('Invitation ready · expires in 48 hours')}</strong><p>{t('Share this private link with the intended account holder.')}</p><input aria-label={t('Invitation link')} readOnly value={invite} onFocus={e => e.target.select()} /><button onClick={() => setInvite('')}>{t('Dismiss')}</button></div>}
    {data.loading ? <p className="empty">{t('Loading {entity}…', { entity: t(title) })}</p> : filtered.length ? <div className="data-table"><table><thead><tr>{columns.map(c => <th key={c.key}>{t(c.label)}</th>)}{account.role === 'admin' && <th>{t('Manage')}</th>}</tr></thead><tbody>{filtered.map(row => <tr key={row.id}>{columns.map(c => <td key={c.key}>{c.key === 'basePrice' ? formatMoney(row.basePrice ?? 0, locale) : String(row[c.key] ?? '—')}</td>)}{account.role === 'admin' && <td><div className="row-actions"><button onClick={() => { setError(''); setEditing(row); }}>{t('Edit')}</button>{['residents', 'staff'].includes(endpoint) && <button onClick={() => invitation(row)}>{t('Invite')}</button>}<button onClick={() => archive(row)}>{t('Archive')}</button></div></td>}</tr>)}</tbody></table></div> : <div className="empty"><span className="empty-mark">▤</span><h2>{t('No {entity} yet', { entity: t(title) })}</h2><p>{t(account.role === 'admin' ? 'Add the first record to get your paper round moving.' : 'Your account has no records to display.')}</p></div>}
    {editing && <Dialog title={t(editing === 'new' ? 'Add {entity}' : 'Edit {entity}', { entity: entityLabel })} onClose={() => setEditing(null)}><form onSubmit={submit} className="editor-form">{fields.map(field => { const value = editing !== 'new' ? editing[field.key as keyof Row] : ''; return <label key={field.key}>{t(field.label)}{field.type === 'days' ? <span className="days-field">{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, n) => <span key={day}><input aria-label={t(day)} type="checkbox" name={field.key} value={n} defaultChecked={Array.isArray(value) && (value as unknown as number[]).includes(n)} />{t(day)}</span>)}</span> : field.options ? <select name={field.key} defaultValue={String(value ?? '')} required={field.required}><option value="">{t('Select…')}</option>{field.options.map(o => <option key={o.value} value={o.value}>{field.key === 'schedule' ? t(o.label) : o.label}</option>)}</select> : <input name={field.key} type={field.type === 'money' ? 'number' : field.type ?? 'text'} min={field.type === 'money' ? 0 : undefined} step={field.type === 'money' ? '0.01' : undefined} defaultValue={field.type === 'money' && value ? Number(value) / 100 : String(value ?? '')} required={field.required} maxLength={200} />}</label>; })}{error && <p className="error" role="alert">{t(error)}</p>}<div className="form-actions"><button type="button" className="button" onClick={() => setEditing(null)}>{t('Cancel')}</button><button className="button primary" disabled={saving}>{t(saving ? 'Saving…' : 'Save record')}</button></div></form></Dialog>}
  </section>;
}
