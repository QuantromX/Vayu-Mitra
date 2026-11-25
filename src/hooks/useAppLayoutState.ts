import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { loadOnboardingDismissed } from '../components/OnboardingBanner.tsx';
import type { NaqiResult, ScrubbedHourState, ThemeTokens } from '../types/index.ts';
import { useAdvice } from './useAdvice.ts';
import { useAirData } from './useAirData.ts';
import {
  useGlobalShortcuts,
  useLanguageFade,
  usePlanProgress,
  useShareAirCard,
} from './useDashboardController.ts';
import { useResolvedScrubAndTheme, useScrolledCompact } from './useDashboardTheme.ts';
import { useUserProfile } from './useUserProfile.ts';

function useScrubIndex(scrubResetKey: string) {
  const [scrubState, setScrubState] = useState<{ key: string; index: number }>({
    key: scrubResetKey,
    index: 0,
  });
  const scrubIndex = scrubState.key === scrubResetKey ? scrubState.index : 0;

  const setScrubIndex = useCallback(
    (next: number | ((prev: number) => number)) => {
      setScrubState((prev) => {
        const currentIdx = prev.key === scrubResetKey ? prev.index : 0;
        const resolved = typeof next === 'function' ? next(currentIdx) : next;
        return { key: scrubResetKey, index: resolved };
      });
    },
    [scrubResetKey]
  );

  return [scrubIndex, setScrubIndex] as const;
}

function useAutoCollapseOnFirstNaqi(
  naqi: NaqiResult | null,
  setProfileOpen: (open: boolean) => void
): void {
  const hasAutoCollapsedRef = useRef(false);
  useEffect(() => {
    if (naqi && !hasAutoCollapsedRef.current) {
      hasAutoCollapsedRef.current = true;
      setProfileOpen(false);
    }
  }, [naqi, setProfileOpen]);
}

function useUiControlsState(
  totalForwardHours: number,
  setScrubIndex: (next: number | ((prev: number) => number)) => void,
  onRefresh: () => void,
  prefersReducedMotion: boolean
) {
  const [profileOpen, setProfileOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(() =>
    loadOnboardingDismissed()
  );
  const cityInputRef = useRef<HTMLInputElement | null>(null);

  const handleStepHour = useCallback(
    (delta: number) => {
      if (totalForwardHours <= 0) return;
      setScrubIndex((prev) => Math.max(0, Math.min(totalForwardHours - 1, prev + delta)));
    },
    [setScrubIndex, totalForwardHours]
  );

  const focusCitySearch = useCallback(() => {
    setProfileOpen(true);
    window.setTimeout(() => {
      cityInputRef.current?.focus();
      cityInputRef.current?.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'center',
      });
    }, 60);
  }, [prefersReducedMotion]);

  useGlobalShortcuts({
    prefersReducedMotion,
    onFocusCitySearch: focusCitySearch,
    onRefresh,
    onStepHour: handleStepHour,
    onToggleShortcuts: () => setShortcutsOpen((prev) => !prev),
  });

  return {
    profileOpen,
    setProfileOpen,
    detailsOpen,
    setDetailsOpen,
    shortcutsOpen,
    setShortcutsOpen,
    onboardingDismissed,
    setOnboardingDismissed,
    cityInputRef,
    handleStepHour,
  };
}

function useDashboardExtras(params: {
  userState: ReturnType<typeof useUserProfile>;
  naqi: NaqiResult | null;
  scrubbed: ScrubbedHourState | null;
  advice: ReturnType<typeof useAdvice>['advice'];
  theme: ThemeTokens;
  lastUpdated: Date | null;
  prefersReducedMotion: boolean;
}) {
  const { profile } = params.userState;
  const plan = usePlanProgress(profile.city.name, params.advice);
  const lang = useLanguageFade(
    profile.language,
    params.prefersReducedMotion,
    params.userState.setLanguage
  );
  const share = useShareAirCard({
    profile,
    naqi: params.naqi,
    scrubbed: params.scrubbed,
    advice: params.advice,
    theme: params.theme,
    lastUpdated: params.lastUpdated,
  });
  return {
    scrolledCompact: useScrolledCompact(),
    ...plan,
    ...lang,
    ...share,
  };
}

export function useAppDashboard() {
  const userState = useUserProfile();
  const { profile } = userState;
  const airState = useAirData(profile.city);
  const prefersReducedMotion = Boolean(useReducedMotion());
  const [scrubIndex, setScrubIndex] = useScrubIndex(
    `${profile.city.id}:${airState.lastUpdated?.getTime() ?? 0}`
  );
  const totalForwardHours = airState.naqi?.forwardHourly.length ?? 0;
  const ui = useUiControlsState(
    totalForwardHours,
    setScrubIndex,
    () => airState.retry(true),
    prefersReducedMotion
  );
  useAutoCollapseOnFirstNaqi(airState.naqi, ui.setProfileOpen);

  const adviceState = useAdvice({
    profile,
    naqi: airState.naqi,
    weather: airState.weather,
    airLoading: airState.loading,
    isEditingProfile: ui.profileOpen,
  });
  const { scrubbed, theme } = useResolvedScrubAndTheme(
    airState.naqi,
    airState.weather,
    scrubIndex,
    profile.household,
    profile.language
  );
  const extras = useDashboardExtras({
    userState,
    naqi: airState.naqi,
    scrubbed,
    advice: adviceState.advice,
    theme,
    lastUpdated: airState.lastUpdated,
    prefersReducedMotion,
  });

  return {
    userState,
    airState,
    adviceState,
    scrubIndex,
    setScrubIndex,
    totalForwardHours,
    scrubbed,
    theme,
    prefersReducedMotion,
    ...ui,
    ...extras,
  };
}
