import { evaluateMaskRule } from '../naqi/naqi.ts';
import { CATEGORY_HINDI } from '../shared/domain.ts';
import type {
  AdviceActionItem,
  AdviceResponse,
  HourWindow,
  HouseholdGroup,
  Language,
  LifestyleMode,
  NaqiCategory,
} from '../../types/index.ts';

export interface FallbackAdviceInput {
  cityName: string;
  aqi: number;
  category: NaqiCategory;
  dominantPollutant: 'PM2.5' | 'PM10';
  pm25: number;
  pm10: number;
  windSpeedKmh: number;
  cleanestWindow: Pick<
    HourWindow,
    'startHour' | 'endHour' | 'dayLabel' | 'avgNaqi'
  > | null;
  worstWindow: Pick<HourWindow, 'startHour' | 'endHour' | 'dayLabel' | 'avgNaqi'> | null;
  household: HouseholdGroup[];
  lifestyle: LifestyleMode;
  hasPurifier: boolean;
  language: Language;
}

export function buildMaskGuidance(
  input: FallbackAdviceInput,
  hi: boolean
): AdviceResponse['mask'] {
  const maskRule = evaluateMaskRule(input.category, input.household);
  const categoryDisplay = hi ? CATEGORY_HINDI[input.category] : input.category;
  let why: string;

  if (maskRule.scope === 'optional') {
    why = hi
      ? `वायु सूचकांक ${input.aqi} (${categoryDisplay}) होने से सामान्य लोगों के लिए मास्क वैकल्पिक है; फिर भी धूल भरी सड़क पर संवेदनशील लोग N95/FFP2 रख सकते हैं।`
      : `At NAQI ${input.aqi} (${input.category}), masks are optional for most people; sensitive individuals may still carry one along dusty roads.`;
  } else if (maskRule.scope === 'sensitive_only') {
    why = hi
      ? `मध्यम श्रेणी (सूचकांक ${input.aqi}) में बच्चों, वरिष्ठ नागरिकों, अस्थमा/हृदय रोगियों और बाहरी कामगारों के लिए अच्छी तरह फिट N95/FFP2 मास्क जरूरी है, जबकि स्वस्थ वयस्कों के लिए वैकल्पिक है।`
      : `In Moderate air (NAQI ${input.aqi}), a snug N95/FFP2 mask is recommended for children, seniors, asthma/heart patients, and outdoor workers, and optional for healthy adults.`;
  } else {
    why = hi
      ? `खराब या अधिक स्तर (सूचकांक ${input.aqi}) पर बाहर निकलने वाले हर व्यक्ति को सील वाला N95/FFP2 मास्क पहनना चाहिए, क्योंकि कपड़े के मास्क PM2.5 (${input.pm25} µg/m³) को नहीं रोकते।`
      : `At Poor or worse levels (NAQI ${input.aqi}), everyone stepping outdoors needs a well-fitted N95/FFP2 respirator because cloth and surgical masks fail to seal against fine PM2.5 (${input.pm25} µg/m³).`;
  }

  return { recommended: maskRule.recommended, type: maskRule.type, why };
}

function mapKidsAdvice(cleanWindowLabel: string, isPoorOrWorse: boolean, hi: boolean) {
  let advice: string;
  if (isPoorOrWorse) {
    advice = hi
      ? `स्कूल के बाद का खेल घर के अंदर रखें और पानी नियमित पिलाएँ; केवल ज़रूरी होने पर ${cleanWindowLabel} में बाहर जाएँ।`
      : `Keep after-school play indoors today, hydrate steadily, and restrict essential outdoor trips to ${cleanWindowLabel}.`;
  } else {
    advice = hi
      ? `पार्क या बाहरी खेल ${cleanWindowLabel} में सीमित रखें।`
      : `Time park play during ${cleanWindowLabel}.`;
  }
  return { group: hi ? 'बच्चे' : 'Children', advice };
}

