import { useState } from 'react';
import { save, type Row } from '../../services/api';
export default function ApplyCreditButton({ invoice, refresh }: { invoice: Row; refresh: () => void }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  if (!invoice.dueMinor || !invoice.creditMinor) return null;
  return <span><button disabled={busy} onClick={async () => { if (!window.confirm('Apply this available credit to the outstanding amount?')) return; setBusy(true); try { await save(`/invoices/${invoice.id}/apply-credit`, {}); refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Apply available credit</button>{error && <small role="alert">{error}</small>}</span>;
}
