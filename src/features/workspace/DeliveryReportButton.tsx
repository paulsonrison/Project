import { useState } from 'react';
import { save, type Row } from '../../services/api';
export default function DeliveryReportButton({ job }: { job: Row }) {
  const [status, setStatus] = useState('');
  async function report() {
    const reason = window.prompt('What went wrong with this delivery?'); if (!reason) return;
    try { await save('/complaints', { residentId: job.residentId, deliveryId: job.id, reason }); setStatus('Concern reported'); } catch (e) { setStatus((e as Error).message); }
  }
  return <span><button onClick={report}>Report a concern</button>{status && <small role="status"> {status}</small>}</span>;
}
