import {
  MEDICAL_DISCLAIMER,
  formatDayLabel,
  formatWindowLabel,
  isPoorOrWorseCategory,
} from '../shared/domain.ts';
import type {
  AdviceActionItem,
  AdviceResponse,
  RoutineActionItem,
} from '../../types/index.ts';
import {
  type FallbackAdviceInput,
  buildMaskGuidance,
  buildMopAndPlantAction,
  buildPrimaryRoutineItem,
  mapHouseholdGroup,
} from './fallbackSections.ts';

export type { FallbackAdviceInput };

function buildHeadline(
  cityName: string,
  cleanWindowLabel: string,
  isGood: boolean,
  isPoorOrWorse: boolean,
  hi: boolean
): string {
  if (isGood) {
    return hi
      ? `${cityName} में आज बाहरी गतिविधियों के लिए अनुकूल हवा`
      : `Favourable outdoor air across ${cityName}`;
  }
  if (isPoorOrWorse) {
    return hi
      ? `${cityName} में बाहरी समय सीमित रखें; ${cleanWindowLabel} बेहतर रहेगा`
      : `Cut outdoor exertion; shift errands to ${cleanWindowLabel}`;
  }
  return hi
    ? `${cityName} में संवेदनशील लोग सावधानी बरतें; ${cleanWindowLabel} चुनें`
    : `Pace outdoor exposure and prefer ${cleanWindowLabel}`;
}

function buildOutdoorActions(
  input: FallbackAdviceInput,
  cleanWindowLabel: string,
  worstWindowLabel: string,
  isPoorOrWorse: boolean
): AdviceActionItem[] {
  const hi = input.language === 'hi';
  let firstAction: string;
  if (isPoorOrWorse) {
    firstAction = hi
      ? `केवल ज़रूरी बाहरी काम ${cleanWindowLabel} में करें और तेज दौड़ या भारी व्यायाम टालें।`
      : `Confine essential outdoor errands to ${cleanWindowLabel} and avoid vigorous exercise outdoors.`;
  } else {
    firstAction = hi
      ? `सैर, खरीदारी या बाहरी काम ${cleanWindowLabel} में तय करें।`
      : `Plan outdoor walks, play, or errands during ${cleanWindowLabel}.`;
  }

  let secondAction: string;
  if (input.lifestyle === 'runner_walker' && isPoorOrWorse) {
    secondAction = hi
      ? 'बाहरी दौड़ के बजाय घर के अंदर योग या हल्की कसरत करें।'
      : 'Move daily running or brisk walks indoors today instead of exercising along roads.';
  } else {
    secondAction = hi
      ? `${worstWindowLabel} के दौरान मुख्य सड़कों और भीड़भाड़ वाले चौराहों से बचें।`
      : `Avoid arterial roads and construction zones during ${worstWindowLabel}.`;
  }

  const cleanSubText = input.cleanestWindow
    ? `${formatDayLabel(input.cleanestWindow.dayLabel, 'hi')} ~${input.cleanestWindow.avgNaqi} NAQI`
    : 'न्यूनतम';

  return [
    {
      action: firstAction,
      why: hi
        ? `इस समय में अन्य घंटों की तुलना में कण स्तर सबसे कम (${cleanSubText}) रहने का अनुमान है।`
        : `Forward hourly readings show lower particulate density during ${cleanWindowLabel} than in surrounding hours.`,
      timeWindow: cleanWindowLabel,
    },
    {
      action: secondAction,
      why: hi
        ? `ऊँचे PM2.5 (${input.pm25} µg/m³) और ${worstWindowLabel} के ठहराव में तेज साँस लेने से कण फेफड़ों में गहराई तक जाते हैं।`
        : `Elevated breathing rates pull fine PM2.5 (${input.pm25} µg/m³) deeper into airways during stagnant peak hours.`,
      timeWindow: worstWindowLabel,
    },
  ];
}

