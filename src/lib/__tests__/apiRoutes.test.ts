import type { AddressInfo } from 'node:net';
import type http from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createExpressApp, type GeminiLikeClient } from '../../../server.ts';

async function startTestServer(aiClient: GeminiLikeClient | null, rateLimitMax = 10) {
  const app = await createExpressApp({
    aiClient,
    attachVite: false,
    rateLimitMax,
    isProd: true,
  });

  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  return { server, baseUrl };
}

const VALID_ADVICE_BODY = {
  cityName: 'Delhi',
  aqi: 245,
  category: 'Poor',
  dominantPollutant: 'PM2.5',
  pm25: 102,
  pm10: 165,
  basis: 'rolling_24h',
  temperatureC: 24,
  humidityPct: 58,
  windSpeedKmh: 7,
  cleanestWindow: {
    startHour: '14:00',
    endHour: '17:00',
    dayLabel: 'Today',
    endDayLabel: 'Today',
    avgNaqi: 180,
    avgPm25: 84,
  },
  worstWindow: {
    startHour: '21:00',
    endHour: '00:00',
    dayLabel: 'Today',
    endDayLabel: 'Today',
    avgNaqi: 305,
    avgPm25: 130,
  },
  household: ['kids'],
  lifestyle: 'commute_metro',
  hasPurifier: true,
  language: 'en',
};

const VALID_ASK_BODY = {
  question: 'Can kids play cricket outside after 4 PM?',
  cityName: 'Delhi',
  aqi: 245,
  category: 'Poor',
  dominantPollutant: 'PM2.5',
  pm25: 102,
  pm10: 165,
  temperatureC: 24,
  humidityPct: 58,
  windSpeedKmh: 7,
  cleanestWindow: {
    startHour: '14:00',
    endHour: '17:00',
    dayLabel: 'Today',
    avgNaqi: 180,
    avgPm25: 84,
  },
  worstWindow: null,
  forwardHourly: [],
  household: ['kids'],
  lifestyle: 'commute_metro',
  hasPurifier: true,
  language: 'en',
};

const VALID_PHOTO_BODY = {
  mimeType: 'image/jpeg',
  imageBase64: 'A'.repeat(64),
  sceneHint: 'room',
  aqi: 245,
  category: 'Poor',
  hasPurifier: true,
  language: 'en',
};

