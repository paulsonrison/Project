import { useState, type FormEvent } from 'react';
import { api, money, save, type Row } from '../../services/api';
import Dialog from '../../components/common/Dialog';
import { useData } from './useData';
import { useAccount } from './context';
export interface Field { key: string; label: string; type?: string; options?: { value: string; label: string }[]; required?: boolean }
export default function EntityView({ endpoint, title, description, fields, columns }: { endpoint: string; title: string; description: string; fields: Field[]; columns: { key: keyof Row; label: string }[] }) {
  const account = useAccount(), data = useData(`/${endpoint}`);
  const [editing, setEditing] = useState<Row | 'new' | null>(null), [error, setError] = useState(''), [saving, setSaving] = useState(false), [search, setSearch] = useState(''), [invite, setInvite] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError('');
    const form = new FormData(e.currentTarget), body: Record<string, unknown> = {};
    for (const field of fields) { const value = String(form.get(field.key) ?? ''); if (value) body[field.key] = field.type === 'number' ? Number(value) : field.type === 'money' ? Math.round(Number(value) * 100) : value; }
    if (editing !== 'new' && editing) body.revision = editing.revision;
    try { await save(`/${endpoint}${editing && editing !== 'new' ? `/${editing.id}` : ''}`, body, editing === 'new' ? 'POST' : 'PATCH'); setEditing(null); data.refresh(); } catch (err) { setError((err as Error).message); } finally { setSaving(false); }
  }
  async function archive(row: Row) {
    if (!window.confirm(`Archive ${row.name ?? 'this record'}? Its history will be retained.`)) return;
    try { await api(`/${endpoint}/${row.id}`, { method: 'DELETE' }); data.refresh(); } catch (err) { setError((err as Error).message); }
  }
  async function invitation(row: Row) {
    const email = window.prompt('Email address for this account invitation:'); if (!email) return;
    try { const result = await save<{ token: string }>('/invitations', { email, role: endpoint === 'staff' ? 'staff' : 'resident', [endpoint === 'staff' ? 'staffId' : 'residentId']: row.id }); setInvite(`${window.location.origin}/signin?invite=${result.token}`); } catch (err) { setError((err as Error).message); }
  }
  const filtered = data.items.filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
  return <section><div className="section-intro"><div><p className="eyebrow">{title}</p><h1>{description}</h1></div>{(account.role === 'admin' || (account.role === 'resident' && endpoint === 'pauses')) && <button className="button primary" onClick={() => { setError(''); setEditing('new'); }}>＋ Add {title.toLowerCase().replace(/s$/, '')}</button>}</div>
    <div className="toolbar"><label className="search">Search {title.toLowerCase()}<input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Find ${title.toLowerCase()}…`} /></label><span className="mono">{filtered.length} records</span></div>
    {(error || data.error) && <p role="alert" className="notice error">{error || data.error} <button onClick={data.refresh}>Retry</button></p>}
    {invite && <div className="notice"><strong>Invitation ready · expires in 48 hours</strong><p>Share this private link with the intended account holder.</p><input aria-label="Invitation link" readOnly value={invite} onFocus={e => e.target.select()} /><button onClick={() => setInvite('')}>Dismiss</button></div>}
    {data.loading ? <p className="empty">Loading {title.toLowerCase()}…</p> : filtered.length ? <div className="data-table"><table><thead><tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}{account.role === 'admin' && <th>Manage</th>}</tr></thead><tbody>{filtered.map(row => <tr key={row.id}>{columns.map(c => <td key={c.key}>{c.key === 'basePrice' ? money(row.basePrice) : String(row[c.key] ?? '—')}</td>)}{account.role === 'admin' && <td><div className="row-actions"><button onClick={() => { setError(''); setEditing(row); }}>Edit</button>{['residents', 'staff'].includes(endpoint) && <button onClick={() => invitation(row)}>Invite</button>}<button onClick={() => archive(row)}>Archive</button></div></td>}</tr>)}</tbody></table></div> : <div className="empty"><span className="empty-mark">▤</span><h2>No {title.toLowerCase()} yet</h2><p>{account.role === 'admin' ? 'Add the first record to get your paper round moving.' : 'Your account has no records to display.'}</p></div>}
    {editing && <Dialog title={`${editing === 'new' ? 'Add' : 'Edit'} ${title.toLowerCase().replace(/s$/, '')}`} onClose={() => setEditing(null)}><form onSubmit={submit} className="editor-form">{fields.map(field => { const value = editing !== 'new' ? editing[field.key as keyof Row] : ''; return <label key={field.key}>{field.label}{field.options ? <select name={field.key} defaultValue={String(value ?? '')} required={field.required}><option value="">Select…</option>{field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : <input name={field.key} type={field.type === 'money' ? 'number' : field.type ?? 'text'} min={field.type === 'money' ? 0 : undefined} step={field.type === 'money' ? '0.01' : undefined} defaultValue={field.type === 'money' && value ? Number(value) / 100 : String(value ?? '')} required={field.required} maxLength={200} />}</label>; })}{error && <p className="error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="button" onClick={() => setEditing(null)}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save record'}</button></div></form></Dialog>}
  </section>;
}

