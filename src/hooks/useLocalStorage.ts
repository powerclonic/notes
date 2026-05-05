import { useState, useCallback } from 'react';

/**
 * Drop-in replacement for @github/spark/hooks `useKV` that persists data
 * in localStorage.  Supports the same functional-update signature.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const next =
          typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch (err) {
          console.error('useLocalStorage: write error', err);
        }
        return next;
      });
    },
    [key]
  );

  return [storedValue, setValue];
}
