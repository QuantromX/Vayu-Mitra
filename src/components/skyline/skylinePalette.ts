export type SkylineCityKey = 'delhi' | 'mumbai' | 'lucknow' | 'kolkata' | 'generic';

export const SKYLINE_SCENE_CONSTANTS = {
  maxScrollParallaxY: 26,
  scrollParallaxFactor: 0.08,
  maxOrientationGammaDeg: 18,
  orientationParallaxFactor: 0.6,
  farParallaxXFactor: 0.35,
  farParallaxYFactor: 0.3,
  midParallaxXFactor: 0.7,
  midParallaxYFactor: 0.55,
  nearParallaxYFactor: 0.85,
  minFarOpacity: 0.06,
  baseFarOpacity: 0.34,
  hazeFarOpacityFactor: 0.3,
  dimmedSunOpacity: 0.35,
  minSunOpacity: 0.42,
  baseSunOpacity: 0.96,
  hazeSunOpacityFactor: 0.42,
  fogOverlayThreshold: 0.4,
} as const;

export const SKYLINE_PALETTE = {
  cloudThunderFill: '#0f172a',
  cloudDayFill: '#e2e8f0',
  fogTintPrimary: 'rgba(241, 245, 249, 0.28)',
  fogTintSecondary: 'rgba(226, 232, 240, 0.3)',
  midLayerStroke: 'rgba(255,255,255,0.14)',
} as const;

export function resolveCitySkyline(cityName: string): SkylineCityKey {
  const normalized = cityName.toLowerCase();
  const isNcr = ['delhi', 'noida', 'gurgaon', 'gurugram'].some((k) =>
    normalized.includes(k)
  );
  if (isNcr) return 'delhi';

  const isMmr = ['mumbai', 'thane', 'navi mumbai'].some((k) => normalized.includes(k));
  if (isMmr) return 'mumbai';
  if (normalized.includes('lucknow')) return 'lucknow';
  if (normalized.includes('kolkata') || normalized.includes('howrah')) return 'kolkata';
  return 'generic';
}
