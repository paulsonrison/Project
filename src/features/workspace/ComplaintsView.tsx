import { useState } from 'react';
import { useI18n } from '../../i18n';
import { save } from '../../services/api';
import { useData } from './useData';
import { useAccount } from './context';
export default function ComplaintsView() {
  const { t } = useI18n();
  const data = useData('/complaints'), account = useAccount(), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function review(id: string, status: string) {
    const reason = window.prompt(t('Reason to mark this complaint {status}:', {status:t(status)})); if (!reason) return;
    setBusy(true); try { await save(`/complaints/${id}/review`, { status, reason }); data.refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section><div className="section-intro"><div><p className="eyebrow">{t('Delivery concerns')}</p><h1>{t('Make every morning right.')}</h1></div></div><p>{t('Report a missing paper from its delivery entry. Accepted claims remove unbilled charges or create an invoice credit.')}</p>{(error || data.error) && <p className="notice error" role="alert">{t(error || data.error)}</p>}<div className="data-table"><table><thead><tr><th>{t('Reason')}</th><th>{t('Status')}</th><th>{t('Review')}</th></tr></thead><tbody>{data.items.map(row => <tr key={row.id}><td>{String((row as unknown as { reason: string }).reason)}</td><td>{t(row.status ?? 'pending')}</td><td>{account.role === 'admin' && !['accepted', 'rejected'].includes(row.status ?? '') && <div className="row-actions"><button disabled={busy} onClick={() => review(row.id, 'accepted')}>{t('Accept and credit')}</button><button disabled={busy} onClick={() => review(row.id, 'rejected')}>{t('Reject')}</button></div>}</td></tr>)}</tbody></table>{!data.items.length && <p className="empty">{t('No delivery concerns reported.')}</p>}</div></section>;
}
