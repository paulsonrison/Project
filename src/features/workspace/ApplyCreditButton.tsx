import { useState } from 'react';
import { useI18n } from '../../i18n';
import { save, type Row } from '../../services/api';
export default function ApplyCreditButton({ invoice, refresh }: { invoice: Row; refresh: () => void }) {
  const { t } = useI18n();
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  if (!invoice.dueMinor || !invoice.creditMinor) return null;
  return <span><button disabled={busy} onClick={async () => { if (!window.confirm(t('Apply this available credit to the outstanding amount?'))) return; setBusy(true); try { await save(`/invoices/${invoice.id}/apply-credit`, {}); refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>{t('Apply available credit')}</button>{error && <small role="alert">{t(error)}</small>}</span>;
}
