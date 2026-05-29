import { useCallback, useEffect, useRef, useState } from 'react';

const dataCache = new Map();

export function useAsyncData(loader, dependencies = [], options = {}) {
  const { immediate = true, initialData = null, cacheKey } = options;
  const hasInitialCache = Boolean(cacheKey && dataCache.has(cacheKey));
  const [data, setData] = useState(
    hasInitialCache ? dataCache.get(cacheKey) : initialData
  );
  const [loading, setLoading] = useState(immediate && !hasInitialCache);
  const [error, setError] = useState(null);
  const loaderRef = useRef(loader);
  const dataRef = useRef(data);

  loaderRef.current = loader;

  function commitData(nextData) {
    dataRef.current = nextData;
    if (cacheKey) {
      dataCache.set(cacheKey, nextData);
    }
    setData(nextData);
  }

  const refresh = useCallback(async () => {
    let active = true;
    setLoading(!dataRef.current);
    setError(null);

    try {
      const result = await loaderRef.current();
      if (active) {
        commitData(result);
      }
      return result;
    } catch (caughtError) {
      if (active) {
        setError(caughtError);
      }
      throw caughtError;
    } finally {
      if (active) {
        setLoading(false);
      }
    }
  }, dependencies);

  useEffect(() => {
    if (!immediate) {
      return undefined;
    }

    let cancelled = false;
    const cachedData = cacheKey ? dataCache.get(cacheKey) : undefined;
    if (cachedData !== undefined) {
      dataRef.current = cachedData;
      setData(cachedData);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);

    loaderRef
      .current()
      .then((result) => {
        if (!cancelled) {
          commitData(result);
        }
      })
      .catch((caughtError) => {
        if (!cancelled) {
          setError(caughtError);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, dependencies);

  return { data, loading, error, refresh, setData };
}
