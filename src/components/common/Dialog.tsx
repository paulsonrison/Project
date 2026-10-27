import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useI18n } from '../../i18n';
export default function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current, previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.documentElement.style.overflow;
    dialog?.showModal(); document.documentElement.style.overflow = 'hidden';
    return () => { dialog?.close(); document.documentElement.style.overflow = previousOverflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }} className="editor-dialog"><div className="dialog-title"><h2 id={titleId}>{title}</h2><button type="button" aria-label={t('Close dialog')} onClick={onClose}>×</button></div>{children}</dialog>;
}
