import { openDB, type IDBPDatabase } from 'idb';
import type { OsuMatch, StoredMatchEntry } from '../types/osu';





const DB_NAME = 'osu-tracker-db';
const DB_VERSION = 1;
const MATCHES_STORE = 'matches';


const LEGACY_MATCHES_KEY = 'osu-match-tracker::matches';

const PERSONAL_USER_KEY = 'osu-match-tracker::personal-user';
const TOKEN_KEY = 'osu-match-tracker::osu-token';
const SETTINGS_KEY = 'osu-match-tracker::settings';

interface TrackerDBSchema {
  matches: { key: number; value: StoredMatchEntry };
}

let _db: Promise<IDBPDatabase<TrackerDBSchema>> | null = null;

// ---------------------------------------------------------------------------
// Server storage (Vite dev / preview server)
// The Vite plugin exposes GET+POST /data/matches which reads/writes
// matches.json on disk — making data port- and browser-independent.
// ---------------------------------------------------------------------------

const SERVER_ENDPOINT = '/data/matches';
let _useServerStorage = false;

async function serverLoad(): Promise<StoredMatchEntry[] | null> {
  try {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), 3000);
    let res: Response;
    try {
      res = await fetch(SERVER_ENDPOINT, { signal: controller.signal });
    } finally {
      clearTimeout(timerId);
    }
    if (!res.ok) return null;
    const data = await res.json() as { matches?: StoredMatchEntry[] };
    return Array.isArray(data.matches) ? data.matches : null;
  } catch {
    return null;
  }
}

async function serverSave(entries: StoredMatchEntry[]): Promise<boolean> {
  try {
    const res = await fetch(SERVER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matches: entries }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function idbSaveAll(entries: StoredMatchEntry[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(MATCHES_STORE, 'readwrite');
    await tx.store.clear();
    for (const entry of entries) tx.store.put(entry);
    await tx.done;
  } catch (err) {
    console.error('[dataStorage] Failed to save all matches to IndexedDB', err);
  }
}

/** Returns true when the Vite file-storage server is available. */
export function isUsingServerStorage(): boolean {
  return _useServerStorage;
}

function getDB(): Promise<IDBPDatabase<TrackerDBSchema>> {
  if (!_db) {
    _db = openDB<TrackerDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(MATCHES_STORE)) {
          db.createObjectStore(MATCHES_STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return _db;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}








export async function migrateFromLocalStorage(): Promise<void> {
  if (!isBrowser()) return;

  const raw = window.localStorage.getItem(LEGACY_MATCHES_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw) as StoredMatchEntry[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      window.localStorage.removeItem(LEGACY_MATCHES_KEY);
      return;
    }

    const db = await getDB();
    const tx = db.transaction(MATCHES_STORE, 'readwrite');

    
    
    
    const existing = new Set((await tx.store.getAllKeys()) as number[]);
    let migrated = 0;
    for (const entry of parsed) {
      if (!existing.has(entry.id)) {
        tx.store.put(entry);
        migrated++;
      }
    }
    await tx.done;

    
    window.localStorage.removeItem(LEGACY_MATCHES_KEY);
    if (migrated > 0) {
      console.log(`[dataStorage] ✅ Migrated ${migrated} match(es) from localStorage to IndexedDB`);
    }
  } catch (err) {
    console.error('[dataStorage] Migration from localStorage failed — localStorage preserved for retry', err);
    
  }
}





if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__deltaDumpMatches = async () => {
    const db = await openDB<TrackerDBSchema>(DB_NAME, DB_VERSION);
    const all = await db.getAll(MATCHES_STORE);
    const legacyRaw = window.localStorage.getItem(LEGACY_MATCHES_KEY);
    const legacy = legacyRaw ? JSON.parse(legacyRaw) as StoredMatchEntry[] : [];
    console.group('DELTAT — Match Data Dump');
    console.log(`IndexedDB: ${all.length} match(es)`);
    all.forEach(e => console.log(`  [IDB] id=${e.id}  name=${e.match.name}  games=${e.match.games.length}`));
    console.log(`localStorage (legacy): ${legacy.length} match(es)`);
    legacy.forEach((e: StoredMatchEntry) => console.log(`  [LS]  id=${e.id}  name=${e.match.name}  games=${e.match.games.length}`));
    console.log('Raw IDB blob:', JSON.stringify({ matches: all }, null, 2));
    console.groupEnd();
    return all;
  };
  console.log('[DELTAT] Recovery tool loaded — run window.__deltaDumpMatches() in console to inspect stored matches.');
}





export async function loadStoredMatches(): Promise<StoredMatchEntry[]> {
  // Try the Vite file-storage server first (port-independent disk storage).
  const serverData = await serverLoad();
  if (serverData !== null) {
    _useServerStorage = true;
    return serverData;
  }

  // Fallback: IndexedDB (used in production / static hosting without Vite server)
  _useServerStorage = false;
  try {
    const db = await getDB();
    return await db.getAll(MATCHES_STORE);
  } catch (err) {
    console.error('[dataStorage] Failed to load matches from IndexedDB', err);
    return [];
  }
}

/**
 * Persists the complete match list. Uses file storage (Vite server) when
 * available, falls back to IndexedDB otherwise.
 */
export async function saveAllMatches(entries: StoredMatchEntry[]): Promise<void> {
  if (_useServerStorage) {
    const ok = await serverSave(entries);
    if (ok) return;
    console.warn('[dataStorage] Server save failed — falling back to IndexedDB');
    _useServerStorage = false;
  }
  await idbSaveAll(entries);
}


export async function seedBundleIfNeeded(bundleEntries: StoredMatchEntry[]): Promise<void> {
  if (!bundleEntries.length) return;
  try {
    const db = await getDB();
    const tx = db.transaction(MATCHES_STORE, 'readwrite');
    const existingKeys = new Set((await tx.store.getAllKeys()) as number[]);
    let added = 0;
    for (const entry of bundleEntries) {
      if (!existingKeys.has(entry.id)) {
        tx.store.put(entry);
        added++;
      }
    }
    await tx.done;
    if (added > 0) {
      console.log(`[dataStorage] ✅ Seeded ${added} bundle match(es) into IndexedDB`);
    }
  } catch (err) {
    console.error('[dataStorage] Failed to seed bundle into IndexedDB', err);
  }
}


export async function addOrUpdateMatch(entry: StoredMatchEntry): Promise<void> {
  try {
    const db = await getDB();
    await db.put(MATCHES_STORE, entry);
  } catch (err) {
    console.error('[dataStorage] Failed to save match', err);
  }
}

export async function deleteStoredMatch(matchId: number): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(MATCHES_STORE, matchId);
  } catch (err) {
    console.error('[dataStorage] Failed to delete match', err);
  }
}

