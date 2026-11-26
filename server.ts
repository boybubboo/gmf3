import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

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
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return candidate.slice(firstBrace, lastBrace + 1);
  }
  return candidate;
}

interface AiGenerateBody {
  provider?: unknown;
  model?: unknown;
  systemPrompt?: unknown;
  userPrompt?: unknown;
  temperature?: unknown;
  customBaseUrl?: unknown;
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

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

    if (!userPrompt.trim()) {
      res.status(400).json({ error: 'Prompt text is required.' });
      return;
    }

    if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey) {
        res.status(503).json({
          error:
            'GEMINI_API_KEY is not configured on the server. Add it to your environment or switch to Local AI (Ollama/LM Studio).',
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
        const response = await ai.models.generateContent({
          model,
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt || undefined,
            temperature,
            responseMimeType: 'application/json',
          },
        });
        const rawText = response.text ?? '';
        const jsonText = extractFirstJsonObject(rawText);
        let parsed: unknown = null;
        try {
          parsed = JSON.parse(jsonText);
        } catch {
          res.status(502).json({
            error: 'Gemini returned invalid JSON.',
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
        res.status(502).json({ error: msg });
      }
      return;
    }

    // OpenAI-compatible remote HTTPS inference proxy
    const openAiKey = process.env.OPENAI_COMPAT_API_KEY?.trim();
    if (!openAiKey) {
      res.status(503).json({
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
            { role: 'user', content: userPrompt },
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
        res.status(upstreamRes.status).json({
          error:
            payload?.error?.message ||
            `Upstream inference returned status ${upstreamRes.status}.`,
        });
        return;
      }

      const content = payload?.choices?.[0]?.message?.content ?? '';
      const jsonText = extractFirstJsonObject(content);
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        res.status(502).json({
          error: 'Inference provider returned invalid JSON.',
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
      res.status(502).json({ error: msg });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Maker studio server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
