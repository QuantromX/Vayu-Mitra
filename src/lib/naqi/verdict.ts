import { formatDayLabel, hasMaskSensitiveGroup } from '../shared/domain.ts';
import type {
  HouseholdGroup,
  Language,
  NaqiCategory,
  VerdictPillLevel,
} from '../../types/index.ts';

export function getVerdictPill(
  category: NaqiCategory,
  household: HouseholdGroup[] = []
): VerdictPillLevel {
  if (category === 'Good' || category === 'Satisfactory') return 'GO';
  if (category === 'Moderate') return hasMaskSensitiveGroup(household) ? 'CAUTION' : 'GO';
  return 'STAY IN';
}

export function getVerdictPillLabel(level: VerdictPillLevel, language: Language): string {
  if (language === 'en') return level;
  const hiMap: Record<VerdictPillLevel, string> = {
    GO: 'बाहर जा सकते हैं',
    CAUTION: 'सावधानी रखें',
    'STAY IN': 'घर में रहें',
  };
  return hiMap[level];
}

export function computeSunArcPosition(hourNumber: number): {
  isDay: boolean;
  sunXPercent: number;
  sunYPercent: number;
} {
  const hr = Math.max(0, Math.min(23, Number.isFinite(hourNumber) ? hourNumber : 12));
  const isDay = hr >= 6 && hr < 18;
  if (isDay) {
    const progress = (hr - 6) / 12;
    return {
      isDay: true,
      sunXPercent: Math.round(14 + progress * 72),
      sunYPercent: Math.round(38 - Math.sin(progress * Math.PI) * 26),
    };
  }
  const nightHour = hr >= 18 ? hr - 18 : hr + 6;
  const progress = nightHour / 11;
  return {
    isDay: false,
    sunXPercent: Math.round(18 + progress * 64),
    sunYPercent: Math.round(34 - Math.sin(progress * Math.PI) * 20),
  };
}

function buildModerateLine(
  household: HouseholdGroup[],
  hi: boolean,
  timeSuffix: string
): string {
  if (household.includes('kids')) {
    return hi
      ? `बच्चे हल्के खेल खेलें; लंबे दौड़-भाग से बचें${timeSuffix}`
      : `Kids: keep outdoor play brief and lighter${timeSuffix}`;
  }
  if (household.includes('asthma_heart') || household.includes('seniors')) {
    return hi
      ? `वरिष्ठ व अस्थमा रोगी बाहरी समय सीमित रखें${timeSuffix}`
      : `Seniors & asthma care: pace outdoor effort${timeSuffix}`;
  }
  return hi
    ? `बाहरी काम कम भीड़भाड़ वाले समय में करें${timeSuffix}`
    : `Prefer lighter outdoor exertion and less-busy streets${timeSuffix}`;
}

function buildPoorLine(
  household: HouseholdGroup[],
  hi: boolean,
  isLive: boolean,
  timeSuffix: string
): string {
  if (household.includes('kids')) {
    return hi
      ? `बच्चे आज घर के अंदर ही खेलें${timeSuffix}`
      : `Kids: play indoors${isLive ? ' today' : timeSuffix}`;
  }
  if (household.includes('asthma_heart')) {
    return hi
      ? `अस्थमा/हृदय रोगी घर के अंदर रहें व रिलीवर पास रखें${timeSuffix}`
      : `Asthma care: stay indoors and keep inhaler handy${timeSuffix}`;
  }
  if (household.includes('seniors')) {
    return hi
      ? `वरिष्ठ नागरिक सैर घर के अंदर रखें${timeSuffix}`
      : `Seniors: stay indoors and skip roadside walks${timeSuffix}`;
  }
  if (household.includes('outdoor_worker')) {
    return hi
      ? `बाहरी काम में हर समय सील वाला N95/FFP2 पहनें${timeSuffix}`
      : `Outdoor work: wear a snug N95/FFP2 continuously${timeSuffix}`;
  }
  return hi
    ? `ग़ैर-ज़रूरी बाहरी काम टालें और N95 पहनें${timeSuffix}`
    : `Skip non-essential outdoor effort; wear N95 outdoors${timeSuffix}`;
}

export function buildVerdictHumanLine(params: {
  category: NaqiCategory;
  household: HouseholdGroup[];
  hourLabel: string;
  dayLabel: 'Today' | 'Tomorrow';
  isLive: boolean;
  language: Language;
}): string {
  const { category, household, hourLabel, dayLabel, isLive, language } = params;
  const hi = language === 'hi';
  const timeSuffix = isLive
    ? ''
    : ` (${formatDayLabel(dayLabel, language)} ${hourLabel})`;

  if (category === 'Good') {
    return hi
      ? `सामान्य और संवेदनशील सभी बाहर समय बिता सकते हैं${timeSuffix}`
      : `Great air for outdoor walks and play${timeSuffix}`;
  }
  if (category === 'Satisfactory') {
    return hi
      ? `बाहरी गतिविधियों के लिए अनुकूल समय; भारी ट्रैफ़िक से दूर रहें${timeSuffix}`
      : `Comfortable for outdoor routines away from busy roads${timeSuffix}`;
  }
  if (category === 'Moderate') {
    return buildModerateLine(household, hi, timeSuffix);
  }
  return buildPoorLine(household, hi, isLive, timeSuffix);
}
