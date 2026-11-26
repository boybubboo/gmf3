import type { DialogueVoiceConfig, GameLevel, VoiceClipMeta } from '../types/maker';

const DB_NAME = 'maker-voiceovers-db';
const DB_VERSION = 1;
const STORE_META = 'voiceMeta';
const STORE_BLOBS = 'voiceBlobs';

interface StoredVoiceBlob {
  buffer: ArrayBuffer;
  mimeType: string;
}

function openVoiceDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this browser.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open voice-over storage.'));
  });
}

export async function listVoiceMetas(): Promise<VoiceClipMeta[]> {
  try {
    const db = await openVoiceDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).getAll();
      req.onsuccess = () => {
        const rows = (req.result as VoiceClipMeta[]) ?? [];
        rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function getVoiceMeta(id: string): Promise<VoiceClipMeta | null> {
  try {
    const db = await openVoiceDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get(id);
      req.onsuccess = () => resolve((req.result as VoiceClipMeta | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function getVoiceBlobRecord(id: string): Promise<StoredVoiceBlob | null> {
  try {
    const db = await openVoiceDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BLOBS, 'readonly');
      const req = tx.objectStore(STORE_BLOBS).get(id);
      req.onsuccess = () => {
        const res = req.result;
        if (!res) {
          resolve(null);
          return;
        }
        if (res instanceof ArrayBuffer) {
          resolve({ buffer: res, mimeType: 'audio/webm' });
          return;
        }
        if (res && res.buffer instanceof ArrayBuffer) {
          resolve({ buffer: res.buffer, mimeType: res.mimeType || 'audio/webm' });
          return;
        }
        if (res && ArrayBuffer.isView(res.buffer)) {
          const view = res.buffer as ArrayBufferView;
          const copy = new Uint8Array(view.byteLength);
          copy.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
          resolve({ buffer: copy.buffer, mimeType: res.mimeType || 'audio/webm' });
          return;
        }
        resolve(null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function saveVoiceRecord(meta: VoiceClipMeta, buffer: ArrayBuffer): Promise<void> {
  const db = await openVoiceDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_META, STORE_BLOBS], 'readwrite');
    tx.objectStore(STORE_META).put(meta);
    tx.objectStore(STORE_BLOBS).put(
      { buffer, mimeType: meta.mimeType || 'audio/webm' } satisfies StoredVoiceBlob,
      meta.id
    );
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save voice-over clip.'));
  });
}

export async function deleteVoiceRecord(id: string): Promise<void> {
  try {
    const db = await openVoiceDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_META, STORE_BLOBS], 'readwrite');
      tx.objectStore(STORE_META).delete(id);
      tx.objectStore(STORE_BLOBS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to delete voice-over clip.'));
    });
  } catch {
    // ignore cleanup failures
  }
}

export async function measureAudioDuration(
  buffer: ArrayBuffer,
  mimeType: string
): Promise<number> {
  if (typeof window === 'undefined') return 0;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      try {
        const decoded = await ctx.decodeAudioData(buffer.slice(0));
        const dur = decoded.duration;
        await ctx.close().catch(() => {});
        if (Number.isFinite(dur) && dur > 0) return dur;
      } catch {
        await ctx.close().catch(() => {});
      }
    }
  } catch {
    // fallback below
  }
  return await new Promise<number>((resolve) => {
    try {
      const blob = new Blob([buffer], { type: mimeType || 'audio/webm' });
      const url = URL.createObjectURL(blob);
      const audio = document.createElement('audio');
      audio.preload = 'metadata';
      const done = (dur: number) => {
        URL.revokeObjectURL(url);
        resolve(Number.isFinite(dur) && dur > 0 ? dur : 0);
      };
      audio.onloadedmetadata = () => done(audio.duration);
      audio.onerror = () => done(0);
      audio.src = url;
    } catch {
      resolve(0);
    }
  });
}

export function collectVoiceIdsFromConfig(
  cfg: DialogueVoiceConfig | undefined,
  out: Set<string>
): void {
  if (!cfg) return;
  if (cfg.clipId) out.add(cfg.clipId);
  if (cfg.lineClipIds) {
    for (const id of Object.values(cfg.lineClipIds)) {
      if (id) out.add(id);
    }
  }
}

export function collectReferencedVoiceIds(
  levels: GameLevel[],
  extraConfigs?: Array<DialogueVoiceConfig | undefined>
): Set<string> {
  const out = new Set<string>();
  for (const lvl of levels) {
    collectVoiceIdsFromConfig(lvl.heroIntroVoice, out);
    for (const ent of lvl.entities) {
      collectVoiceIdsFromConfig(ent.voiceConfig, out);
    }
    for (const skit of lvl.storySkits ?? []) {
      for (const beat of skit.beats) {
        collectVoiceIdsFromConfig(beat.voiceConfig, out);
      }
    }
  }
  if (extraConfigs) {
    for (const cfg of extraConfigs) {
      collectVoiceIdsFromConfig(cfg, out);
    }
  }
  return out;
}

export function formatVoiceDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const total = Math.max(0, Math.round(sec * 10) / 10);
  const mins = Math.floor(total / 60);
  const rem = total - mins * 60;
  return `${mins}:${rem < 10 ? '0' : ''}${rem.toFixed(1).replace(/\.0$/, '')}`;
}
