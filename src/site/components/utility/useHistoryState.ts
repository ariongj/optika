// State that belongs to one history entry: a list's "show more" depth, a chosen sort or chip. It is kept in
// sessionStorage under the entry's key, so Back (or a reload) brings it back; a new visit to the page starts fresh.
// When the entry's key changes in place (the query string is replaced while typing), the value moves along with it.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';

const PREFIX = 'hs:';

export function useHistoryState<T>(name: string, initial: T) {
  const { key } = useLocation();
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(`${PREFIX}${key}:${name}`);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const json = JSON.stringify(value);
  const initialJson = JSON.stringify(initial);
  useEffect(() => {
    try {
      const k = `${PREFIX}${key}:${name}`;
      if (json === initialJson) sessionStorage.removeItem(k);
      else sessionStorage.setItem(k, json);
    } catch {
      /* storage unavailable: the state just doesn't survive Back */
    }
  }, [key, name, json, initialJson]);
  return [value, setValue] as const;
}
