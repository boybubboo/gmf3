import type { GameProject } from '../types/maker';

const DB_NAME = 'maker-projects-db';
const DB_VERSION = 1;
const STORE_SNAPSHOTS = 'snapshots';
const PROJECTS_RECORD_KEY = 'maker.projects.v1';

export const PROJECTS_IDB_MARKER_KEY = 'maker.projects.idb.v1';

let dbPromise: Promise<IDBDatabase> | null = null;

function openProjectsDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      dbPromise = null;
      reject(new Error('IndexedDB is unavailable in this browser.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onclose = () => {
        dbPromise = null;
      };
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error('Failed to open projects IndexedDB.'));
    };
  });
  return dbPromise;
}

export async function saveProjectsSnapshotToIDB(serialized: string): Promise<void> {
  const db = await openProjectsDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
    tx.objectStore(STORE_SNAPSHOTS).put(serialized, PROJECTS_RECORD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to write projects snapshot to IndexedDB.'));
    tx.onabort = () => reject(tx.error ?? new Error('Projects IndexedDB transaction aborted.'));
  });
  try {
    localStorage.setItem(PROJECTS_IDB_MARKER_KEY, String(Date.now()));
  } catch {
    // ignore storage quota errors on marker write
  }
}

export async function loadProjectsSnapshotFromIDB(): Promise<GameProject[] | null> {
  try {
    const db = await openProjectsDB();
    const raw = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
      const req = tx.objectStore(STORE_SNAPSHOTS).get(PROJECTS_RECORD_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Failed to read projects snapshot from IndexedDB.'));
    });
    if (typeof raw === 'string' && raw.length > 0) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as GameProject[];
      }
    } else if (Array.isArray(raw) && raw.length > 0) {
      return raw as GameProject[];
    }
    return null;
  } catch {
    return null;
  }
}
