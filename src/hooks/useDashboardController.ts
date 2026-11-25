import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildPlanStorageKey,
  collectPlanActionIds,
  computePlanProgress,
  loadCompletedActions,
  saveCompletedActions,
  toggleActionDone,
  triggerHapticTap,
} from '../lib/advice/progress.ts';
import { CATEGORY_HINDI } from '../lib/shared/domain.ts';
import type {
  AdviceResponse,
  Language,
  NaqiResult,
  ScrubbedHourState,
  ThemeTokens,
  UserProfile,
} from '../types/index.ts';

export function usePlanProgress(cityName: string, advice: AdviceResponse | null) {
  const planStorageKey = useMemo(() => buildPlanStorageKey(cityName), [cityName]);
  const [completedState, setCompletedState] = useState<{ key: string; ids: string[] }>(
    () => ({
      key: planStorageKey,
      ids: loadCompletedActions(planStorageKey),
    })
  );

  const completedIds = useMemo(
    () =>
      completedState.key === planStorageKey
        ? completedState.ids
        : loadCompletedActions(planStorageKey),
    [completedState, planStorageKey]
  );

  const handleToggleDone = useCallback(
    (actionId: string) => {
      setCompletedState((prev) => {
        const baseIds =
          prev.key === planStorageKey ? prev.ids : loadCompletedActions(planStorageKey);
        const next = toggleActionDone(baseIds, actionId);
        saveCompletedActions(planStorageKey, next);
        return { key: planStorageKey, ids: next };
      });
    },
    [planStorageKey]
  );

  const allActionIds = useMemo(() => collectPlanActionIds(advice), [advice]);
  const planProgress = useMemo(
    () => computePlanProgress(allActionIds, completedIds),
    [allActionIds, completedIds]
  );

  return { completedIds, planProgress, handleToggleDone };
}

function isEditableTarget(target: HTMLElement | null): boolean {
  if (!target) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

export function useGlobalShortcuts(params: {
  prefersReducedMotion: boolean;
  onFocusCitySearch: () => void;
  onRefresh: () => void;
  onStepHour: (delta: number) => void;
  onToggleShortcuts: () => void;
}) {
  const {
    prefersReducedMotion,
    onFocusCitySearch,
    onRefresh,
    onStepHour,
    onToggleShortcuts,
  } = params;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (isEditableTarget(target) || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        onFocusCitySearch();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        onRefresh();
      } else if (e.key === '[') {
        e.preventDefault();
        onStepHour(-1);
      } else if (e.key === ']') {
        e.preventDefault();
        onStepHour(1);
      } else if (e.key === '?') {
        e.preventDefault();
        onToggleShortcuts();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [prefersReducedMotion, onFocusCitySearch, onRefresh, onStepHour, onToggleShortcuts]);
}

function formatShareNotice(result: 'shared' | 'downloaded', hi: boolean): string {
  if (result === 'shared') return hi ? 'एयर कार्ड साझा किया गया' : 'Air Card shared';
  return hi ? 'एयर कार्ड PNG डाउनलोड हो गया' : 'Air Card PNG downloaded';
}

function formatShareUpdated(lastUpdated: Date | null, hi: boolean): string {
  if (!lastUpdated) return hi ? 'लाइव' : 'Live';
  const time = lastUpdated.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
  return `${time} IST`;
}

export function useShareAirCard(params: {
  profile: UserProfile;
  naqi: NaqiResult | null;
  scrubbed: ScrubbedHourState | null;
  advice: AdviceResponse | null;
  theme: ThemeTokens;
  lastUpdated: Date | null;
}) {
  const { profile, naqi, scrubbed, advice, theme, lastUpdated } = params;
  const [sharing, setSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const hi = profile.language === 'hi';

  const handleShareCard = useCallback(async () => {
    if (!naqi || !scrubbed || sharing) return;
    setSharing(true);
    setShareNotice(null);
    triggerHapticTap(10);
    try {
      const { buildShareCardSpec, shareOrDownloadAirCard } =
        await import('../lib/share/shareCard.ts');
      const categoryLabel = hi ? CATEGORY_HINDI[scrubbed.category] : scrubbed.category;
      const spec = buildShareCardSpec({
        cityName: profile.city.name,
        admin1: profile.city.admin1,
        aqi: scrubbed.aqi,
        categoryLabel,
        verdictLabel: scrubbed.verdictLabel,
        verdictHeadline: advice?.verdict.headline ?? scrubbed.verdictLine,
        advice,
        theme,
        updatedLabel: formatShareUpdated(lastUpdated, hi),
        language: profile.language,
      });
      const result = await shareOrDownloadAirCard(spec);
      setShareNotice(formatShareNotice(result, hi));
    } catch {
      setShareNotice(hi ? 'एयर कार्ड नहीं बन सका' : 'Could not render Air Card');
    } finally {
      window.setTimeout(() => setShareNotice(null), 3500);
      setSharing(false);
    }
  }, [advice, hi, lastUpdated, naqi, profile, scrubbed, sharing, theme]);

  return { sharing, shareNotice, handleShareCard };
}

export function useLanguageFade(
  language: Language,
  prefersReducedMotion: boolean,
  setLanguage: (lang: Language) => void
) {
  const [langFading, setLangFading] = useState(false);

  const handleLanguageChange = useCallback(
    (nextLang: Language) => {
      if (nextLang === language) return;
      triggerHapticTap(8);
      if (prefersReducedMotion) {
        setLanguage(nextLang);
        return;
      }
      setLangFading(true);
      window.setTimeout(() => {
        setLanguage(nextLang);
        setLangFading(false);
      }, 110);
    },
    [language, prefersReducedMotion, setLanguage]
  );

  return { langFading, handleLanguageChange };
}
