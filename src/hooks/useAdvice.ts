import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UI_LIMITS } from '../lib/config.ts';
import type {
  AdviceResponse,
  NaqiResult,
  UserProfile,
  WeatherData,
} from '../types/index.ts';
import { deleteCachedAdvice, readCachedAdvice } from './adviceHelpers.ts';
import {
  type AdviceEffectParams,
  buildAdviceCacheKey,
  scheduleCachedApply,
  scheduleDebouncedFetch,
} from './adviceScheduler.ts';

function useStaggeredReveal(advice: AdviceResponse | null, loading: boolean) {
  const [revealStage, setRevealStage] = useState<number>(0);

  useEffect(() => {
    if (!advice || loading || revealStage >= UI_LIMITS.adviceRevealMaxStage) return;
    const timer = window.setTimeout(
      () => setRevealStage((s) => Math.min(UI_LIMITS.adviceRevealMaxStage, s + 1)),
      UI_LIMITS.adviceRevealIntervalMs
    );
    return () => window.clearTimeout(timer);
  }, [advice, loading, revealStage]);

  return [revealStage, setRevealStage] as const;
}

function useAdviceFetchEffect(p: AdviceEffectParams) {
  const {
    cacheKey,
    airLoading,
    isEditingProfile,
    cityId,
    retryCount,
    latestDataRef,
    lastFetchedCityIdRef,
    setAdviceState,
    setLoading,
    setError,
    setRevealStage,
  } = p;

  useEffect(() => {
    if (!cacheKey || airLoading) return;
    const paramsObj: AdviceEffectParams = {
      cacheKey,
      airLoading,
      isEditingProfile,
      cityId,
      retryCount,
      latestDataRef,
      lastFetchedCityIdRef,
      setAdviceState,
      setLoading,
      setError,
      setRevealStage,
    };
    const cached = readCachedAdvice(cacheKey);
    if (cached) return scheduleCachedApply(cached, paramsObj);
    return scheduleDebouncedFetch(cacheKey, paramsObj);
  }, [
    cacheKey,
    airLoading,
    isEditingProfile,
    cityId,
    retryCount,
    latestDataRef,
    lastFetchedCityIdRef,
    setAdviceState,
    setLoading,
    setError,
    setRevealStage,
  ]);
}

export function useAdvice(params: {
  profile: UserProfile;
  naqi: NaqiResult | null;
  weather: WeatherData | null;
  airLoading?: boolean;
  isEditingProfile?: boolean;
}) {
  const { profile, naqi, weather, airLoading = false, isEditingProfile = false } = params;
  const [adviceState, setAdviceState] = useState<{
    cityId: number;
    data: AdviceResponse | null;
  }>({
    cityId: profile.city.id,
    data: null,
  });
  const advice = adviceState.cityId === profile.city.id ? adviceState.data : null;
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [revealStage, setRevealStage] = useStaggeredReveal(advice, loading);
  const [retryCount, setRetryCount] = useState<number>(0);
  const lastFetchedCityIdRef = useRef<number | null>(null);

  const cacheKey = useMemo(
    () => buildAdviceCacheKey(profile, naqi, weather, airLoading),
    [profile, naqi, weather, airLoading]
  );

  const latestDataRef = useRef({ profile, naqi, weather });
  useEffect(() => {
    latestDataRef.current = { profile, naqi, weather };
  }, [profile, naqi, weather]);

  const retryAdvice = useCallback(() => {
    if (cacheKey) deleteCachedAdvice(cacheKey);
    setRetryCount((c) => c + 1);
  }, [cacheKey]);

  useAdviceFetchEffect({
    cacheKey,
    airLoading,
    isEditingProfile,
    cityId: profile.city.id,
    retryCount,
    latestDataRef,
    lastFetchedCityIdRef,
    setAdviceState,
    setLoading,
    setError,
    setRevealStage,
  });

  return { advice, loading, error, revealStage, retryAdvice };
}
