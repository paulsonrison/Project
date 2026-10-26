import { useState } from 'react';
import { save } from '../../services/api';
import { useData } from './useData';
import { useAccount } from './context';
export default function ComplaintsView() {
  const data = useData('/complaints'), account = useAccount(), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function review(id: string, status: string) {
    const reason = window.prompt(`Reason to mark this complaint ${status}:`); if (!reason) return;
    setBusy(true); try { await save(`/complaints/${id}/review`, { status, reason }); data.refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section><div className="section-intro"><div><p className="eyebrow">Delivery concerns</p><h1>Make every morning right.</h1></div></div><p>Report a missing paper from its delivery entry. Accepted claims remove unbilled charges or create an invoice credit.</p>{(error || data.error) && <p className="notice error" role="alert">{error || data.error}</p>}<div className="data-table"><table><thead><tr><th>Reason</th><th>Status</th><th>Review</th></tr></thead><tbody>{data.items.map(row => <tr key={row.id}><td>{String((row as unknown as { reason: string }).reason)}</td><td>{row.status ?? 'pending'}</td><td>{account.role === 'admin' && !['accepted', 'rejected'].includes(row.status ?? '') && <div className="row-actions"><button disabled={busy} onClick={() => review(row.id, 'accepted')}>Accept and credit</button><button disabled={busy} onClick={() => review(row.id, 'rejected')}>Reject</button></div>}</td></tr>)}</tbody></table>{!data.items.length && <p className="empty">No delivery concerns reported.</p>}</div></section>;
}