function buildPurifierAction(
  hasPurifier: boolean,
  worstWindowLabel: string,
  hi: boolean
): AdviceActionItem {
  if (hasPurifier) {
    return {
      action: hi
        ? `एयर प्यूरीफायर को बिस्तर या बैठने की जगह से 1–2 मीटर दूरी पर, दीवारों से दूर रखें; ${worstWindowLabel} में दरवाज़े-खिड़की बंद करके इसे हाई मोड पर चलाएँ।`
        : `Place your HEPA purifier 1–2 m from beds or seating with clear airflow around vents, and run it on high during ${worstWindowLabel} with doors/windows shut.`,
      why: hi
        ? 'दीवार से हटकर रखने और पीक घंटों में हाई स्पीड पर चलाने से कमरे की हवा जल्दी फिल्टर होती है।'
        : 'Unobstructed airflow and high fan speed during peak outdoor hours reduce indoor PM2.5 infiltration fastest.',
      timeWindow: worstWindowLabel,
    };
  }
  return {
    action: hi
      ? 'घर का एक मुख्य कमरा कम से कम दरवाज़े खोलकर अपेक्षाकृत बंद रखें; यदि संभव हो तो पोर्टेबल HEPA प्यूरीफायर या बॉक्स-फैन DIY HEPA फ़िल्टर अपनाएँ।'
      : 'Keep one main bedroom sealed as a lower-particle zone with door gaps covered; if possible, use a compact HEPA purifier or DIY MERV/HEPA fan filter.',
    why: hi
      ? 'एक कमरा बंद रखने से परिवार के संवेदनशील सदस्यों के लिए कम-कण वाला सुरक्षित क्षेत्र बनता है।'
      : 'Limiting outside leakage in one primary room noticeably lowers cumulative overnight particle exposure.',
    timeWindow: worstWindowLabel,
  };
}

function buildIndoorActions(
  input: FallbackAdviceInput,
  cleanWindowLabel: string,
  worstWindowLabel: string,
  isPoorOrWorse: boolean
): AdviceActionItem[] {
  const hi = input.language === 'hi';
  return [
    buildPurifierAction(input.hasPurifier, worstWindowLabel, hi),
    {
      action: hi
        ? `खिड़कियाँ केवल ${cleanWindowLabel} में 15–20 मिनट क्रॉस-वेंटिलेशन के लिए खोलें; खाना बनाते समय रसोई का एग्ज़ॉस्ट फैन या चिमनी अवश्य चलाएँ।`
        : `Open windows briefly for 15–20 minutes only during ${cleanWindowLabel} for cross-ventilation, and always run the kitchen exhaust fan while cooking or frying.`,
      why: hi
        ? `हवा की गति ${input.windSpeedKmh} km/h पर छोटे समय की वेंटिलेशन से रसोई का धुआँ और CO₂ बाहर निकलते हैं।`
        : `Brief airing during the lowest-particulate window clears indoor CO₂ and cooking aerosols without flooding rooms with peak outdoor smog.`,
      timeWindow: cleanWindowLabel,
    },
    buildMopAndPlantAction(isPoorOrWorse, hi),
  ];
}

function buildSummaryText(
  input: FallbackAdviceInput,
  cleanWindowLabel: string,
  worstWindowLabel: string,
  isGood: boolean
): string {
  const hi = input.language === 'hi';
  const airDescEn = isGood ? 'clean air' : 'lowest-particulate window';
  const airDescHi = isGood ? 'स्वच्छ हवा' : 'सबसे कम प्रदूषण वाला समय';
  const cleanAvg = input.cleanestWindow?.avgNaqi ?? input.aqi;
  return hi
    ? `${input.cityName} में अभी ${input.dominantPollutant} मुख्य प्रदूषक है (PM2.5: ${input.pm25} µg/m³, PM10: ${input.pm10} µg/m³)। आगे के 24 घंटों में ${airDescHi} ${cleanWindowLabel} (औसत NAQI ~${cleanAvg}) और अधिकतम धुंध ${worstWindowLabel} रहने का अनुमान है।`
    : `${input.dominantPollutant} leads particulate readings right now (PM2.5: ${input.pm25} µg/m³, PM10: ${input.pm10} µg/m³). Over the next 24 hours, the ${airDescEn} is ${cleanWindowLabel} (avg NAQI ~${cleanAvg}) while peak buildup occurs during ${worstWindowLabel}.`;
}

