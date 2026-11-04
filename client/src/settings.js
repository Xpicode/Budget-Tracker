import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

// Device-local preferences live in the meta table (never synced).
export const useSetting = (key, fallback) => useLiveQuery(() => db.meta.get(key), [key])?.value ?? fallback;
export const setSetting = (key, value) => db.meta.put({ key, value });

// 'light' | 'dark' | 'system'. Also mirrored to localStorage, which index.html reads before the first
// paint, so a dark app doesn't flash white while IndexedDB opens.
const savedTheme = () => {
  try {
    return localStorage.getItem('theme') ?? 'system';
  } catch {
    return 'system';
  }
};
export const useTheme = () => useSetting('theme', savedTheme());

// Which book Transactions and Dashboard show: 'all' | 'personal' | 'business'. Remembered on this device.
export const useBook = () => useSetting('book', 'all');
