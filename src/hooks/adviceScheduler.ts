import type React from 'react';
import { buildFallbackAdvice } from '../lib/advice/schema.ts';
import { UI_LIMITS } from '../lib/config.ts';
import type {
  AdviceResponse,
  NaqiResult,
  UserProfile,
  WeatherData,
} from '../types/index.ts';
import {
  buildAdviceRequestPayload,
  postAdviceWithRetry,
  writeCachedAdvice,
} from './adviceHelpers.ts';

export interface AdviceEffectParams {
  cacheKey: string | null;
  airLoading: boolean;
  isEditingProfile: boolean;
  cityId: number;
  retryCount: number;
  latestDataRef: React.RefObject<{
    profile: UserProfile;
    naqi: NaqiResult | null;
    weather: WeatherData | null;
  }>;
  lastFetchedCityIdRef: React.RefObject<number | null>;
  setAdviceState: (state: { cityId: number; data: AdviceResponse | null }) => void;
  setLoading: (val: boolean) => void;
  setError: (msg: string | null) => void;
  setRevealStage: (stage: number) => void;
}

export function computeDebounceMs(
  isCitySwitch: boolean,
  isEditingProfile: boolean
): number {
  if (isCitySwitch) return 0;
  return isEditingProfile
    ? UI_LIMITS.adviceDebounceEditingMs
    : UI_LIMITS.adviceDebounceDefaultMs;
}

export function buildAdviceCacheKey(
  profile: UserProfile,
  naqi: NaqiResult | null,
  weather: WeatherData | null,
  airLoading: boolean
): string | null {
  if (!naqi || !weather || airLoading) return null;
  return JSON.stringify({
    city: profile.city.name,
    lat: profile.city.latitude.toFixed(2),
    aqi: naqi.aqi,
    pm25: naqi.pm25Used,
    cat: naqi.category,
    cleanStart: naqi.cleanestWindow?.startHour ?? '',
    hh: [...profile.household].sort(),
    life: profile.lifestyle,
    purifier: profile.hasPurifier,
    lang: profile.language,
  });
}

async function fetchAndApplyAdvice(params: {
  cacheKey: string;
  snap: { profile: UserProfile; naqi: NaqiResult; weather: WeatherData };
  signal: AbortSignal;
  isActive: () => boolean;
  onSuccess: (cityId: number, data: AdviceResponse) => void;
  onFallback: (cityId: number, data: AdviceResponse, message: string) => void;
  onFinish: () => void;
}): Promise<void> {
  const { cacheKey, snap, signal, isActive, onSuccess, onFallback, onFinish } = params;
  const payload = buildAdviceRequestPayload(snap.profile, snap.naqi, snap.weather);
  try {
    const data = await postAdviceWithRetry(payload, signal);
    if (!isActive()) return;
    writeCachedAdvice(cacheKey, data);
    onSuccess(snap.profile.city.id, data);
  } catch (err) {
    if (!isActive()) return;
    if (err instanceof DOMException && err.name === 'AbortError') return;
    const message =
      err instanceof Error
        ? err.message
        : 'Could not reach guidance service; showing local rule-based guidance.';
    onFallback(snap.profile.city.id, buildFallbackAdvice(payload), message);
  } finally {
    if (isActive()) onFinish();
  }
}

export function scheduleCachedApply(
  cached: AdviceResponse,
  p: AdviceEffectParams
): () => void {
  let active = true;
  const timer = window.setTimeout(() => {
    if (!active) return;
    const nextCityId = p.latestDataRef.current.profile.city.id;
    p.lastFetchedCityIdRef.current = nextCityId;
    p.setAdviceState({ cityId: nextCityId, data: cached });
    p.setLoading(false);
    p.setError(null);
    p.setRevealStage(UI_LIMITS.adviceRevealMaxStage);
  }, 0);
  return () => {
    active = false;
    window.clearTimeout(timer);
  };
}

export function scheduleDebouncedFetch(
  cacheKey: string,
  p: AdviceEffectParams
): () => void {
  const controller = new AbortController();
  let active = true;
  const debounceMs = computeDebounceMs(
    p.lastFetchedCityIdRef.current !== p.cityId,
    p.isEditingProfile
  );
  const timer = window.setTimeout(() => {
    const snap = p.latestDataRef.current;
    if (!snap.naqi || !snap.weather || !active) return;
    p.setLoading(true);
    p.setError(null);
    p.setRevealStage(0);
    void fetchAndApplyAdvice({
      cacheKey,
      snap: { profile: snap.profile, naqi: snap.naqi, weather: snap.weather },
      signal: controller.signal,
      isActive: () => active,
      onSuccess: (nextCityId, data) => {
        p.lastFetchedCityIdRef.current = nextCityId;
        p.setAdviceState({ cityId: nextCityId, data });
      },
      onFallback: (nextCityId, data, msg) => {
        p.lastFetchedCityIdRef.current = nextCityId;
        p.setAdviceState({ cityId: nextCityId, data });
        p.setError(msg);
      },
      onFinish: () => p.setLoading(false),
    });
  }, debounceMs);

  return () => {
    active = false;
    window.clearTimeout(timer);
    controller.abort();
  };
}