describe('Express /api Routes, Security Headers & Rate Limiting', () => {
  let okServer: http.Server;
  let okBaseUrl: string;

  beforeAll(async () => {
    const mockAi: GeminiLikeClient = {
      models: {
        generateContent: vi.fn(async ({ config }) => {
          const schema = (config as { responseSchema?: { required?: string[] } })
            ?.responseSchema;
          const required = schema?.required ?? [];
          if (required.includes('verdict') && required.includes('outdoor')) {
            return {
              text: JSON.stringify({
                verdict: {
                  level: 'Poor',
                  headline: 'Keep outdoor play brief; prefer Today 14:00–17:00',
                  summary: 'PM2.5 is 102 µg/m³ right now across Delhi.',
                },
                outdoor: [
                  {
                    action: 'Limit outdoor play to Today 14:00–17:00.',
                    why: 'Afternoon mixing yields the lowest NAQI ~180 ahead.',
                    timeWindow: 'Today 14:00–17:00',
                  },
                ],
                indoor: [
                  {
                    action: 'Run HEPA purifier on high during Today 21:00–00:00 and damp-mop.',
                    why: 'Peak haze raises indoor PM2.5 infiltration.',
                  },
                ],
                routine: [
                  {
                    action: 'Take the metro and batch errands.',
                    why: 'Cuts roadside exposure and tailpipe emissions.',
                    co2Benefit: 'Approx. 1.4 kg CO₂ saved (assumes 10 km car vs metro)',
                  },
                ],
                mask: {
                  recommended: true,
                  type: 'N95 / FFP2',
                  why: 'Poor category recommends N95 outdoors for everyone.',
                },
                forWhom: [
                  {
                    group: 'Children',
                    advice: 'Keep intense evening sports indoors today.',
                  },
                ],
              }),
            };
          }

          if (required.includes('dataUsed')) {
            return {
              text: JSON.stringify({
                answer: 'No — keep intense cricket indoors after 4 PM today.',
                verdict: 'no',
                why: 'NAQI is 245 (Poor) with PM2.5 at 102 µg/m³.',
                bestTime: 'Today 14:00–17:00',
                dataUsed: ['NAQI 245 (Poor)', 'PM2.5 102 µg/m³'],
              }),
            };
          }

          return {
            text: JSON.stringify({
              observations: ['Balcony sliding door gap lets roadside dust enter.'],
              purifierPlacement: 'Place the HEPA unit 1.5 m from the bed with clear vents.',
              ventilationTip: 'Keep balcony doors shut until Today 14:00–17:00.',
              confidence: 'medium',
              disclaimer: 'Visual advisory estimate only, not a PM2.5 measurement.',
            }),
          };
        }),
      },
    };

    const started = await startTestServer(mockAi, 10);
    okServer = started.server;
    okBaseUrl = started.baseUrl;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => okServer.close(() => resolve()));
  });

  it('sets strict security headers and serves /api/health', async () => {
    const res = await fetch(`${okBaseUrl}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get('x-powered-by')).toBeNull();
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('permissions-policy')).toContain('camera=()');
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("object-src 'none'");
  });

  it('handles /api/advice, /api/ask, and /api/photo-check success & 400 validation errors', async () => {
    const advOk = await fetch(`${okBaseUrl}/api/advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_ADVICE_BODY),
    });
    expect(advOk.status).toBe(200);
    expect(((await advOk.json()) as { source: string }).source).toBe('gemini');

    const advBad = await fetch(`${okBaseUrl}/api/advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_ADVICE_BODY, cityName: '<script>' }),
    });
    expect(advBad.status).toBe(400);

    const askOk = await fetch(`${okBaseUrl}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_ASK_BODY),
    });
    expect(askOk.status).toBe(200);
    const askJson = (await askOk.json()) as { source: string; verdict: string };
    expect(askJson.source).toBe('gemini');
    expect(askJson.verdict).toBe('no');

    const askBad = await fetch(`${okBaseUrl}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_ASK_BODY, question: 'x' }),
    });
    expect(askBad.status).toBe(400);

    const photoOk = await fetch(`${okBaseUrl}/api/photo-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_PHOTO_BODY),
    });
    expect(photoOk.status).toBe(200);
    const photoJson = (await photoOk.json()) as {
      source: string;
      confidence: string;
    };
    expect(photoJson.source).toBe('gemini');
    expect(photoJson.confidence).toBe('medium');

    const photoBad = await fetch(`${okBaseUrl}/api/photo-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_PHOTO_BODY, mimeType: 'image/gif' }),
    });
    expect(photoBad.status).toBe(400);
  });

  it('falls back cleanly on Gemini upstream failure and enforces 429 per-route rate limit', async () => {
    const failingAi: GeminiLikeClient = {
      models: {
        generateContent: vi.fn(async () => {
          throw new Error('Upstream 503 unavailable');
        }),
      },
    };
    const { server, baseUrl } = await startTestServer(failingAi, 2);
    try {
      // Advice fallback (1st & 2nd pass) + rate limit hit (3rd)
      const a1 = await fetch(`${baseUrl}/api/advice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_ADVICE_BODY),
      });
      expect(a1.status).toBe(200);
      expect(((await a1.json()) as { source: string }).source).toBe('fallback');

      const a2 = await fetch(`${baseUrl}/api/advice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...VALID_ADVICE_BODY, cityName: 'Lucknow' }),
      });
      expect(a2.status).toBe(200);

      const a3 = await fetch(`${baseUrl}/api/advice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...VALID_ADVICE_BODY, cityName: 'Patna' }),
      });
      expect(a3.status).toBe(429);
      expect(a3.headers.get('retry-after')).toBeTruthy();

      // Ask fallback + rate limit hit
      const q1 = await fetch(`${baseUrl}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_ASK_BODY),
      });
      expect(q1.status).toBe(200);
      expect(((await q1.json()) as { source: string }).source).toBe('fallback');

      await fetch(`${baseUrl}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...VALID_ASK_BODY,
          question: 'Should I wear N95 today?',
        }),
      });
      const q3 = await fetch(`${baseUrl}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_ASK_BODY),
      });
      expect(q3.status).toBe(429);

      // Photo check fallback + rate limit hit
      const p1 = await fetch(`${baseUrl}/api/photo-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_PHOTO_BODY),
      });
      expect(p1.status).toBe(200);
      expect(((await p1.json()) as { source: string }).source).toBe('fallback');

      await fetch(`${baseUrl}/api/photo-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_PHOTO_BODY),
      });
      const p3 = await fetch(`${baseUrl}/api/photo-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_PHOTO_BODY),
      });
      expect(p3.status).toBe(429);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
