import { useCallback, useEffect, useState } from 'react';
import type { AiReferenceImage } from './studioBridge';

export type AiProviderKind = 'gemini' | 'local' | 'openaiCompat';

export interface AiPreferences {
  provider: AiProviderKind;
  geminiModel: string;
  localBaseUrl: string;
  localModel: string;
  openaiBaseUrl: string;
  openaiModel: string;
  temperature: number;
  autoApplyOnGenerate: boolean;
}

export interface AiProviderServerStatus {
  geminiConfigured: boolean;
  openaiCompatConfigured: boolean;
  defaultOpenAiBaseUrl: string;
  defaultOpenAiModel: string;
}

export const AI_PREFERENCES_STORAGE_KEY = 'maker.aiPreferences.v1';

export const DEFAULT_AI_PREFERENCES: AiPreferences = {
  provider: 'gemini',
  geminiModel: 'gemini-4-hydrogen',
  localBaseUrl: 'http://localhost:11434/v1',
  localModel: 'qwen2.5:14b',
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiModel: 'gpt-4o-mini',
  temperature: 0.45,
  autoApplyOnGenerate: true,
};

export function loadAiPreferences(): AiPreferences {
  try {
    const raw = localStorage.getItem(AI_PREFERENCES_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AI_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<AiPreferences>;
    const provider: AiProviderKind =
      parsed.provider === 'local' || parsed.provider === 'openaiCompat'
        ? parsed.provider
        : 'gemini';
    const temp =
      typeof parsed.temperature === 'number' && Number.isFinite(parsed.temperature)
        ? Math.max(0, Math.min(1.2, parsed.temperature))
        : DEFAULT_AI_PREFERENCES.temperature;

    return {
      provider,
      geminiModel:
        typeof parsed.geminiModel === 'string' && parsed.geminiModel.trim()
          ? parsed.geminiModel.trim()
          : DEFAULT_AI_PREFERENCES.geminiModel,
      localBaseUrl:
        typeof parsed.localBaseUrl === 'string' && parsed.localBaseUrl.trim()
          ? parsed.localBaseUrl.trim()
          : DEFAULT_AI_PREFERENCES.localBaseUrl,
      localModel:
        typeof parsed.localModel === 'string' && parsed.localModel.trim()
          ? parsed.localModel.trim()
          : DEFAULT_AI_PREFERENCES.localModel,
      openaiBaseUrl:
        typeof parsed.openaiBaseUrl === 'string' && parsed.openaiBaseUrl.trim()
          ? parsed.openaiBaseUrl.trim()
          : DEFAULT_AI_PREFERENCES.openaiBaseUrl,
      openaiModel:
        typeof parsed.openaiModel === 'string' && parsed.openaiModel.trim()
          ? parsed.openaiModel.trim()
          : DEFAULT_AI_PREFERENCES.openaiModel,
      temperature: temp,
      autoApplyOnGenerate:
        typeof parsed.autoApplyOnGenerate === 'boolean'
          ? parsed.autoApplyOnGenerate
          : DEFAULT_AI_PREFERENCES.autoApplyOnGenerate,
    };
  } catch {
    return { ...DEFAULT_AI_PREFERENCES };
  }
}

export function saveAiPreferences(prefs: AiPreferences): void {
  try {
    localStorage.setItem(AI_PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage quota errors
  }
}

const listeners = new Set<() => void>();

export function updateAiPreferencesGlobal(patch: Partial<AiPreferences>): AiPreferences {
  const next = { ...loadAiPreferences(), ...patch };
  saveAiPreferences(next);
  listeners.forEach((cb) => cb());
  return next;
}

export function useAiPreferences(): [
  AiPreferences,
  (patch: Partial<AiPreferences>) => void,
  () => void
] {
  const [prefs, setPrefs] = useState<AiPreferences>(() => loadAiPreferences());

  useEffect(() => {
    const sync = () => setPrefs(loadAiPreferences());
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  const update = useCallback((patch: Partial<AiPreferences>) => {
    const next = updateAiPreferencesGlobal(patch);
    setPrefs(next);
  }, []);

  const reset = useCallback(() => {
    saveAiPreferences(DEFAULT_AI_PREFERENCES);
    setPrefs({ ...DEFAULT_AI_PREFERENCES });
    listeners.forEach((cb) => cb());
  }, []);

  return [prefs, update, reset];
}

export function validateLocalAiBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  const parsed = new URL(trimmed);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Local AI URL must use http:// or https://.');
  }
  const host = parsed.hostname.toLowerCase();
  const isLoopback =
    host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  if (!isLoopback) {
    throw new Error(
      'Direct browser Local AI only allows localhost or 127.0.0.1. For remote cloud inference, choose OpenAI-Compatible Server.'
    );
  }
  const cleanPath = parsed.pathname.replace(/\/+$/, '');
  if (!cleanPath || cleanPath === '/') {
    return `${parsed.origin}/v1`;
  }
  return `${parsed.origin}${cleanPath}`;
}

export async function fetchLocalAiModels(baseUrl: string): Promise<string[]> {
  const safeBase = validateLocalAiBaseUrl(baseUrl);
  const res = await fetch(`${safeBase}/models`, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Local AI server returned HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: Array<{ id?: string }>;
    models?: Array<{ name?: string; id?: string }>;
  };
  if (Array.isArray(json.data)) {
    return json.data.map((m) => m.id).filter((id): id is string => Boolean(id));
  }
  if (Array.isArray(json.models)) {
    return json.models
      .map((m) => m.id ?? m.name)
      .filter((id): id is string => Boolean(id));
  }
  return [];
}

export async function fetchAiProviderStatus(): Promise<AiProviderServerStatus> {
  const res = await fetch('/api/ai/status');
  if (!res.ok) {
    throw new Error('Could not reach Maker AI server.');
  }
  return (await res.json()) as AiProviderServerStatus;
}

function repairTruncatedJsonClient(raw: string): string {
  const firstBrace = raw.indexOf('{');
  if (firstBrace < 0) return raw;
  let text = raw.slice(firstBrace).trim();

  const stack: ('{' | '[')[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{' || ch === '[') {
      stack.push(ch);
    } else if (ch === '}') {
      if (stack.length > 0 && stack[stack.length - 1] === '{') stack.pop();
    } else if (ch === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === '[') stack.pop();
    }
  }

  if (inString) {
    if (escaped) text = text.slice(0, -1);
    text += '"';
  }

  text = text.replace(/,\s*$/, '');
  text = text.replace(/,\s*"[^"]*"\s*:\s*$/, '');
  text = text.replace(/\{\s*"[^"]*"\s*:\s*$/, '{');
  text = text.replace(/,\s*"[^"]*"\s*$/, '');
  text = text.replace(/\{\s*"[^"]*"\s*$/, '{');
  text = text.replace(/:\s*[+-]?(?:\d+\.?\d*|\.\d+)?\s*$/, ': 0');
  text = text.replace(/:\s*(?:tru|tr|t|fals|fal|fa|f|nul|nu|n)\s*$/, ': null');
  text = text.replace(/,\s*$/, '');

  while (stack.length > 0) {
    const open = stack.pop();
    text += open === '{' ? '}' : ']';
  }

  text = text.replace(/,\s*([}\]])/g, '$1');
  return text;
}

export function extractJsonObjectFromText(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  const slice =
    firstBrace >= 0 && lastBrace > firstBrace
      ? candidate.slice(firstBrace, lastBrace + 1)
      : candidate;

  try {
    const parsed = JSON.parse(slice) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fallback to trailing-comma & truncated JSON repair
  }

  const cleanedSlice = slice.replace(/,\s*([}\]])/g, '$1');
  try {
    const parsed = JSON.parse(cleanedSlice) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fallback to full bracket closure repair
  }

  const repaired = repairTruncatedJsonClient(candidate);
  const parsed = JSON.parse(repaired) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('AI response did not contain a valid JSON object.');
  }
  return parsed as Record<string, unknown>;
}

