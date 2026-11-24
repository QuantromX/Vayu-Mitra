import { z } from 'zod';
import { NaqiCategorySchema } from '../advice/schema.ts';
import type {
  Language,
  NaqiCategory,
  PhotoCheckResponse,
  PhotoSceneHint,
} from '../../types/index.ts';

/**
 * Allowed image MIME types for Photo Check uploads.
 */
export const ALLOWED_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

/**
 * Maximum uploaded image byte size (4 MB) enforced on both client and server.
 */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Calculates decoded byte size of a base64 string without allocating buffers.
 */
export function getBase64ByteLength(base64: string): number {
  const clean = base64.replace(/\s+/g, '');
  if (!clean) return 0;
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

/**
 * Zod schema validating incoming POST /api/photo-check payloads.
 */
export const PhotoCheckRequestSchema = z.object({
  mimeType: z.enum(ALLOWED_PHOTO_MIME_TYPES),
  imageBase64: z
    .string()
    .trim()
    .min(32, 'Image payload is too small')
    .max(6_000_000, 'Encoded image payload exceeds maximum limit')
    .refine((val) => BASE64_PATTERN.test(val), 'Invalid base64 image encoding')
    .refine(
      (val) => {
        const bytes = getBase64ByteLength(val);
        return bytes > 0 && bytes <= MAX_PHOTO_BYTES;
      },
      `Image must be 4 MB or smaller`
    ),
  sceneHint: z.enum(['auto', 'room', 'sky']).optional().default('auto'),
  aqi: z.number().min(0).max(500).optional(),
  category: NaqiCategorySchema.optional(),
  hasPurifier: z.boolean().optional().default(false),
  language: z.enum(['en', 'hi']),
});

/**
 * Zod schema enforcing structured JSON output from Gemini Vision for Photo Check.
 */
export const PhotoCheckGeminiPayloadSchema = z.object({
  observations: z.array(z.string().min(6).max(240)).min(1).max(6),
  purifierPlacement: z.string().min(8).max(400),
  ventilationTip: z.string().min(8).max(400),
  confidence: z.enum(['low', 'medium', 'high']),
  disclaimer: z.string().min(10).max(300),
});

export type ValidatedPhotoCheckRequest = z.infer<typeof PhotoCheckRequestSchema>;
export type ValidatedPhotoCheckPayload = z.infer<
  typeof PhotoCheckGeminiPayloadSchema
>;

/**
 * Builds the strict Gemini Vision system instruction for Photo Check.
 */
export function buildPhotoCheckSystemInstruction(language: Language): string {
  const langRule =
    language === 'hi'
      ? 'Write every JSON string value (except "confidence" which must stay exact English low|medium|high) in clear natural Hindi (हिन्दी).'
      : 'Write every JSON string value in clear Indian English.';

  return [
    'You are VayuMitra Visual Check, helping Indian families spot practical air-quality and ventilation cues in a room or outdoor sky photo.',
    langRule,
    'Strict rules:',
    '1. Describe ONLY visible layout, window/door openings, purifier/fan positioning, smoke/incense/dust sources, or visible sky haze/visibility cues.',
    '2. NEVER claim to measure PM2.5, PM10, or exact AQI numbers from a photo — visually estimating concentration is impossible. Explicitly treat output as a visual advisory estimate, never a measurement or medical advice.',
    '3. Keep observations grounded in what is actually visible (1 to 4 concise points). If the image is unclear or dark, state low confidence.',
    '4. Give actionable purifierPlacement (at least 1–2 m from beds/seating with unobstructed intake away from walls/curtains, or best single sealed-room placement if no purifier) and ventilationTip grounded in the scene and provided current NAQI tier.',
    '5. Set "disclaimer" to clearly state this is an advisory visual check, not an air sensor measurement.',
  ].join(' ');
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
  const isPoorOrWorse =
    input.category === 'Poor' ||
    input.category === 'Very Poor' ||
    input.category === 'Severe';

  const observations =
    input.sceneHint === 'sky'
      ? hi
        ? [
            'फोटो का ऑफ़लाइन दृश्य चेक: दूर की इमारतों और क्षितिज की स्पष्टता हल्के से मध्यम धुंध का संकेत दे सकती है।',
            'कैमरा एक्सपोज़र और मौसम की नमी से दृश्यता बदलती है, इसलिए सटीक स्तर के लिए लाइव NAQI रीडिंग देखें।',
          ]
        : [
            'Offline visual check: horizon sharpness and distant contrast depend on both particulate haze and moisture/lighting.',
            'Camera exposure cannot quantify PM2.5 or PM10—rely on live Open-Meteo NAQI numbers above for timing.',
          ]
      : hi
        ? [
            'खिड़कियों, दरवाज़ों के नीचे की जगह और रसोई/धूप के स्रोतों की जांच कमरे में बाहरी धुंध कम करने का सबसे असरदार तरीका है।',
            'सूखी झाड़ू की बजाय गीले पोछे से कमरे में उड़ने वाली धूल कम रहती है।',
          ]
        : [
            'Checking window seals, under-door gaps, and indoor smoke sources (cooking, incense, coils) is the fastest way to cut indoor particle buildup.',
            'Damp-mopping hard floors avoids re-suspending settled dust indoors.',
          ];

  const purifierPlacement = input.hasPurifier
    ? hi
      ? 'HEPA प्यूरीफायर को बिस्तर या बैठने की जगह से 1–2 मीटर दूरी पर रखें, और दीवार, पर्दे या फर्नीचर से कम से कम 30 सेमी जगह खाली छोड़ें।'
      : 'Position your HEPA purifier 1–2 m from beds or main seating with at least 30 cm clearance around intake vents away from curtains and walls.'
    : hi
      ? 'यदि प्यूरीफायर नहीं है, तो एक कम उपयोग वाले दरवाज़े वाले बेडरूम को कम-कण क्षेत्र के रूप में बंद रखें; दरवाज़े के नीचे मोटा कपड़ा या डोर सील लगाएँ।'
      : 'If you do not own a purifier yet, designate one bedroom with tight window latches as a cleaner-sleep zone and seal under-door gaps with a draft stopper.';

  const ventilationTip = isPoorOrWorse
    ? hi
      ? `वर्तमान श्रेणी (${input.category ?? 'खराब'}) होने के कारण मुख्य खिड़कियाँ बंद रखें; केवल न्यूनतम प्रदूषण वाले समय में 15 मिनट क्रॉस-वेंटिलेशन करें और खाना बनाते समय एग्ज़ॉस्ट चलाएँ।`
      : `Because readings are ${input.category ?? 'elevated'}, keep windows closed through peak hours, air out for 15 minutes only during the lowest-pollution window, and run kitchen exhaust fans while cooking.`
    : hi
      ? 'संतोषजनक/मध्यम समय में हल्की क्रॉस-वेंटिलेशन के लिए आमने-सामने की खिड़कियाँ 15–20 मिनट खोलें ताकि इनडोर CO₂ और रसोई की भाप बाहर निकल सके।'
      : 'Open opposite windows briefly for 15–20 minutes during lower-pollution daytime hours to clear indoor CO₂ and cooking moisture.';

  return {
    observations,
    purifierPlacement,
    ventilationTip,
    confidence: 'low',
    disclaimer: hi
      ? 'यह केवल एक दृश्य परामर्श अनुमान है (ऑफ़लाइन फ़ॉलबैक), वायु-गुणवत्ता सेंसर माप या चिकित्सीय सलाह नहीं।'
      : 'Advisory visual estimate only (offline fallback) — not a PM2.5/NAQI measurement or medical advice.',
    source: 'fallback',
  };
}
