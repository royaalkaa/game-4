import { useCallback, useEffect, useState } from 'react';
import { asApiError, type ApiError } from '@/shared/api';

interface PollingState<T> {
  data?: T;
  error?: ApiError;
}

export interface Polling<T> extends PollingState<T> {
  loading: boolean;
  refresh: () => void;
}

// intervalMs = null loads once. A failed poll keeps the last good data next to the error.
export function usePolling<T>(load: () => Promise<T>, intervalMs: number | null): Polling<T> {
  const [state, setState] = useState<PollingState<T>>({});
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      try {
        const data = await load();
        if (!cancelled) setState({ data });
      } catch (error) {
        if (!cancelled) setState((prev) => ({ data: prev.data, error: asApiError(error) }));
      }
      if (!cancelled && intervalMs !== null) timer = setTimeout(() => void run(), intervalMs);
    };
    void run();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [load, intervalMs, generation]);

  const refresh = useCallback(() => setGeneration((g) => g + 1), []);

  return {
    ...state,
    loading: state.data === undefined && state.error === undefined,
    refresh,
  };
}