export async function runContextualAiGeneration(params: {
  prefs: AiPreferences;
  systemPrompt: string;
  userPrompt: string;
  referenceImage?: AiReferenceImage | null;
}): Promise<{ data: Record<string, unknown>; rawText: string; modelUsed: string }> {
  const { prefs, systemPrompt, userPrompt, referenceImage } = params;

  if (prefs.provider === 'local') {
    const safeBase = validateLocalAiBaseUrl(prefs.localBaseUrl);
    const model = prefs.localModel.trim() || 'qwen2.5:14b';

    const requestBody = (withResponseFormat: boolean, withImage: boolean) => {
      const userContent =
        withImage && referenceImage
          ? [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${referenceImage.mimeType};base64,${referenceImage.data}`,
                },
              },
              { type: 'text', text: userPrompt },
            ]
          : userPrompt;
      return JSON.stringify({
        model,
        temperature: prefs.temperature,
        ...(withResponseFormat ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      });
    };

    let res = await fetch(`${safeBase}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody(true, Boolean(referenceImage)),
    });

    if (res.status === 400 || res.status === 422) {
      res = await fetch(`${safeBase}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody(false, false),
      });
    }

    const payload = (await res.json().catch(() => null)) as
      | {
          error?: { message?: string } | string;
          choices?: Array<{ message?: { content?: string } }>;
        }
      | null;

    if (!res.ok) {
      const errMsg =
        typeof payload?.error === 'string'
          ? payload.error
          : payload?.error?.message || `Local AI returned status ${res.status}.`;
      throw new Error(errMsg);
    }

    const content = payload?.choices?.[0]?.message?.content ?? '';
    const data = extractJsonObjectFromText(content);
    return {
      data,
      rawText: JSON.stringify(data, null, 2),
      modelUsed: model,
    };
  }

  const endpointRes = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: prefs.provider,
      model: prefs.provider === 'gemini' ? prefs.geminiModel : prefs.openaiModel,
      customBaseUrl: prefs.provider === 'openaiCompat' ? prefs.openaiBaseUrl : undefined,
      systemPrompt,
      userPrompt,
      temperature: prefs.temperature,
      ...(referenceImage
        ? {
            referenceImage: {
              mimeType: referenceImage.mimeType,
              data: referenceImage.data,
            },
          }
        : {}),
    }),
  });

  const rawBody = await endpointRes.text().catch(() => '');
  let payload: {
    error?: string;
    data?: Record<string, unknown>;
    rawText?: string;
    model?: string;
  } | null = null;

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = null;
    }
  }

  if (!payload?.data && payload?.rawText) {
    try {
      payload.data = extractJsonObjectFromText(payload.rawText);
    } catch {
      // Keep original error handling below
    }
  }

  if (!endpointRes.ok || !payload?.data) {
    if (!payload && rawBody.trim().startsWith('<')) {
      throw new Error('AI server connection timed out or is warming up. Please try again.');
    }
    throw new Error(
      payload?.error ||
        `AI request failed${endpointRes.status && endpointRes.status !== 200 ? ` (${endpointRes.status})` : ': invalid response payload'}.`
    );
  }

  return {
    data: payload.data,
    rawText: payload.rawText ?? JSON.stringify(payload.data, null, 2),
    modelUsed:
      payload.model ||
      (prefs.provider === 'gemini' ? prefs.geminiModel : prefs.openaiModel),
  };
}