function buildForWhomList(
  input: FallbackAdviceInput,
  cleanWindowLabel: string,
  worstWindowLabel: string,
  isPoorOrWorse: boolean
) {
  const hi = input.language === 'hi';
  if (input.household.length === 0) {
    return [
      {
        group: hi ? 'सामान्य परिवार' : 'General Household',
        advice: hi
          ? `बाहरी काम ${cleanWindowLabel} में निपटाएँ और ${worstWindowLabel} में घर के अंदर रहें।`
          : `Batch outdoor errands into ${cleanWindowLabel} and stay indoors during ${worstWindowLabel}.`,
      },
    ];
  }
  return input.household.map((g) =>
    mapHouseholdGroup(g, cleanWindowLabel, worstWindowLabel, isPoorOrWorse, hi)
  );
}

/**
 * Deterministic rule-based fallback advice builder implementing strict mask rules,
 * forward-looking Today/Tomorrow windows, rich indoor guidance, lifestyle-specific routines
 * with approx. stated CO2 assumptions, and no "clean air" wording unless NAQI is Good.
 */
export function buildFallbackAdvice(input: FallbackAdviceInput): AdviceResponse {
  const hi = input.language === 'hi';
  const isGood = input.category === 'Good';
  const isPoorOrWorse = isPoorOrWorseCategory(input.category);
  const cleanWindowLabel = formatWindowLabel(
    input.cleanestWindow,
    input.language,
    'next lower-pollution afternoon window',
    'अगला कम प्रदूषण वाला समय'
  );
  const worstWindowLabel = formatWindowLabel(
    input.worstWindow,
    input.language,
    'peak haze hours ahead',
    'आगामी अधिकतम धुंध समय'
  );

  const tripBatchItem: RoutineActionItem = {
    action: hi
      ? `अनावश्यक छोटे चक्कर अलग-अलग न लगाकर सभी काम एक साथ ${cleanWindowLabel} में निपटाएँ और ${worstWindowLabel} में सड़क यात्रा टालें।`
      : `Batch errands into one trip during ${cleanWindowLabel} and avoid non-essential road travel during ${worstWindowLabel}.`,
    why: hi
      ? 'यात्राएँ समेटने से सड़क पर आपका व्यक्तिगत धुंध संपर्क घटता है और बार-बार कोल्ड-स्टार्ट वाहन उत्सर्जन भी बचता है।'
      : 'Combining trips cuts both your personal exposure minutes and repeated cold-start tailpipe emissions.',
  };

  return {
    verdict: {
      level: input.category,
      headline: buildHeadline(
        input.cityName,
        cleanWindowLabel,
        isGood,
        isPoorOrWorse,
        hi
      ),
      summary: buildSummaryText(input, cleanWindowLabel, worstWindowLabel, isGood),
    },
    outdoor: buildOutdoorActions(
      input,
      cleanWindowLabel,
      worstWindowLabel,
      isPoorOrWorse
    ),
    indoor: buildIndoorActions(input, cleanWindowLabel, worstWindowLabel, isPoorOrWorse),
    routine: [
      buildPrimaryRoutineItem({
        lifestyle: input.lifestyle,
        isPoorOrWorse,
        cleanWindowLabel,
        worstWindowLabel,
        hi,
      }),
      tripBatchItem,
    ],
    mask: buildMaskGuidance(input, hi),
    forWhom: buildForWhomList(input, cleanWindowLabel, worstWindowLabel, isPoorOrWorse),
    disclaimer: MEDICAL_DISCLAIMER[input.language],
    source: 'fallback',
  };
}
