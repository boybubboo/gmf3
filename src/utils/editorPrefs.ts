import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

const HINTS_STORAGE_KEY = 'maker.world.hintsEnabled.v1';
const HINTS_EVENT_NAME = 'maker:hints-pref-changed';
const GUIDANCE_EVENT_NAME = 'maker:active-guidance-changed';

export type AtmosphereSectionId =
  | 'skyTime'
  | 'fogMist'
  | 'weatherWind'
  | 'sunRays'
  | 'styleBiome'
  | 'postFx'
  | 'horizonVista';

export interface GuidanceHint {
  badge?: string;
  title: string;
  detail: string;
}

let currentGuidanceHint: GuidanceHint | null = null;

export function publishGuidanceHint(hint: GuidanceHint | null): void {
  currentGuidanceHint = hint;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<GuidanceHint | null>(GUIDANCE_EVENT_NAME, { detail: hint }));
  }
}

export function useActiveGuidanceHint(): GuidanceHint | null {
  const [hint, setHint] = useState<GuidanceHint | null>(() => currentGuidanceHint);

  useEffect(() => {
    const onChange = (ev: Event) => {
      setHint((ev as CustomEvent<GuidanceHint | null>).detail ?? null);
    };
    window.addEventListener(GUIDANCE_EVENT_NAME, onChange);
    return () => window.removeEventListener(GUIDANCE_EVENT_NAME, onChange);
  }, []);

  return hint;
}

function cleanControlLabel(raw: string): string {
  return raw
    .replace(/\([^)]*\)/g, '')
    .replace(/[-+]?\d+(\.\d+)?\s*(%|m|ms|s|°|×|x|deg|fps)?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function publishGuidanceFromControlEvent(
  ev: React.SyntheticEvent<HTMLElement>,
  fallbackBadge = 'Active Control'
): void {
  const target = ev.target as HTMLElement | null;
  if (!target) return;

  const hinted = target.closest('[data-hint-title]') as HTMLElement | null;
  if (hinted) {
    const title = hinted.getAttribute('data-hint-title') || '';
    const detail = hinted.getAttribute('data-hint-detail') || '';
    const badge = hinted.getAttribute('data-hint-badge') || fallbackBadge;
    if (title && detail) {
      publishGuidanceHint({ badge, title, detail });
      return;
    }
  }

  const tag = target.tagName.toLowerCase();
  const inputType = tag === 'input' ? (target as HTMLInputElement).type : '';
  const role = target.getAttribute('role') || '';
  const isRange = tag === 'input' && inputType === 'range';
  const isSelect = tag === 'select';
  const isCheckbox = (tag === 'input' && inputType === 'checkbox') || role === 'switch';

  if (!isRange && !isSelect && !isCheckbox) return;

  let rawLabel =
    target.getAttribute('aria-label') ||
    target.getAttribute('title') ||
    '';

  if (!rawLabel) {
    const labelEl = target.closest('label');
    if (labelEl) {
      const span = labelEl.querySelector('span');
      rawLabel = span?.textContent || labelEl.textContent || '';
    }
  }

  if (!rawLabel && target.parentElement) {
    const row = target.parentElement;
    const prev = target.previousElementSibling;
    if (prev && prev.textContent?.trim()) {
      rawLabel = prev.textContent.trim();
    } else {
      const headerRow = row.querySelector('div, span');
      if (headerRow && headerRow !== target && headerRow.textContent?.trim()) {
        const firstChildText = headerRow.firstElementChild?.textContent?.trim();
        rawLabel = firstChildText || headerRow.textContent.trim();
      }
    }
  }

  const label = cleanControlLabel(rawLabel);
  if (!label || label.length < 2) return;

  if (isRange) {
    publishGuidanceHint({
      badge: fallbackBadge,
      title: label,
      detail: `Drag this slider left or right to tune ${label} live in your scene.`,
    });
  } else if (isSelect) {
    publishGuidanceHint({
      badge: fallbackBadge,
      title: label,
      detail: `Pick an option in ${label} to update how this element looks or behaves.`,
    });
  } else if (isCheckbox) {
    publishGuidanceHint({
      badge: fallbackBadge,
      title: label,
      detail: `Click to toggle ${label} on or off.`,
    });
  }
}

export function getStoredHintsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(HINTS_STORAGE_KEY);
    return raw !== 'false';
  } catch {
    return true;
  }
}

export function setStoredHintsEnabled(next: boolean): void {
  try {
    localStorage.setItem(HINTS_STORAGE_KEY, String(next));
  } catch {
    // ignore storage errors
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<boolean>(HINTS_EVENT_NAME, { detail: next }));
  }
}

export function useHintsEnabled(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabledState] = useState<boolean>(getStoredHintsEnabled);

  useEffect(() => {
    const onCustom = (ev: Event) => {
      const detail = (ev as CustomEvent<boolean>).detail;
      if (typeof detail === 'boolean') {
        setEnabledState(detail);
      } else {
        setEnabledState(getStoredHintsEnabled());
      }
    };
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === HINTS_STORAGE_KEY) {
        setEnabledState(ev.newValue !== 'false');
      }
    };
    window.addEventListener(HINTS_EVENT_NAME, onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(HINTS_EVENT_NAME, onCustom);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    setStoredHintsEnabled(next);
  }, []);

  return [enabled, setEnabled];
}
