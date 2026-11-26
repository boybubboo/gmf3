import { useEffect, useState } from 'react';
import type { CharacterMakerDoc, CharacterPresetId } from '../types/maker';

export interface SavedDefaultCharacterEntry {
  presetId: CharacterPresetId;
  name?: string;
  updatedAt: number;
  doc: CharacterMakerDoc;
}

export const DEFAULT_CHARACTER_PRESETS_STORAGE_KEY = 'maker.defaultCharacterPresets.v1';
const DEFAULT_CHARACTER_PRESETS_EVENT = 'maker-default-character-presets-changed';

let cachedPresetMap: Partial<Record<CharacterPresetId, SavedDefaultCharacterEntry>> | null = null;

function notifyDefaultCharacterPresetsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(DEFAULT_CHARACTER_PRESETS_EVENT));
  }
}

export function loadDefaultCharacterPresets(): Partial<
  Record<CharacterPresetId, SavedDefaultCharacterEntry>
> {
  if (cachedPresetMap) return cachedPresetMap;
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(DEFAULT_CHARACTER_PRESETS_STORAGE_KEY);
    if (!raw) {
      cachedPresetMap = {};
      return cachedPresetMap;
    }
    const parsed = JSON.parse(raw) as Partial<
      Record<CharacterPresetId, SavedDefaultCharacterEntry>
    > | null;
    cachedPresetMap = parsed && typeof parsed === 'object' ? parsed : {};
    return cachedPresetMap;
  } catch {
    cachedPresetMap = {};
    return cachedPresetMap;
  }
}

function persistDefaultCharacterPresets(
  next: Partial<Record<CharacterPresetId, SavedDefaultCharacterEntry>>
) {
  cachedPresetMap = next;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(DEFAULT_CHARACTER_PRESETS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
  }
  notifyDefaultCharacterPresetsChanged();
}

export function getSavedCharacterSpeciesDefault(
  presetId: CharacterPresetId
): CharacterMakerDoc | null {
  const map = loadDefaultCharacterPresets();
  const entry = map[presetId];
  if (!entry?.doc || typeof entry.doc !== 'object') return null;
  try {
    return JSON.parse(JSON.stringify(entry.doc)) as CharacterMakerDoc;
  } catch {
    return null;
  }
}

export function getSavedCharacterSpeciesName(presetId: CharacterPresetId): string | null {
  const map = loadDefaultCharacterPresets();
  const name = map[presetId]?.name?.trim();
  return name ? name : null;
}

export function hasSavedCharacterSpeciesDefault(presetId: CharacterPresetId): boolean {
  const map = loadDefaultCharacterPresets();
  return Boolean(map[presetId]?.doc);
}

export function saveCharacterSpeciesDefault(
  presetId: CharacterPresetId,
  doc: CharacterMakerDoc,
  name?: string
) {
  const current = loadDefaultCharacterPresets();
  const clonedDoc = JSON.parse(JSON.stringify({ ...doc, presetId })) as CharacterMakerDoc;
  const next: Partial<Record<CharacterPresetId, SavedDefaultCharacterEntry>> = {
    ...current,
    [presetId]: {
      presetId,
      name: name?.trim() || undefined,
      updatedAt: Date.now(),
      doc: clonedDoc,
    },
  };
  persistDefaultCharacterPresets(next);
}

export function resetCharacterSpeciesDefault(presetId: CharacterPresetId) {
  const current = loadDefaultCharacterPresets();
  if (!current[presetId]) return;
  const next = { ...current };
  delete next[presetId];
  persistDefaultCharacterPresets(next);
}

export function useDefaultCharacterPresetsVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const onChange = () => setVersion((v) => v + 1);
    window.addEventListener(DEFAULT_CHARACTER_PRESETS_EVENT, onChange);
    return () => window.removeEventListener(DEFAULT_CHARACTER_PRESETS_EVENT, onChange);
  }, []);
  return version;
}
