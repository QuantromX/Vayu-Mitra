import { MEDICAL_DISCLAIMER, isPoorOrWorseCategory } from '../shared/domain.ts';
import type {
  Language,
  NaqiCategory,
  PhotoCheckResponse,
  PhotoSceneHint,
} from '../../types/index.ts';

function buildFallbackObservations(sceneHint: PhotoSceneHint, hi: boolean): string[] {
  if (sceneHint === 'sky') {
    return hi
      ? [
          'फोटो का ऑफ़लाइन दृश्य चेक: दूर की इमारतों और क्षितिज की स्पष्टता हल्के से मध्यम धुंध का संकेत दे सकती है।',
          'कैमरा एक्सपोज़र और मौसम की नमी से दृश्यता बदलती है, इसलिए सटीक स्तर के लिए लाइव NAQI रीडिंग देखें।',
        ]
      : [
          'Offline visual check: horizon sharpness and distant contrast depend on both particulate haze and moisture/lighting.',
          'Camera exposure cannot quantify PM2.5 or PM10—rely on live Open-Meteo NAQI numbers above for timing.',
        ];
  }

  return hi
    ? [
        'खिड़कियों, दरवाज़ों के नीचे की जगह और रसोई/धूप के स्रोतों की जांच कमरे में बाहरी धुंध कम करने का सबसे असरदार तरीका है।',
        'सूखी झाड़ू की बजाय गीले पोछे से कमरे में उड़ने वाली धूल कम रहती है।',
      ]
    : [
        'Checking window seals, under-door gaps, and indoor smoke sources (cooking, incense, coils) is the fastest way to cut indoor particle buildup.',
        'Damp-mopping hard floors avoids re-suspending settled dust indoors.',
      ];
}

function buildFallbackPurifierPlacement(hasPurifier: boolean, hi: boolean): string {
  if (hasPurifier) {
    return hi
      ? 'HEPA प्यूरीफायर को बिस्तर या बैठने की जगह से 1–2 मीटर दूरी पर रखें, और दीवार, पर्दे या फर्नीचर से कम से कम 30 सेमी जगह खाली छोड़ें।'
      : 'Position your HEPA purifier 1–2 m from beds or main seating with at least 30 cm clearance around intake vents away from curtains and walls.';
  }
  return hi
    ? 'यदि प्यूरीफायर नहीं है, तो एक कम उपयोग वाले दरवाज़े वाले बेडरूम को कम-कण क्षेत्र के रूप में बंद रखें; दरवाज़े के नीचे मोटा कपड़ा या डोर सील लगाएँ।'
    : 'If you do not own a purifier yet, designate one bedroom with tight window latches as a cleaner-sleep zone and seal under-door gaps with a draft stopper.';
}

function buildFallbackVentilationTip(
  isPoorOrWorse: boolean,
  category: NaqiCategory | undefined,
  hi: boolean
): string {
  if (isPoorOrWorse) {
    return hi
      ? `वर्तमान श्रेणी (${category ?? 'खराब'}) होने के कारण मुख्य खिड़कियाँ बंद रखें; केवल न्यूनतम प्रदूषण वाले समय में 15 मिनट क्रॉस-वेंटिलेशन करें और खाना बनाते समय एग्ज़ॉस्ट चलाएँ।`
      : `Because readings are ${category ?? 'elevated'}, keep windows closed through peak hours, air out for 15 minutes only during the lowest-pollution window, and run kitchen exhaust fans while cooking.`;
  }
  return hi
    ? 'संतोषजनक/मध्यम समय में हल्की क्रॉस-वेंटिलेशन के लिए आमने-सामने की खिड़कियाँ 15–20 मिनट खोलें ताकि इनडोर CO₂ और रसोई की भाप बाहर निकल सके।'
    : 'Open opposite windows briefly for 15–20 minutes during lower-pollution daytime hours to clear indoor CO₂ and cooking moisture.';
}

/**
 * Deterministic fallback guidance for Photo Check when Gemini Vision is unavailable or rate-limited.
 */
export function buildFallbackPhotoCheck(input: {
  sceneHint: PhotoSceneHint;
  aqi?: number;
  category?: NaqiCategory;
  hasPurifier: boolean;
  language: Language;
}): PhotoCheckResponse {
  const hi = input.language === 'hi';
  const isPoorOrWorse = input.category ? isPoorOrWorseCategory(input.category) : false;

  return {
    observations: buildFallbackObservations(input.sceneHint, hi),
    purifierPlacement: buildFallbackPurifierPlacement(input.hasPurifier, hi),
    ventilationTip: buildFallbackVentilationTip(isPoorOrWorse, input.category, hi),
    confidence: 'low',
    disclaimer: hi
      ? `दृश्य परामर्श अनुमान (ऑफ़लाइन फ़ॉलबैक) — यह सेंसर माप नहीं है। ${MEDICAL_DISCLAIMER.hi}`
      : `Advisory visual estimate (offline fallback) — not a PM2.5 measurement. ${MEDICAL_DISCLAIMER.en}`,
    source: 'fallback',
  };
}
