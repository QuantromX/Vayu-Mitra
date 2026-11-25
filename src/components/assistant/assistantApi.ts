import { APP_CONFIG } from '../../lib/config.ts';
import type {
  AskResponse,
  NaqiResult,
  PhotoCheckResponse,
  PhotoSceneHint,
  UserProfile,
  WeatherData,
} from '../../types/index.ts';
import type { StrippedPhotoPayload } from '../../lib/vision/exifStrip.ts';

function serializeAskWindow(win: NaqiResult['cleanestWindow']) {
  if (!win) return null;
  return {
    startHour: win.startHour,
    endHour: win.endHour,
    dayLabel: win.dayLabel,
    avgNaqi: win.avgNaqi,
    avgPm25: win.avgPm25,
  };
}

function buildAskRequestBody(
  question: string,
  profile: UserProfile,
  naqi: NaqiResult,
  weather: WeatherData
): string {
  return JSON.stringify({
    question,
    cityName: profile.city.name,
    latitude: profile.city.latitude,
    longitude: profile.city.longitude,
    aqi: naqi.aqi,
    category: naqi.category,
    dominantPollutant: naqi.dominantPollutant,
    pm25: naqi.pm25Used,
    pm10: naqi.pm10Used,
    temperatureC: weather.temperatureC,
    humidityPct: weather.humidityPct,
    windSpeedKmh: weather.windSpeedKmh,
    cleanestWindow: serializeAskWindow(naqi.cleanestWindow),
    worstWindow: serializeAskWindow(naqi.worstWindow),
    forwardHourly: naqi.forwardHourly.slice(0, 12).map((pt) => ({
      dayLabel: pt.dayLabel,
      hourLabel: pt.hourLabel,
      naqi: pt.naqi,
      pm2_5: pt.pm2_5,
    })),
    household: profile.household,
    lifestyle: profile.lifestyle,
    hasPurifier: profile.hasPurifier,
    language: profile.language,
  });
}

async function fetchAskOnce(
  payloadBody: string,
  hi: boolean
): Promise<{
  status: number;
  data?: AskResponse;
  errorMsg?: string;
}> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 18_000);
  try {
    const response = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payloadBody,
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      const fallbackMsg = hi
        ? `सवाल का उत्तर नहीं मिल सका (HTTP ${response.status})`
        : `Could not answer question (HTTP ${response.status})`;
      return { status: response.status, errorMsg: body.error || fallbackMsg };
    }
    const data = (await response.json()) as AskResponse;
    return { status: response.status, data };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        hi
          ? 'उत्तर मिलने में अधिक समय लगा — कृपया पुनः प्रयास करें।'
          : 'Request timed out — please retry.',
        { cause: err }
      );
    }
    throw err instanceof Error
      ? err
      : new Error(hi ? 'उत्तर लाने में समस्या हुई।' : 'Unable to fetch grounded answer.', {
          cause: err,
        });
  } finally {
    window.clearTimeout(timer);
  }
}

export async function postAskQuestion(params: {
  question: string;
  profile: UserProfile;
  naqi: NaqiResult;
  weather: WeatherData;
}): Promise<AskResponse> {
  const hi = params.profile.language === 'hi';
  const payloadBody = buildAskRequestBody(
    params.question,
    params.profile,
    params.naqi,
    params.weather
  );

  let lastErr: Error = new Error(
    hi ? 'उत्तर लाने में समस्या हुई।' : 'Unable to fetch grounded answer.'
  );

  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const outcome = await fetchAskOnce(payloadBody, hi);
      if (outcome.data) return outcome.data;

      lastErr = new Error(outcome.errorMsg);
      if (outcome.status >= 400 && outcome.status < 500) throw lastErr;
      if (attempt === 1) throw lastErr;
    } catch (err) {
      lastErr = err instanceof Error ? err : lastErr;
      if (attempt === 1) throw lastErr;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 350));
  }

  throw lastErr;
}

export async function postPhotoCheckApi(params: {
  stripped: StrippedPhotoPayload;
  sceneHint: PhotoSceneHint;
  naqi: NaqiResult | null;
  hasPurifier: boolean;
  language: UserProfile['language'];
}): Promise<PhotoCheckResponse> {
  const hi = params.language === 'hi';
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), APP_CONFIG.geminiTimeoutMs);

  try {
    const response = await fetch('/api/photo-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        mimeType: params.stripped.mimeType,
        imageBase64: params.stripped.imageBase64,
        sceneHint: params.sceneHint,
        aqi: params.naqi?.aqi,
        category: params.naqi?.category,
        hasPurifier: params.hasPurifier,
        language: params.language,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      const fallback = hi
        ? `फ़ोटो जांच विफल (HTTP ${response.status})`
        : `Photo check failed (HTTP ${response.status})`;
      throw new Error(body.error || fallback);
    }

    return (await response.json()) as PhotoCheckResponse;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        hi
          ? 'फ़ोटो जांच में समय सीमा समाप्त हो गई — कृपया पुनः प्रयास करें।'
          : 'Photo inspection timed out — please retry.',
        { cause: err }
      );
    }
    throw err instanceof Error
      ? err
      : new Error(
          hi ? 'फ़ोटो विश्लेषण पूरा नहीं हो सका।' : 'Could not complete photo check.',
          {
            cause: err,
          }
        );
  } finally {
    window.clearTimeout(timer);
  }
}
