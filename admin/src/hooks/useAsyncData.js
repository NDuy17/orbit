import { useCallback, useEffect, useRef, useState } from 'react';

const dataCache = new Map();
const requestCache = new Map();

function hasCachedData(cacheKey) {
  return Boolean(cacheKey && dataCache.has(cacheKey));
}

function getCachedData(cacheKey) {
  return cacheKey ? dataCache.get(cacheKey) : undefined;
}

function setCachedData(cacheKey, data) {
  if (cacheKey) {
    dataCache.set(cacheKey, data);
  }
}

export function prefetchAsyncData(cacheKey, loader, { force = false } = {}) {
  if (!cacheKey) {
    return Promise.resolve().then(loader);
  }

  if (!force && dataCache.has(cacheKey)) {
    return Promise.resolve(dataCache.get(cacheKey));
  }

  if (requestCache.has(cacheKey)) {
    return requestCache.get(cacheKey);
  }

  const request = Promise.resolve()
    .then(loader)
    .then((result) => {
      setCachedData(cacheKey, result);
      return result;
    })
    .finally(() => {
      requestCache.delete(cacheKey);
    });

  requestCache.set(cacheKey, request);
  return request;
}

export function useAsyncData(loader, dependencies = [], options = {}) {
  const { immediate = true, initialData = null, cacheKey } = options;
  const hasInitialCache = hasCachedData(cacheKey);
  const [data, setData] = useState(
    hasInitialCache ? getCachedData(cacheKey) : initialData
  );
  const [loading, setLoading] = useState(
    immediate && !hasInitialCache && initialData == null
  );
  const [error, setError] = useState(null);
  const loaderRef = useRef(loader);
  const dataRef = useRef(data);

  loaderRef.current = loader;

  function commitData(nextData) {
    dataRef.current = nextData;
    setCachedData(cacheKey, nextData);
    setData(nextData);
  }

  const refresh = useCallback(async () => {
    setLoading(!dataRef.current);
    setError(null);

    try {
      const result = await prefetchAsyncData(cacheKey, loaderRef.current, {
        force: true,
      });
      commitData(result);
      return result;
    } catch (caughtError) {
      setError(caughtError);
      throw caughtError;
    } finally {
      setLoading(false);
    }
  }, dependencies);

  useEffect(() => {
    if (!immediate) {
      return undefined;
    }

    let cancelled = false;
    const cachedData = getCachedData(cacheKey);
    if (cachedData !== undefined) {
      dataRef.current = cachedData;
      setData(cachedData);
      setLoading(false);
    } else {
      dataRef.current = initialData;
      setData(initialData);
      setLoading(initialData == null);
    }
    setError(null);

    prefetchAsyncData(cacheKey, loaderRef.current, { force: true })
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
