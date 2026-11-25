import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { APP_CONFIG, GEMINI_CONFIG } from '../src/lib/config.ts';
import { ConfigError } from '../src/lib/errors.ts';
import { logStructured } from './logger.ts';
import type { RateRouteKey } from './rateLimiter.ts';

/**
 * Minimal structural interface for the Google GenAI client (enables unit/API testing without network calls).
 */
export interface GeminiLikeClient {
  models: {
    generateContent: (
      params: Parameters<GoogleGenAI['models']['generateContent']>[0]
    ) => Promise<{ text?: string }>;
  };
}

export interface StructuredGeminiParams<T> {
  contents: Parameters<GoogleGenAI['models']['generateContent']>[0]['contents'];
  systemInstruction: string;
  responseSchema: Record<string, unknown>;
  parse: (raw: unknown) => { success: true; data: T } | { success: false };
  route: RateRouteKey;
  correlationId: string;
}

export type CallStructuredGemini = <T>(
  params: StructuredGeminiParams<T>
) => Promise<T | null>;

/**
 * Validates that GEMINI_API_KEY is configured in server environment variables, failing fast otherwise.
 */
export function requireGeminiApiKey(env: NodeJS.ProcessEnv = process.env): string {
  const geminiKey = env.GEMINI_API_KEY?.trim();
  if (!geminiKey || geminiKey === 'MY_GEMINI_API_KEY') {
    throw new ConfigError(
      'Missing GEMINI_API_KEY environment variable. Configure GEMINI_API_KEY in server environment or .env before starting VayuMitra.'
    );
  }
  return geminiKey;
}

/**
 * Instantiates the default server-side Google GenAI client using the validated key.
 */
export function createDefaultAiClient(): GeminiLikeClient {
  const geminiKey = requireGeminiApiKey();
  return new GoogleGenAI({
    apiKey: geminiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Runs an async operation bounded by an AbortController timeout.
 */
export function withAbortTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Gemini request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    run(controller.signal)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function readErrorStatusAndMsg(err: unknown): { status: number; msg: string } {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status?: unknown }).status)
      : NaN;
  return { status, msg };
}

function isQuotaError(msg: string, status: number): boolean {
  return (
    status === 429 ||
    msg.includes('"code":429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    /quota exceeded|rate[- ]limit/i.test(msg)
  );
}

function isAuthError(msg: string, status: number): boolean {
  return (
    status === 401 ||
    status === 403 ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('API_KEY_INVALID')
  );
}

function isUnavailableError(msg: string, status: number): boolean {
  return (
    status === 503 ||
    msg.includes('"code":503') ||
    msg.includes('"status":"UNAVAILABLE"') ||
    /unavailable|high demand|overloaded/i.test(msg)
  );
}

/**
 * Classifies Gemini upstream errors into quota cooldown or authentication failure states.
 */
export function parseQuotaCooldownMs(err: unknown): {
  isQuota: boolean;
  isAuth: boolean;
  cooldownMs: number;
} {
  const { status, msg } = readErrorStatusAndMsg(err);
  if (!isQuotaError(msg, status)) {
    return { isQuota: false, isAuth: isAuthError(msg, status), cooldownMs: 0 };
  }

  const retryMatch = msg.match(/"retryDelay"\s*:\s*"(\d+)s"/);
  const retrySec = retryMatch ? Number(retryMatch[1]) : 900;
  const cooldownMs = Math.min(30 * 60_000, Math.max(60_000, retrySec * 1000));
  return { isQuota: true, isAuth: false, cooldownMs };
}

async function runSingleAttempt<T>(
  aiClient: GeminiLikeClient,
  model: string,
  params: StructuredGeminiParams<T>
): Promise<{ data: T | null; reason: string }> {
  const response = await withAbortTimeout(
    (abortSignal) =>
      aiClient.models.generateContent({
        model,
        contents: params.contents,
        config: {
          abortSignal,
          systemInstruction: params.systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: params.responseSchema,
          ...(model === 'gemini-4-hydrogen'
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, seed: 42 }
            : { seed: 42 }),
        },
      }),
    APP_CONFIG.geminiTimeoutMs
  );

  const rawText = (response.text ?? '').trim();
  if (!rawText) return { data: null, reason: 'empty_response' };

  const validated = params.parse(JSON.parse(rawText));
  return validated.success
    ? { data: validated.data, reason: '' }
    : { data: null, reason: 'schema_mismatch' };
}

async function runModelWithRetry<T>(
  aiClient: GeminiLikeClient,
  model: string,
  params: StructuredGeminiParams<T>,
  modelCooldownUntil: Map<string, number>
): Promise<{ data: T | null; abortAll: boolean; reason: string }> {
  let reason = 'upstream_rejection';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const outcome = await runSingleAttempt(aiClient, model, params);
      if (outcome.data !== null)
        return { data: outcome.data, abortAll: false, reason: '' };
      reason = outcome.reason;
    } catch (err) {
      const { isQuota, isAuth, cooldownMs } = parseQuotaCooldownMs(err);
      if (isQuota) {
        const duration = cooldownMs || GEMINI_CONFIG.quotaCooldownMs;
        modelCooldownUntil.set(model, Date.now() + duration);
        logStructured('warn', 'gemini_quota_cooldown', {
          correlationId: params.correlationId,
          route: params.route,
          model,
          cooldownMinutes: Math.round(duration / 60_000),
        });
        return { data: null, abortAll: false, reason: 'quota_cooldown' };
      }
      if (isAuth) {
        modelCooldownUntil.set(model, Date.now() + GEMINI_CONFIG.quotaCooldownMs);
        logStructured('warn', 'gemini_auth_fallback', {
          correlationId: params.correlationId,
          route: params.route,
          model,
        });
        return { data: null, abortAll: true, reason: 'auth_fallback' };
      }
      const { status, msg } = readErrorStatusAndMsg(err);
      if (isUnavailableError(msg, status)) {
        if (attempt === 0 && !process.env.VITEST) {
          await new Promise((resolve) => setTimeout(resolve, 350));
          continue;
        }
        modelCooldownUntil.set(model, Date.now() + 2 * 60_000);
        reason = 'upstream_unavailable';
      } else {
        reason = 'upstream_rejection';
      }
    }
  }
  return { data: null, abortAll: false, reason };
}

/**
 * Creates a Gemini structured-output caller owning model cooldown state, retries, and fallback.
 */
export function createGeminiCaller(
  aiClient: GeminiLikeClient | null
): CallStructuredGemini {
  const modelCooldownUntil = new Map<string, number>();

  return async function callStructuredGemini<T>(
    params: StructuredGeminiParams<T>
  ): Promise<T | null> {
    if (!aiClient) return null;

    const now = Date.now();
    let lastReason = 'models_cooling_down';

    for (const model of GEMINI_CONFIG.models) {
      if ((modelCooldownUntil.get(model) ?? 0) > now) continue;

      const result = await runModelWithRetry(aiClient, model, params, modelCooldownUntil);
      if (result.data !== null) return result.data;
      if (result.abortAll) return null;
      lastReason = result.reason;
    }

    logStructured('info', 'gemini_fallback_used', {
      correlationId: params.correlationId,
      route: params.route,
      reason: lastReason,
    });
    return null;
  };
}
