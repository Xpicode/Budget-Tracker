import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

// Device-local preferences live in the meta table (never synced).
export const useSetting = (key, fallback) => useLiveQuery(() => db.meta.get(key), [key])?.value ?? fallback;
export const setSetting = (key, value) => db.meta.put({ key, value });
