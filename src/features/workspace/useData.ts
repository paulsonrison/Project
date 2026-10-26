import { useEffect, useState } from 'react';
import { api, type Row } from '../../services/api';
export function useData(path: string) {
  const [items, setItems] = useState<Row[]>([]), [error, setError] = useState(''), [version, setVersion] = useState(0), [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const all: Row[] = []; let offset = 0;
      for (;;) {
        const data = await api<{ items: Row[]; total?: number }>(`${path}${path.includes('?') ? '&' : '?'}offset=${offset}`, { signal: controller.signal });
        all.push(...data.items); offset += data.items.length;
        if (!data.items.length || data.total === undefined || offset >= data.total) return all;
      }
    }
    load().then(rows => { setItems(rows); setError(''); setLoading(false); }).catch(e => { if (!controller.signal.aborted) { setError(e.message); setLoading(false); } });
    return () => controller.abort();
  }, [path, version]);
  return { items, error, loading, refresh: () => { setLoading(true); setVersion(v => v + 1); } };
}
