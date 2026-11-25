import { isPoorOrWorseCategory } from '../shared/domain.ts';
import type {
  AskVerdict,
  HouseholdGroup,
  Language,
  LifestyleMode,
  NaqiCategory,
  WindowDayLabel,
} from '../../types/index.ts';

export interface FallbackAskInput {
  question: string;
  cityName: string;
  aqi: number;
  category: NaqiCategory;
  dominantPollutant: 'PM2.5' | 'PM10';
  pm25: number;
  pm10: number;
  temperatureC: number;
  humidityPct: number;
  windSpeedKmh: number;
  cleanestWindow: {
    startHour: string;
    endHour: string;
    dayLabel: WindowDayLabel;
    avgNaqi: number;
    avgPm25: number;
  } | null;
  worstWindow: {
    startHour: string;
    endHour: string;
    dayLabel: WindowDayLabel;
    avgNaqi: number;
    avgPm25: number;
  } | null;
  household: HouseholdGroup[];
  lifestyle: LifestyleMode;
  hasPurifier: boolean;
  language: Language;
}

function buildWindowAnswer(
  input: FallbackAskInput,
  bestTime: string | undefined,
  worstTime: string | undefined,
  isPoorOrWorse: boolean
): { answer: string; why: string } {
  const hi = input.language === 'hi';
  let answer: string;
  if (isPoorOrWorse) {
    answer = hi
      ? `अभी खिड़कियाँ बंद रखें; केवल ${bestTime ?? 'कम प्रदूषण वाले समय'} में 15–20 मिनट क्रॉस-वेंटिलेशन करें।`
      : `Keep windows shut right now; air out briefly for 15–20 minutes only during ${bestTime ?? 'the lowest-pollution window'}.`;
  } else {
    answer = hi
      ? `आप ${bestTime ?? 'अभी'} में थोड़ी देर क्रॉस-वेंटिलेशन के लिए खिड़कियाँ खोल सकते हैं।`
      : `You can open windows for cross-ventilation, ideally timed around ${bestTime ?? 'current hours'}.`;
  }

  let whyTailEn = 'limiting drafts during peak hours reduces indoor infiltration.';
  let whyTailHi = 'पीक घंटों में खिड़कियाँ बंद रखना बेहतर है।';
  if (worstTime) {
    whyTailEn = `peak buildup is forecast during ${worstTime}.`;
    whyTailHi = `${worstTime} में धुंध चरम पर रहेगी।`;
  }
  const why = hi
    ? `${input.cityName} में अभी NAQI ${input.aqi} (PM2.5: ${input.pm25} µg/m³) और हवा ${input.windSpeedKmh} km/h है; ${whyTailHi}`
    : `Live readings in ${input.cityName} are NAQI ${input.aqi} (PM2.5 ${input.pm25} µg/m³) with ${input.windSpeedKmh} km/h wind; ${whyTailEn}`;
  return { answer, why };
}

function buildMaskAnswer(
  input: FallbackAskInput,
  isPoorOrWorse: boolean
): { answer: string; why: string } {
  const hi = input.language === 'hi';
  let answer: string;
  if (isPoorOrWorse) {
    answer = hi
      ? 'हाँ, बाहर जाते समय अच्छी फिटिंग वाला N95 / FFP2 मास्क अवश्य पहनें।'
      : 'Yes — wear a snug N95 / FFP2 respirator whenever stepping outdoors right now.';
  } else if (input.category === 'Moderate') {
    answer = hi
      ? 'बच्चों, वरिष्ठों, अस्थमा/हृदय रोगियों और बाहरी कामगारों के लिए N95 / FFP2 मास्क जरूरी है; अन्य लोगों के लिए वैकल्पिक है।'
      : 'Recommended N95 / FFP2 for children, seniors, asthma/heart patients, and outdoor workers; optional for healthy adults.';
  } else {
    answer = hi
      ? 'अभी सामान्य लोगों के लिए मास्क वैकल्पिक है।'
      : 'Masks are optional for most people at current readings.';
  }
  const domVal = input.dominantPollutant === 'PM2.5' ? input.pm25 : input.pm10;
  const why = hi
    ? `वर्तमान NAQI ${input.aqi} (${input.category}) और प्रमुख प्रदूषक ${input.dominantPollutant} (${domVal} µg/m³) के आधार पर यह सलाह दी गई है।`
    : `Current NAQI is ${input.aqi} (${input.category}) with ${input.dominantPollutant} at ${domVal} µg/m³.`;
  return { answer, why };
}

