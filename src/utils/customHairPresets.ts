import { useEffect, useState } from 'react';
import type { CharacterHairSculptConfig, CharacterHairStyle } from '../types/maker';

export interface CustomHairPresetEntry {
  id: string;
  name: string;
  updatedAt: number;
  baseStyle: CharacterHairStyle;
  hairColor: string;
  hairAccentColor: string;
  hairScale: number;
  hairOffsetX: number;
  hairOffsetY: number;
  hairOffsetZ: number;
  hairRotX: number;
  hairRotY: number;
  hairRotZ: number;
  hairConfig: CharacterHairSculptConfig;
}

const CUSTOM_HAIR_PRESETS_STORAGE_KEY = 'maker.customHairPresets.v1';
const CUSTOM_HAIR_PRESETS_EVENT = 'maker-custom-hair-presets-changed';

let cachedPresets: CustomHairPresetEntry[] | null = null;

function notifyCustomHairPresetsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CUSTOM_HAIR_PRESETS_EVENT));
  }
}

export function loadCustomHairPresets(): CustomHairPresetEntry[] {
  if (cachedPresets) return cachedPresets;
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(CUSTOM_HAIR_PRESETS_STORAGE_KEY);
    if (!raw) {
      cachedPresets = [];
      return cachedPresets;
    }
    const parsed = JSON.parse(raw) as CustomHairPresetEntry[] | null;
    cachedPresets = Array.isArray(parsed) ? parsed.filter((p) => p && typeof p.id === 'string' && p.hairConfig) : [];
    return cachedPresets;
  } catch {
    cachedPresets = [];
    return cachedPresets;
  }
}

function persistCustomHairPresets(next: CustomHairPresetEntry[]): void {
  cachedPresets = next;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(CUSTOM_HAIR_PRESETS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
  }
  notifyCustomHairPresetsChanged();
}

export function saveCustomHairPreset(
  entry: Omit<CustomHairPresetEntry, 'id' | 'updatedAt'> & { id?: string }
): CustomHairPresetEntry {
  const current = loadCustomHairPresets();
  const id = entry.id && entry.id.trim() ? entry.id.trim() : `hair_${Date.now().toString(36)}`;
  const saved: CustomHairPresetEntry = {
    id,
    name: entry.name.trim() || 'Custom Hair',
    updatedAt: Date.now(),
    baseStyle: entry.baseStyle,
    hairColor: entry.hairColor,
    hairAccentColor: entry.hairAccentColor,
    hairScale: entry.hairScale,
    hairOffsetX: entry.hairOffsetX,
    hairOffsetY: entry.hairOffsetY,
    hairOffsetZ: entry.hairOffsetZ,
    hairRotX: entry.hairRotX,
    hairRotY: entry.hairRotY,
    hairRotZ: entry.hairRotZ,
    hairConfig: JSON.parse(JSON.stringify(entry.hairConfig)) as CharacterHairSculptConfig,
  };
  const idx = current.findIndex((p) => p.id === id);
  const next = idx >= 0 ? current.map((p, i) => (i === idx ? saved : p)) : [...current, saved];
  persistCustomHairPresets(next);
  return saved;
}

export function deleteCustomHairPreset(id: string): void {
  const current = loadCustomHairPresets();
  const next = current.filter((p) => p.id !== id);
  if (next.length !== current.length) {
    persistCustomHairPresets(next);
  }
}

export function useCustomHairPresets(): CustomHairPresetEntry[] {
  const [list, setList] = useState<CustomHairPresetEntry[]>(() => loadCustomHairPresets());
  useEffect(() => {
    const onChange = () => setList([...loadCustomHairPresets()]);
    window.addEventListener(CUSTOM_HAIR_PRESETS_EVENT, onChange);
    return () => window.removeEventListener(CUSTOM_HAIR_PRESETS_EVENT, onChange);
  }, []);
  return list;
}
