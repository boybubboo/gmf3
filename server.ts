import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';
const ALLOWED_GEMINI_MODELS = new Set([
  'gemini-4-hydrogen',
  'gemini-4-neon',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
]);

function isDisallowedHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost')
  ) {
    return true;
  }

  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    const parts = host.split('.').map((n) => Number(n));
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  if (ipVersion === 6) {
    if (host === '::1' || host === '::') return true;
    if (host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) {
      return true;
    }
    if (host.startsWith('::ffff:')) {
      const mapped = host.slice('::ffff:'.length);
      return isDisallowedHostname(mapped);
    }
    return false;
  }

  return false;
}

function validateRemoteHttpsBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  const parsed = new URL(trimmed);
  if (parsed.protocol !== 'https:') {
    throw new Error('Remote OpenAI-compatible endpoints must use HTTPS.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Endpoint URLs cannot embed credentials.');
  }
  if (isDisallowedHostname(parsed.hostname)) {
    throw new Error('Private or loopback hosts are blocked on server proxy routes.');
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
}

function extractFirstJsonObject(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced
    ? fenced[1].trim()
    : trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return candidate.slice(firstBrace, lastBrace + 1);
  }
  if (firstBrace >= 0) {
    return candidate.slice(firstBrace);
  }
  return candidate;
}

function repairTruncatedJson(input: string): string {
  const src = input.trim().replace(/,\s*([}\]])/g, '$1');
  const stack: ('}' | ']')[] = [];
  let inString = false;
  let escape = false;
  let lastValidEnd = 0;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      stack.push('}');
    } else if (ch === '[') {
      stack.push(']');
    } else if (ch === '}' || ch === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === ch) {
        stack.pop();
        lastValidEnd = i + 1;
        if (stack.length === 0) {
          return src.slice(0, lastValidEnd);
        }
      }
    }
  }

  let base = src;
  if (inString) {
    base += '"';
  }
  // Strip any dangling colon or trailing comma before closing open containers
  base = base.replace(/[,:\s]+$/, '');
  while (stack.length > 0) {
    base += stack.pop();
  }
  return base.replace(/,\s*([}\]])/g, '$1');
}

function parseOrRepairJsonObject(raw: string): {
  parsed: Record<string, unknown> | null;
  jsonText: string;
} {
  const extracted = extractFirstJsonObject(raw);
  const candidates = [
    extracted,
    extracted.replace(/,\s*([}\]])/g, '$1'),
    repairTruncatedJson(extracted),
  ];

  const firstBrace = raw.indexOf('{');
  if (firstBrace >= 0) {
    candidates.push(repairTruncatedJson(raw.slice(firstBrace)));
  }

  for (const cand of candidates) {
    if (!cand) continue;
    try {
      const val = JSON.parse(cand) as unknown;
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        return { parsed: val as Record<string, unknown>, jsonText: cand };
      }
      if (Array.isArray(val)) {
        const wrapped = { widgets: val };
        return { parsed: wrapped, jsonText: JSON.stringify(wrapped) };
      }
    } catch {
      // try next repair candidate
    }
  }

  return { parsed: null, jsonText: extracted };
}

const ALLOWED_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

interface ValidReferenceImage {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  data: string;
}

function parseReferenceImage(raw: unknown): ValidReferenceImage | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as { mimeType?: unknown; data?: unknown };
  const mimeType = typeof obj.mimeType === 'string' ? obj.mimeType.trim().toLowerCase() : '';
  if (!ALLOWED_IMAGE_MIMES.has(mimeType)) return null;
  if (typeof obj.data !== 'string' || !obj.data.trim()) return null;
  const stripped = obj.data.replace(/^data:image\/[a-z0-9+.-]+;base64,/i, '').trim();
  if (!stripped || stripped.length > 6_000_000) return null;
  return {
    mimeType: mimeType as ValidReferenceImage['mimeType'],
    data: stripped,
  };
}