function buildPurifierAnswer(
  input: FallbackAskInput,
  worstTime: string | undefined
): { answer: string; why: string } {
  const hi = input.language === 'hi';
  let answer: string;
  if (input.hasPurifier) {
    answer = hi
      ? `प्यूरीफायर को बिस्तर/बैठक से 1–2 मीटर दूरी पर रखें और ${worstTime ?? 'पीक घंटों'} में दरवाज़े बंद करके हाई स्पीड पर चलाएँ।`
      : `Place your HEPA purifier 1–2 m from beds or seating with clear vent space and run it on high with doors shut during ${worstTime ?? 'peak haze hours'}.`;
  } else {
    answer = hi
      ? 'बिना प्यूरीफायर के एक मुख्य कमरा बंद रखें, गीला पोछा लगाएँ और अगरबत्ती या कॉइल बिल्कुल न जलाएँ।'
      : 'Without a purifier, keep one bedroom sealed as a lower-particle zone, damp-mop floors, and avoid incense or mosquito coils.';
  }
  const why = hi
    ? `इनडोर कण नियंत्रण PM2.5 (${input.pm25} µg/m³) के संपर्क को कम करने में मदद करता है; घर के पौधे केवल मामूली मदद करते हैं।`
    : `At PM2.5 ${input.pm25} µg/m³, reducing indoor sources and sealing leaks matters most—indoor plants alone help only marginally.`;
  return { answer, why };
}

function buildExerciseAnswer(
  input: FallbackAskInput,
  verdict: AskVerdict,
  bestTime: string | undefined
): { answer: string; why: string } {
  const hi = input.language === 'hi';
  let answer: string;
  if (verdict === 'no') {
    answer = hi
      ? 'नहीं — अभी घर के अंदर ही हल्की गतिविधि या खेल रखें; बाहरी दौड़ या भारी खेल टालें।'
      : "No — shift exercise and children's play indoors right now instead of heavy outdoor exertion.";
  } else if (verdict === 'caution') {
    answer = hi
      ? `सावधानी के साथ केवल ${bestTime ?? 'कम प्रदूषण वाले समय'} में हल्की गतिविधि करें और मुख्य सड़कों से दूर रहें।`
      : `Proceed with caution: keep intensity light, stay away from traffic corridors, and aim for ${bestTime ?? 'the lowest-pollution slot'}.`;
  } else {
    answer = hi
      ? `हाँ — आज ${bestTime ?? 'अभी'} बाहरी सैर या खेल के लिए उपयुक्त है।`
      : `Yes — outdoor walks or play look reasonable, especially around ${bestTime ?? 'current hours'}.`;
  }
  const why = hi
    ? `अभी NAQI ${input.aqi} (${input.category}), PM2.5 ${input.pm25} µg/m³ और तापमान ${input.temperatureC}°C है। तेज साँस लेने से कण फेफड़ों में गहराई तक जा सकते हैं।`
    : `Current NAQI is ${input.aqi} (${input.category}) with PM2.5 at ${input.pm25} µg/m³ and ${input.temperatureC}°C temperature; faster breathing raises inhaled particle dose.`;
  return { answer, why };
}

function buildGeneralAnswer(
  input: FallbackAskInput,
  bestTime: string | undefined,
  isPoorOrWorse: boolean
): { answer: string; why: string } {
  const hi = input.language === 'hi';
  let answer: string;
  if (isPoorOrWorse) {
    answer = hi
      ? `बाहरी काम कम रखें और ज़रूरी काम ${bestTime ?? 'कम प्रदूषण वाले समय'} में समेटें; बाहर N95/FFP2 पहनें।`
      : `Limit non-essential outdoor exposure, batch essential errands into ${bestTime ?? 'the lowest-pollution window'}, and wear N95/FFP2 outside.`;
  } else {
    answer = hi
      ? `दिनचर्या सामान्य रख सकते हैं, लेकिन भारी बाहरी काम ${bestTime ?? 'अभी'} में करना सबसे बेहतर रहेगा।`
      : `Normal routines can continue, ideally timing outdoor tasks around ${bestTime ?? 'current hours'}.`;
  }
  const why = hi
    ? `${input.cityName} में NAQI ${input.aqi} (${input.dominantPollutant} प्रमुख, PM2.5: ${input.pm25} µg/m³, हवा: ${input.windSpeedKmh} km/h) दर्ज है।`
    : `Grounded in ${input.cityName} readings: NAQI ${input.aqi} (${input.dominantPollutant} dominant, PM2.5 ${input.pm25} µg/m³, wind ${input.windSpeedKmh} km/h).`;
  return { answer, why };
}

export function selectAskResponseText(
  input: FallbackAskInput,
  verdict: AskVerdict,
  bestTime: string | undefined,
  worstTime: string | undefined
): { answer: string; why: string } {
  const qLower = input.question.toLowerCase();
  const isPoorOrWorse = isPoorOrWorseCategory(input.category);

  if (/window|ventilat|air out|cross|खिड़की|हवा/.test(qLower)) {
    return buildWindowAnswer(input, bestTime, worstTime, isPoorOrWorse);
  }
  if (/mask|n95|ffp2|मास्क/.test(qLower)) {
    return buildMaskAnswer(input, isPoorOrWorse);
  }
  if (/purifier|hepa|filter|incense|coil|प्यूरीफायर|अगरबत्ती/.test(qLower)) {
    return buildPurifierAnswer(input, worstTime);
  }
  if (/run|jog|walk|exercise|play|kid|child|school|park|दौड़|सैर|बच्च|खेल/.test(qLower)) {
    return buildExerciseAnswer(input, verdict, bestTime);
  }
  return buildGeneralAnswer(input, bestTime, isPoorOrWorse);
}
