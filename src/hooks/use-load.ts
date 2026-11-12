import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../format';

// Callers memoize their loader with the values that identify the request.
export function useLoad<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setData(null);
    loader().then((value) => {
      if (active) setData(value);
    }).catch((caught: unknown) => {
      if (active) setError(errorMessage(caught));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [loader, version]);

  return { data, loading, error, reload };
}