function buildHouseholdGroupAdvice(
  cleanWindowLabel: string,
  worstWindowLabel: string,
  isPoorOrWorse: boolean,
  hi: boolean
): Record<HouseholdGroup, { group: string; advice: string }> {
  return {
    kids: mapKidsAdvice(cleanWindowLabel, isPoorOrWorse, hi),
    seniors: {
      group: hi ? 'वरिष्ठ नागरिक' : 'Seniors',
      advice: hi
        ? `${worstWindowLabel} में बाहरी सैर टालें; हल्की गतिविधि ${cleanWindowLabel} में या घर के अंदर करें।`
        : `Skip walks during ${worstWindowLabel}; prefer gentle indoor movement or a brief stroll in ${cleanWindowLabel}.`,
    },
    pregnant: {
      group: hi ? 'गर्भवती महिलाएँ' : 'Pregnancy',
      advice: hi
        ? 'रसोई के धुएँ और ट्रैफिक धुंध से दूरी रखें; बाहर यात्रा करनी हो तो अच्छी फिटिंग वाला N95 पहनें।'
        : 'Stay clear of cooking smoke and roadside exhaust; wear a snug N95 if travelling during elevated haze.',
    },
    asthma_heart: {
      group: hi ? 'अस्थमा / हृदय देखभाल' : 'Asthma / Heart Care',
      advice: hi
        ? 'निर्धारित रिलीवर इनहेलर पास रखें, पीक घंटों में बाहर न निकलें और नियमित दवा समय पर लें।'
        : 'Keep your prescribed reliever inhaler accessible, avoid peak-haze hours outdoors, and maintain regular medication.',
    },
    outdoor_worker: {
      group: hi ? 'बाहरी कामगार' : 'Outdoor Workers',
      advice: hi
        ? `काम के दौरान सील वाला N95/FFP2 मास्क पहनें, भारी काम ${cleanWindowLabel} में करने की कोशिश करें और ट्रैफिक से दूर छोटे ब्रेक लें।`
        : `Wear a snug N95/FFP2 throughout shifts, schedule heavier tasks near ${cleanWindowLabel} when feasible, and take breaks away from traffic.`,
    },
  };
}

export function mapHouseholdGroup(
  group: HouseholdGroup,
  cleanWindowLabel: string,
  worstWindowLabel: string,
  isPoorOrWorse: boolean,
  hi: boolean
): { group: string; advice: string } {
  return buildHouseholdGroupAdvice(cleanWindowLabel, worstWindowLabel, isPoorOrWorse, hi)[
    group
  ];
}

export { buildPrimaryRoutineItem } from './fallbackRoutines.ts';

export function buildMopAndPlantAction(
  isPoorOrWorse: boolean,
  hi: boolean
): AdviceActionItem {
  let action: string;
  if (isPoorOrWorse) {
    action = hi
      ? 'आज अगरबत्ती, धूप या मच्छर भगाने वाली कॉइल न जलाएँ, सूखी झाड़ू के बजाय गीला पोछा लगाएँ, और ध्यान रखें कि इनडोर पौधे केवल मामूली मदद करते हैं (प्यूरीफायर या वेंटिलेशन का विकल्प नहीं हैं)।'
      : 'Skip incense sticks and mosquito coils while NAQI is Poor or worse, damp-mop instead of dry sweeping, and note that indoor plants help only marginally—never as a substitute for purifiers or ventilation.';
  } else {
    action = hi
      ? 'धूल उड़ने से बचाने के लिए गीला पोछा लगाएँ; ध्यान रखें कि इनडोर पौधे केवल मामूली सहयोग करते हैं और वेंटिलेशन का विकल्प नहीं हैं।'
      : 'Damp-mop floors to trap settled PM10 dust, and remember that houseplants remove particles only marginally and cannot replace ventilation or purifiers.';
  }
  return {
    action,
    why: hi
      ? 'अगरबत्ती, कॉइल और सूखी झाड़ू घर के अंदर PM2.5 व PM10 को तेज़ी से बढ़ाते हैं, जबकि पौधों की अवशोषण क्षमता कमरे के स्तर पर बहुत सीमित होती है।'
      : 'Indoor combustion (incense, coils) and dry sweeping spike indoor PM2.5/PM10 sharply, whereas foliage filters particulates too slowly to clean room air on its own.',
  };
}
