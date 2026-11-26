import type { GameLevel, StoryCameraShot } from '../types/maker';

export interface DirectorViewportBridge {
  captureCurrentShot: (nameHint?: string) => StoryCameraShot | null;
  previewShot: (shot: StoryCameraShot, level: GameLevel) => void;
}

let activeBridge: DirectorViewportBridge | null = null;

export function registerDirectorViewportBridge(
  bridge: DirectorViewportBridge | null
): void {
  activeBridge = bridge;
}

export function getDirectorViewportBridge(): DirectorViewportBridge | null {
  return activeBridge;
}
