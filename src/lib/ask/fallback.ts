import {
  MEDICAL_DISCLAIMER,
  formatDayLabel,
  hasAnySensitiveGroup,
} from '../shared/domain.ts';
import type {
  AskResponse,
  AskVerdict,
  HouseholdGroup,
  Language,
  NaqiCategory,
  WindowDayLabel,
} from '../../types/index.ts';
import { type FallbackAskInput, selectAskResponseText } from './fallbackAnswers.ts';

export type { FallbackAskInput };

function formatWin(
  win: { dayLabel: WindowDayLabel; startHour: string; endHour: string } | null,
  language: Language
): string | undefined {
  if (!win) return undefined;
  return `${formatDayLabel(win.dayLabel, language)} ${win.startHour}–${win.endHour}`;
}

function resolveBaseVerdict(
  category: NaqiCategory,
  household: HouseholdGroup[],
  qLower: string
): AskVerdict {
  const hasSensitive = hasAnySensitiveGroup(household);
  const isVigorousOrPlay =
    /run|jog|exercise|play|cricket|football|walk|park|outdoor|दौड़|खेल|टहल|सैर/.test(qLower);
  const isVentilation = /window|ventilat|door|fan|खाना|खिड़की|वेंटिलेशन/.test(qLower);

  if (category === 'Severe' || category === 'Very Poor') {
    return isVigorousOrPlay ? 'no' : 'caution';
  }
  if (category === 'Poor') {
    return isVigorousOrPlay && hasSensitive ? 'no' : 'caution';
  }
  if (category === 'Moderate') {
    if (isVentilation) return 'caution';
    return hasSensitive && isVigorousOrPlay ? 'caution' : 'yes';
  }
  return 'yes';
}

/**
 * Produces a deterministic, strictly grounded answer for Ask VayuMitra whenever
 * Gemini is unavailable, rate-limited, or unconfigured.
 */
export function buildFallbackAskAnswer(input: FallbackAskInput): AskResponse {
  const bestTime = formatWin(input.cleanestWindow, input.language);
  const worstTime = formatWin(input.worstWindow, input.language);
  const verdict = resolveBaseVerdict(
    input.category,
    input.household,
    input.question.toLowerCase()
  );
  const { answer, why } = selectAskResponseText(input, verdict, bestTime, worstTime);

  const dataUsed = [
    `NAQI ${input.aqi} (${input.category})`,
    `PM2.5 ${input.pm25} µg/m³`,
    `PM10 ${input.pm10} µg/m³`,
    `${input.temperatureC}°C · Wind ${input.windSpeedKmh} km/h`,
  ];
  if (bestTime) {
    dataUsed.push(
      input.category === 'Good' ? `Cleanest ${bestTime}` : `Lowest-AQI ${bestTime}`
    );
  }

  return {
    answer,
    verdict,
    why,
    ...(bestTime ? { bestTime } : {}),
    dataUsed,
    disclaimer: MEDICAL_DISCLAIMER[input.language],
    source: 'fallback',
  };
}