export async function clearStoredMatches(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear(MATCHES_STORE);
  } catch (err) {
    console.error('[dataStorage] Failed to clear matches', err);
  }
}

export function loadPersonalUserId(): number | null {
  if (!isBrowser()) {
    return null;
  }

  const raw = window.localStorage.getItem(PERSONAL_USER_KEY);
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function savePersonalUserId(userId: number | null): void {
  if (!isBrowser()) {
    return;
  }

  if (userId == null) {
    window.localStorage.removeItem(PERSONAL_USER_KEY);
    return;
  }

  window.localStorage.setItem(PERSONAL_USER_KEY, String(userId));
}

export interface TrackerSettingsStorage {
  useAccuracyForWins: boolean;
  excludeNonRxWins: boolean;
  privacyMode: boolean;
  ownerUsername: string;
  dashboardName: string;
  githubUrl: string;
  rankingAlgorithm: string;
}

const DEFAULT_SETTINGS: TrackerSettingsStorage = {
  useAccuracyForWins: false,
  excludeNonRxWins: false,
  privacyMode: false,
  ownerUsername: '',
  dashboardName: 'osu! Tracker',
  githubUrl: '',
  rankingAlgorithm: 'glicko-z',
};

export function loadTrackerSettings(): TrackerSettingsStorage {
  if (!isBrowser()) {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }

    const parsed = JSON.parse(raw) as TrackerSettingsStorage;
    return {
      useAccuracyForWins: Boolean(parsed?.useAccuracyForWins),
      excludeNonRxWins: Boolean(parsed?.excludeNonRxWins),
      privacyMode: Boolean(parsed?.privacyMode),
      ownerUsername: typeof parsed?.ownerUsername === 'string' ? parsed.ownerUsername : '',
      dashboardName: typeof parsed?.dashboardName === 'string' && parsed.dashboardName ? parsed.dashboardName : 'osu! Tracker',
      githubUrl: typeof parsed?.githubUrl === 'string' ? parsed.githubUrl : '',
      rankingAlgorithm: typeof parsed?.rankingAlgorithm === 'string' ? parsed.rankingAlgorithm : 'glicko-z',
    };
  } catch (error) {
    console.error('Failed to load tracker settings', error);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveTrackerSettings(settings: TrackerSettingsStorage): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to persist tracker settings', error);
  }
}

interface StoredToken {
  accessToken: string;
  expiresAt: number;
}

export function loadStoredToken(): StoredToken | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredToken;
    if (!parsed || typeof parsed.accessToken !== 'string' || typeof parsed.expiresAt !== 'number') {
      return null;
    }

    if (Date.now() >= parsed.expiresAt) {
      window.localStorage.removeItem(TOKEN_KEY);
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('Failed to load stored token', error);
    return null;
  }
}

export function saveStoredToken(token: StoredToken): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  } catch (error) {
    console.error('Failed to persist token', error);
  }
}

export function clearStoredToken(): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(TOKEN_KEY);
}

export function exportMatchesBlob(entries: StoredMatchEntry[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      matches: entries,
    },
    null,
    2,
  );
}

export function hydrateStoredEntry(match: OsuMatch, url?: string): StoredMatchEntry {
  return {
    id: match.id,
    url,
    importedAt: new Date().toISOString(),
    match,
  };
}
