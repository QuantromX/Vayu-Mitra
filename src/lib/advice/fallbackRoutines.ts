import type { LifestyleMode, RoutineActionItem } from '../../types/index.ts';

function buildCarRoutine(hi: boolean): RoutineActionItem {
  return {
    action: hi
      ? 'संभव हो तो आज कार की जगह मेट्रो, बस या कारपूल अपनाएँ; कार में री-सर्कुलेशन मोड ऑन रखें।'
      : 'Swap solo car trips for metro, bus, or carpooling today; if driving, switch cabin AC to recirculate mode.',
    why: hi
      ? 'एक व्यक्ति की कार यात्रा घटाने से सड़क किनारे PM2.5 और टेलपाइप उत्सर्जन दोनों कम होते हैं।'
      : 'Moving one 10 km solo car commute onto metro or a shared ride reduces local roadside exhaust immediately.',
    co2Benefit: hi
      ? 'लगभग 1.4 kg CO₂ बचत (मान्यता: 10 km कार 170 g/km बनाम मेट्रो 30 g/km)'
      : 'Approx. 1.4 kg CO₂ saved (assumes 10 km solo car at 170 g/km vs metro at 30 g/km)',
  };
}

function buildTransitRoutine(cleanWindowLabel: string, hi: boolean): RoutineActionItem {
  return {
    action: hi
      ? `मेट्रो या बस से यात्रा जारी रखें और स्टेशन तक पैदल हिस्सा ${cleanWindowLabel} में या मास्क के साथ तय करें।`
      : `Stick with metro or bus transit today and cover walking last-mile stretches during ${cleanWindowLabel} or with an N95 when Poor+.`,
    why: hi
      ? 'सामूहिक परिवहन प्रति यात्री उत्सर्जन को कार या दोपहिया की तुलना में काफी कम रखता है।'
      : 'Mass transit keeps per-passenger road emissions far lower than private vehicles on congested corridors.',
    co2Benefit: hi
      ? 'लगभग 1.4 kg CO₂ बचत (मान्यता: 10 km कार 170 g/km बनाम मेट्रो 30 g/km)'
      : 'Approx. 1.4 kg CO₂ avoided vs solo car (assumes 10 km car at 170 g/km vs metro at 30 g/km)',
  };
}

function buildWfhRoutine(
  cleanWindowLabel: string,
  worstWindowLabel: string,
  hi: boolean
): RoutineActionItem {
  return {
    action: hi
      ? `घर से काम करते हुए बाहरी खरीदारी व बैंक काम ${cleanWindowLabel} में एक ही चक्कर में निपटाएँ।`
      : `Stay home through ${worstWindowLabel} and group any groceries or errands into one outing during ${cleanWindowLabel}.`,
    why: hi
      ? 'घर से काम करने से दैनिक सड़क यात्रा उत्सर्जन शून्य रहता है और आप पीक धुंध के घंटों से पूरी तरह बच सकते हैं।'
      : 'Working from home eliminates peak-hour road exposure and avoids an additional daily commute.',
    co2Benefit: hi
      ? 'लगभग 1.7 kg CO₂ बचत (मान्यता: 10 km दैनिक कार यात्रा टालने पर 170 g/km)'
      : 'Approx. 1.7 kg CO₂ avoided (assumes skipping a 10 km car commute at 170 g/km)',
  };
}

function buildBikeRoutine(
  isPoorOrWorse: boolean,
  cleanWindowLabel: string,
  hi: boolean
): RoutineActionItem {
  let action: string;
  if (isPoorOrWorse) {
    action = hi
      ? 'बाइक/स्कूटर की जगह आज संभव हो तो मेट्रो या बस लें; दोपहिया चलाने पर हेलमेट वाइज़र के नीचे N95 मास्क अवश्य लगाएँ।'
      : 'Switch from two-wheeler to metro or bus today if routes allow; if riding, wear a snug N95 beneath a closed visor.';
  } else {
    action = hi
      ? `दोपहिया यात्रा ${cleanWindowLabel} के आसपास रखें और मुख्य धुएँ वाली लेन से बचें।`
      : `Time two-wheeler rides closer to ${cleanWindowLabel} and avoid idling behind diesel vehicles.`;
  }
  return {
    action,
    why: hi
      ? 'खुले दोपहिया पर सवारी करते समय यात्री सीधे वाहन धुएँ और सड़क धूल के सबसे करीब होते हैं।'
      : 'Two-wheeler riders breathe concentrated roadside exhaust and re-suspended road dust directly at tailpipe height.',
  };
}

function buildRunnerRoutine(
  isPoorOrWorse: boolean,
  cleanWindowLabel: string,
  hi: boolean
): RoutineActionItem {
  let action: string;
  if (isPoorOrWorse) {
    action = hi
      ? `बाहरी दौड़ आज इनडोर वर्कआउट में बदलें या हल्की सैर केवल ${cleanWindowLabel} में पार्क के भीतर करें।`
      : `Swap outdoor running for indoor training today, or keep a gentle walk strictly inside green parks during ${cleanWindowLabel}.`;
  } else {
    action = hi
      ? `अपनी दैनिक सैर/दौड़ ${cleanWindowLabel} में रखें और भारी ट्रैफिक सड़कों से दूर हरे रास्तों को चुनें।`
      : `Schedule your daily walk or run during ${cleanWindowLabel} along tree-lined paths away from traffic.`;
  }
  return {
    action,
    why: hi
      ? 'दौड़ते समय सामान्य से 3–5 गुना अधिक हवा फेफड़ों में जाती है, इसलिए समय और मार्ग चुनना बेहद जरूरी है।'
      : 'Running increases minute ventilation 3–5×, making timing and distance from traffic critical for airway protection.',
  };
}

export function buildPrimaryRoutineItem(params: {
  lifestyle: LifestyleMode;
  isPoorOrWorse: boolean;
  cleanWindowLabel: string;
  worstWindowLabel: string;
  hi: boolean;
}): RoutineActionItem {
  const { lifestyle, isPoorOrWorse, cleanWindowLabel, worstWindowLabel, hi } = params;
  switch (lifestyle) {
    case 'commute_car':
      return buildCarRoutine(hi);
    case 'commute_metro':
    case 'commute_bus':
      return buildTransitRoutine(cleanWindowLabel, hi);
    case 'wfh':
      return buildWfhRoutine(cleanWindowLabel, worstWindowLabel, hi);
    case 'commute_bike':
      return buildBikeRoutine(isPoorOrWorse, cleanWindowLabel, hi);
    case 'runner_walker':
      return buildRunnerRoutine(isPoorOrWorse, cleanWindowLabel, hi);
  }
}