interface AiGenerateBody {
  provider?: unknown;
  model?: unknown;
  systemPrompt?: unknown;
  userPrompt?: unknown;
  temperature?: unknown;
  customBaseUrl?: unknown;
  referenceImage?: unknown;
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '8mb' }));

  const passwordHashFilePath = path.resolve(__dirname, 'src/data/appPasswordHash.json');

  const readStoredPasswordHash = (): string => {
    try {
      if (fs.existsSync(passwordHashFilePath)) {
        const parsed = JSON.parse(fs.readFileSync(passwordHashFilePath, 'utf-8')) as {
          passwordSha256?: unknown;
        };
        if (typeof parsed.passwordSha256 === 'string') {
          return parsed.passwordSha256.trim().toLowerCase();
        }
      }
    } catch {
      // ignore read errors
    }
    return '';
  };

  app.get('/api/auth/status', (_req: Request, res: Response) => {
    const hash = readStoredPasswordHash();
    res.json({
      hasPassword: Boolean(hash),
      passwordSha256: hash,
    });
  });

  app.post('/api/auth/setup', (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { passwordSha256?: unknown; currentSha256?: unknown };
    const nextHash =
      typeof body.passwordSha256 === 'string' ? body.passwordSha256.trim().toLowerCase() : '';
    if (!/^[a-f0-9]{64}$/.test(nextHash)) {
      res.status(400).json({ error: 'Invalid SHA-256 password hash.' });
      return;
    }
    const existingHash = readStoredPasswordHash();
    const currentHash =
      typeof body.currentSha256 === 'string' ? body.currentSha256.trim().toLowerCase() : '';
    if (existingHash && existingHash !== nextHash && currentHash !== existingHash) {
      res.status(403).json({ error: 'Password is already configured.' });
      return;
    }
    try {
      fs.writeFileSync(
        passwordHashFilePath,
        `${JSON.stringify({ passwordSha256: nextHash }, null, 2)}\n`,
        'utf-8'
      );
      res.json({ ok: true, passwordSha256: nextHash });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to save password hash.',
      });
    }
  });

  app.get('/api/ai/status', (_req: Request, res: Response) => {
    const defaultOpenAiBaseUrl =
      process.env.OPENAI_COMPAT_BASE_URL?.trim() || 'https://api.openai.com/v1';
    const defaultOpenAiModel =
      process.env.OPENAI_COMPAT_MODEL?.trim() || 'gpt-4o-mini';

    res.json({
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      openaiCompatConfigured: Boolean(process.env.OPENAI_COMPAT_API_KEY?.trim()),
      defaultOpenAiBaseUrl,
      defaultOpenAiModel,
    });
  });

  app.post('/api/ai/generate', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as AiGenerateBody;
    const provider = body.provider === 'openaiCompat' ? 'openaiCompat' : 'gemini';
    const systemPrompt =
      typeof body.systemPrompt === 'string' ? body.systemPrompt.slice(0, 40000) : '';
    const userPrompt =
      typeof body.userPrompt === 'string' ? body.userPrompt.slice(0, 40000) : '';
    const temperatureRaw =
      typeof body.temperature === 'number' && Number.isFinite(body.temperature)
        ? body.temperature
        : 0.45;
    const temperature = Math.max(0, Math.min(1.2, temperatureRaw));
    const referenceImage = parseReferenceImage(body.referenceImage);

    if (!userPrompt.trim()) {
      res.status(400).json({ error: 'Prompt text is required.' });
      return;
    }

    if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey) {
        // Note: Use 422 instead of 503 because Nginx proxy_intercept_errors rewrites 502/503/504 to 200 /warmup.html
        res.status(422).json({
          error:
            'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets or switch to Local AI (Ollama/LM Studio).',
        });
        return;
      }

      const requestedModel = typeof body.model === 'string' ? body.model.trim() : '';
      const model = ALLOWED_GEMINI_MODELS.has(requestedModel)
        ? requestedModel
        : DEFAULT_GEMINI_MODEL;

      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });
        const contents = referenceImage
          ? {
              parts: [
                {
                  inlineData: {
                    mimeType: referenceImage.mimeType,
                    data: referenceImage.data,
                  },
                },
                { text: userPrompt },
              ],
            }
          : userPrompt;
        const isGemini4 = model.startsWith('gemini-4-');
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: systemPrompt || undefined,
            ...(isGemini4
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : { temperature }),
            responseMimeType: 'application/json',
          },
        });
        const rawText = response.text ?? '';
        const { parsed, jsonText } = parseOrRepairJsonObject(rawText);
        if (!parsed) {
          res.status(422).json({
            error: 'Gemini returned an incomplete or non-JSON response. Please try a shorter prompt.',
            rawText,
          });
          return;
        }
        res.json({
          provider: 'gemini',
          model,
          data: parsed,
          rawText: jsonText,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gemini request failed.';
        res.status(500).json({ error: msg });
      }
      return;
    }

    // OpenAI-compatible remote HTTPS inference proxy
    const openAiKey = process.env.OPENAI_COMPAT_API_KEY?.trim();
    if (!openAiKey) {
      res.status(422).json({
        error:
          'OPENAI_COMPAT_API_KEY is not configured on the server. Add it to your environment or use Local AI / Gemini.',
      });
      return;
    }

    const rawBaseUrl =
      typeof body.customBaseUrl === 'string' && body.customBaseUrl.trim()
        ? body.customBaseUrl.trim()
        : process.env.OPENAI_COMPAT_BASE_URL?.trim() || 'https://api.openai.com/v1';

    let safeBaseUrl: string;
    try {
      safeBaseUrl = validateRemoteHttpsBaseUrl(rawBaseUrl);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Invalid OpenAI-compatible endpoint URL.',
      });
      return;
    }

    const model =
      typeof body.model === 'string' && body.model.trim()
        ? body.model.trim().slice(0, 120)
        : process.env.OPENAI_COMPAT_MODEL?.trim() || 'gpt-4o-mini';

    try {
      const userMessageContent = referenceImage
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

      const upstreamRes = await fetch(`${safeBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature,
          response_format: { type: 'json_object' },
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: userMessageContent },
          ],
        }),
      });

      const payload = (await upstreamRes.json().catch(() => null)) as
        | {
            error?: { message?: string };
            choices?: Array<{ message?: { content?: string } }>;
          }
        | null;

      if (!upstreamRes.ok) {
        const safeStatus =
          upstreamRes.status === 502 || upstreamRes.status === 503 || upstreamRes.status === 504
            ? 500
            : upstreamRes.status;
        res.status(safeStatus).json({
          error:
            payload?.error?.message ||
            `Upstream inference returned status ${upstreamRes.status}.`,
        });
        return;
      }

      const content = payload?.choices?.[0]?.message?.content ?? '';
      const { parsed, jsonText } = parseOrRepairJsonObject(content);
      if (!parsed) {
        res.status(422).json({
          error: 'Inference provider returned invalid or incomplete JSON.',
          rawText: content,
        });
        return;
      }

      res.json({
        provider: 'openaiCompat',
        model,
        data: parsed,
        rawText: jsonText,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OpenAI-compatible request failed.';
      res.status(500).json({ error: msg });
    }
  });

  const httpServer = http.createServer(app);
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Maker studio server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
