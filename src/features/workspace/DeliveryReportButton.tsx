import { useState } from 'react';
import { useI18n } from '../../i18n';
import { save, type Row } from '../../services/api';
export default function DeliveryReportButton({ job }: { job: Row }) {
  const { t } = useI18n();
  const [status, setStatus] = useState('');
  async function report() {
    const reason = window.prompt(t('What went wrong with this delivery?')); if (!reason) return;
    try { await save('/complaints', { residentId: job.residentId, deliveryId: job.id, reason }); setStatus('Concern reported'); } catch (e) { setStatus((e as Error).message); }
  }
  return <span><button onClick={report}>{t('Report a concern')}</button>{status && <small role="status"> {t(status)}</small>}</span>;
}
