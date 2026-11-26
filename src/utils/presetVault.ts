import type {
  GameProject,
  SavePresetEntry,
  SavePresetsFileBundle,
  SavePresetScope,
} from '../types/maker';
import { uid } from './terrain';

const DB_NAME = 'maker-savepresets-db';
const DB_VERSION = 1;
const STORE_PRESETS = 'presets';
const FALLBACK_LS_KEY = 'maker.savepresets.fallback.v1';

function openPresetsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this browser.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PRESETS)) {
        db.createObjectStore(STORE_PRESETS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open local presets store.'));
  });
}

function sortPresetsNewestFirst(rows: SavePresetEntry[]): SavePresetEntry[] {
  return [...rows].sort((a, b) =>
    (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')
  );
}

export async function listSavedPresets(): Promise<SavePresetEntry[]> {
  try {
    const db = await openPresetsDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PRESETS, 'readonly');
      const store = tx.objectStore(STORE_PRESETS);
      const req = store.getAll();
      req.onsuccess = () => {
        resolve(sortPresetsNewestFirst((req.result as SavePresetEntry[]) ?? []));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      const raw = localStorage.getItem(FALLBACK_LS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as SavePresetEntry[];
      return Array.isArray(parsed) ? sortPresetsNewestFirst(parsed) : [];
    } catch {
      return [];
    }
  }
}

export async function savePresetRecord(entry: SavePresetEntry): Promise<void> {
  try {
    const db = await openPresetsDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PRESETS, 'readwrite');
      tx.objectStore(STORE_PRESETS).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to save preset.'));
    });
  } catch {
    const existing = await listSavedPresets();
    const next = [entry, ...existing.filter((p) => p.id !== entry.id)];
    localStorage.setItem(FALLBACK_LS_KEY, JSON.stringify(next));
  }
}

export async function deletePresetRecord(id: string): Promise<void> {
  try {
    const db = await openPresetsDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PRESETS, 'readwrite');
      tx.objectStore(STORE_PRESETS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to delete preset.'));
    });
  } catch {
    const existing = await listSavedPresets();
    localStorage.setItem(
      FALLBACK_LS_KEY,
      JSON.stringify(existing.filter((p) => p.id !== id))
    );
  }
}

export async function replaceAllPresetRecords(entries: SavePresetEntry[]): Promise<void> {
  try {
    const db = await openPresetsDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PRESETS, 'readwrite');
      const store = tx.objectStore(STORE_PRESETS);
      store.clear();
      for (const entry of entries) {
        store.put(entry);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to replace presets.'));
    });
  } catch {
    localStorage.setItem(FALLBACK_LS_KEY, JSON.stringify(entries));
  }
}

export function serializeSavePresetsFile(presets: SavePresetEntry[]): string {
  const bundle: SavePresetsFileBundle = {
    format: 'maker.savepresets.v1',
    exportedAt: new Date().toISOString(),
    presets,
  };
  return JSON.stringify(bundle, null, 2);
}

export function downloadSavePresetsFile(
  presets: SavePresetEntry[],
  filename = 'savepresets.json'
): void {
  const jsonText = serializeSavePresetsFile(presets);
  const blob = new Blob([jsonText], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function isValidScope(scope: unknown): scope is SavePresetScope {
  return (
    scope === 'fullGame' ||
    scope === 'worldLevel' ||
    scope === 'treeStudio' ||
    scope === 'atmosphere'
  );
}

function normalizePresetEntry(raw: Partial<SavePresetEntry>): SavePresetEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  if (!isValidScope(raw.scope)) return null;
  if (raw.scope === 'fullGame' && !raw.fullGame) return null;
  if (raw.scope === 'worldLevel' && !raw.worldLevel?.level) return null;
  if (raw.scope === 'treeStudio' && !raw.treeStudio) return null;
  if (raw.scope === 'atmosphere' && !raw.atmosphere) return null;

  const now = new Date().toISOString();
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : uid(),
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Untitled Preset',
    notes: typeof raw.notes === 'string' && raw.notes.trim() ? raw.notes.trim() : undefined,
    scope: raw.scope,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
    summary: typeof raw.summary === 'string' ? raw.summary : 'Saved game design preset',
    fullGame: raw.fullGame,
    worldLevel: raw.worldLevel,
    treeStudio: raw.treeStudio,
    atmosphere: raw.atmosphere,
    assets: Array.isArray(raw.assets) ? raw.assets : undefined,
    textures: Array.isArray(raw.textures) ? raw.textures : undefined,
  };
}

export function parseSavePresetsFile(
  rawText: string
): { ok: true; presets: SavePresetEntry[] } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(rawText);

    // 1. Standard savepresets.json bundle (maker.savepresets.v1)
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.presets)) {
      const valid = (parsed.presets as Partial<SavePresetEntry>[])
        .map(normalizePresetEntry)
        .filter((item): item is SavePresetEntry => item !== null);
      if (valid.length === 0) {
        return { ok: false, error: 'No valid presets were found inside that file.' };
      }
      return { ok: true, presets: valid };
    }

    // 2. Single preset object
    if (parsed && typeof parsed === 'object' && isValidScope(parsed.scope)) {
      const single = normalizePresetEntry(parsed as Partial<SavePresetEntry>);
      if (single) return { ok: true, presets: [single] };
    }

    // 3. Legacy .maker.json full game bundle (seamless compatibility!)
    const legacyProj: GameProject | undefined = parsed?.project ?? parsed;
    if (legacyProj && typeof legacyProj.name === 'string' && Array.isArray(legacyProj.levels)) {
      const now = new Date().toISOString();
      const totalEnts = legacyProj.levels.reduce((s, l) => s + (l.entities?.length ?? 0), 0);
      const converted: SavePresetEntry = {
        id: uid(),
        name: legacyProj.name,
        notes: 'Imported from .maker.json bundle',
        scope: 'fullGame',
        createdAt: now,
        updatedAt: now,
        summary: `${legacyProj.levels.length} level${legacyProj.levels.length === 1 ? '' : 's'} · ${totalEnts} entities`,
        fullGame: legacyProj,
        assets: Array.isArray(parsed?.assets) ? parsed.assets : undefined,
        textures: Array.isArray(parsed?.textures) ? parsed.textures : undefined,
      };
      return { ok: true, presets: [converted] };
    }

    return {
      ok: false,
      error: 'That file is not a valid savepresets.json or Maker game file.',
    };
  } catch {
    return { ok: false, error: 'Could not read that JSON file.' };
  }
}
