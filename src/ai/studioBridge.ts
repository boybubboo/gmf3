import { useEffect, useRef, useState } from 'react';
import type { StageTab } from '../types/maker';

export type AiStudioContextId =
  | 'world'
  | 'character'
  | 'creature'
  | 'motion'
  | 'logic'
  | 'object'
  | 'plant'
  | 'tree'
  | 'cast'
  | 'interface';

export interface AiReferenceImage {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  data: string;
  fileName?: string;
}

export type CharacterGuideArchetype =
  | 'auto'
  | 'humanoid'
  | 'animal'
  | 'bird'
  | 'fantasy'
  | 'bug';

export type CharacterGuideExtremity =
  | 'auto'
  | 'hands'
  | 'paw'
  | 'claw'
  | 'hoof'
  | 'nub';

export type CharacterGuideSurface =
  | 'auto'
  | 'smooth'
  | 'armor'
  | 'furShort'
  | 'furLong'
  | 'scales';

export type CharacterGuideExtra =
  | 'helmetOrHat'
  | 'pauldronsOrArmor'
  | 'capeOrCloak'
  | 'beardOrMustache'
  | 'eyewear'
  | 'wings'
  | 'horns'
  | 'tail'
  | 'spikes';

export interface CharacterPromptGuide {
  archetype: CharacterGuideArchetype;
  extremities: CharacterGuideExtremity;
  surface: CharacterGuideSurface;
  extras: CharacterGuideExtra[];
}

export interface AiApplyOptions {
  modifyExisting?: boolean;
  characterGuide?: CharacterPromptGuide;
}

export interface StudioAiBridge {
  id: string;
  context: AiStudioContextId;
  title: string;
  subtitle: string;
  saveLabel: string;
  getSnapshot: () => Record<string, unknown>;
  applyResult: (rawData: Record<string, unknown>, options?: AiApplyOptions) => string;
  saveAsset?: (suggestedName?: string) => Promise<string | void>;
}

const bridgeStack: StudioAiBridge[] = [];
const bridgeListeners = new Set<() => void>();
const openAiModalListeners = new Set<(preferredContext?: AiStudioContextId) => void>();

export interface ContextualAiPanelState {
  isOpen: boolean;
  preferredContext?: AiStudioContextId;
}

let aiPanelState: ContextualAiPanelState = { isOpen: false };
const aiPanelListeners = new Set<() => void>();

function notifyAiPanelListeners(): void {
  aiPanelListeners.forEach((cb) => cb());
}

export function getContextualAiPanelState(): ContextualAiPanelState {
  return aiPanelState;
}

export function setContextualAiPanelOpen(
  isOpen: boolean,
  preferredContext?: AiStudioContextId
): void {
  aiPanelState = {
    isOpen,
    preferredContext: isOpen ? preferredContext : undefined,
  };
  notifyAiPanelListeners();
}

export function toggleContextualAiPanel(preferredContext?: AiStudioContextId): void {
  if (aiPanelState.isOpen && (!preferredContext || aiPanelState.preferredContext === preferredContext)) {
    setContextualAiPanelOpen(false);
  } else {
    setContextualAiPanelOpen(true, preferredContext);
  }
}

export function useContextualAiPanelState(): ContextualAiPanelState {
  const [state, setState] = useState<ContextualAiPanelState>(() => aiPanelState);
  useEffect(() => {
    const sync = () => setState(aiPanelState);
    aiPanelListeners.add(sync);
    return () => {
      aiPanelListeners.delete(sync);
    };
  }, []);
  return state;
}

function notifyBridgeListeners(): void {
  bridgeListeners.forEach((cb) => cb());
}

export function registerStudioAiBridge(bridge: StudioAiBridge): () => void {
  const existingIdx = bridgeStack.findIndex((b) => b.id === bridge.id);
  if (existingIdx >= 0) {
    bridgeStack.splice(existingIdx, 1);
  }
  bridgeStack.push(bridge);
  notifyBridgeListeners();
  return () => {
    const idx = bridgeStack.findIndex((b) => b.id === bridge.id);
    if (idx >= 0) {
      bridgeStack.splice(idx, 1);
      notifyBridgeListeners();
    }
  };
}

export function getActiveStudioAiBridge(): StudioAiBridge | null {
  return bridgeStack.length > 0 ? bridgeStack[bridgeStack.length - 1] : null;
}

export function useActiveStudioAiBridge(): StudioAiBridge | null {
  const [active, setActive] = useState<StudioAiBridge | null>(() => getActiveStudioAiBridge());
  useEffect(() => {
    const sync = () => setActive(getActiveStudioAiBridge());
    bridgeListeners.add(sync);
    return () => {
      bridgeListeners.delete(sync);
    };
  }, []);
  return active;
}

/**
 * Registers a studio modal or workspace stage with the contextual AI assistant.
 * Uses a live ref internally so state updates don't thrash bridge listeners.
 */
export function useRegisterStudioAiBridge(bridge: StudioAiBridge | null): void {
  const latestRef = useRef<StudioAiBridge | null>(bridge);
  latestRef.current = bridge;

  const bridgeId = bridge?.id ?? null;
  const bridgeContext = bridge?.context ?? null;

  useEffect(() => {
    if (!bridgeId || !bridgeContext) return;
    const proxy: StudioAiBridge = {
      id: bridgeId,
      context: bridgeContext,
      get title() {
        return latestRef.current?.title ?? '';
      },
      get subtitle() {
        return latestRef.current?.subtitle ?? '';
      },
      get saveLabel() {
        return latestRef.current?.saveLabel ?? 'Save';
      },
      getSnapshot: () => latestRef.current?.getSnapshot() ?? {},
      applyResult: (rawData, options) =>
        latestRef.current?.applyResult(rawData, options) ?? 'Applied',
      saveAsset: latestRef.current?.saveAsset
        ? (name?: string) => latestRef.current!.saveAsset!(name)
        : undefined,
    };
    return registerStudioAiBridge(proxy);
  }, [bridgeId, bridgeContext]);
}

export function requestOpenContextualAiModal(preferredContext?: AiStudioContextId): void {
  setContextualAiPanelOpen(true, preferredContext);
  openAiModalListeners.forEach((cb) => cb(preferredContext));
}

export function subscribeOpenContextualAiModal(
  cb: (preferredContext?: AiStudioContextId) => void
): () => void {
  openAiModalListeners.add(cb);
  return () => {
    openAiModalListeners.delete(cb);
  };
}

export function resolveContextFromStage(selectedTab: StageTab): AiStudioContextId {
  if (selectedTab === 'world') return 'world';
  if (selectedTab === 'cast') return 'cast';
  if (selectedTab === 'motion') return 'motion';
  if (selectedTab === 'logic') return 'logic';
  return 'interface';
}
