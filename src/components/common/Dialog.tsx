import { useEffect, useRef, type ReactNode } from 'react';
export default function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} onCancel={e => { e.preventDefault(); onClose(); }} className="editor-dialog"><div className="dialog-title"><h2>{title}</h2><button aria-label="Close dialog" onClick={onClose}>×</button></div>{children}</dialog>;
}
