import { useSyncExternalStore } from 'react';

/**
 * Tiny helper for JSON values in localStorage that several components read
 * reactively. Writes broadcast `eventName` so every subscriber re-reads, and
 * parsed snapshots are cached by raw string so getSnapshot stays stable.
 */
export function createJsonStore<T>(eventName: string, fallback: T) {
  const cache = new Map<string, { raw: string | null; parsed: T }>();

  function read(key: string): T {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      raw = null;
    }
    const cached = cache.get(key);
    if (cached && cached.raw === raw) return cached.parsed;

    let parsed = fallback;
    if (raw) {
      try {
        parsed = JSON.parse(raw) as T;
      } catch {
        parsed = fallback;
      }
    }
    cache.set(key, { raw, parsed });
    return parsed;
  }

  function write(key: string, value: T | null) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
      window.dispatchEvent(new Event(eventName));
    } catch (e) {
      console.error(`Failed to write ${key}`, e);
    }
  }

  function subscribe(onChange: () => void) {
    window.addEventListener(eventName, onChange);
    // Keep other tabs in sync too.
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(eventName, onChange);
      window.removeEventListener('storage', onChange);
    };
  }

  function useValue(key: string | null): T {
    return useSyncExternalStore(
      subscribe,
      () => (key ? read(key) : fallback),
      () => fallback,
    );
  }

  return { read, write, useValue };
}
