import { useEffect, useState, useCallback } from "react";

export const STORAGE_KEYS = {
  session: "ccih_session",
  actions: "ccih_actions",
  kanban: "ccih_kanban",
  users: "ccih_users",
  settings: "ccih_settings",
  iras: "ccih_iras_series",
  seeded: "ccih_seeded",
} as const;

export function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLS<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function removeLS(key: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setValue(readLS<T>(key, initial));
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const computed =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        writeLS(key, computed);
        return computed;
      });
    },
    [key]
  );

  return [value, update, hydrated] as const;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
