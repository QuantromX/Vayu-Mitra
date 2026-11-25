import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import type { ThemeTokens } from '../types/index.ts';
import { LandmarkMidLayer } from './skyline/LandmarkLayers.tsx';
import { WeatherOverlays } from './skyline/WeatherOverlays.tsx';
import {
  SKYLINE_PALETTE,
  SKYLINE_SCENE_CONSTANTS,
  resolveCitySkyline,
  type SkylineCityKey,
} from './skyline/skylinePalette.ts';

export type { SkylineCityKey };
export { resolveCitySkyline };

const HeroParticleCanvas = lazy(() => import('./HeroParticleCanvas.tsx'));

const SkylineParallaxSvg: React.FC<{
  cityKey: SkylineCityKey;
  farLayerOpacity: number;
  parallax: { x: number; y: number };
}> = ({ cityKey, farLayerOpacity, parallax }) => {
  const c = SKYLINE_SCENE_CONSTANTS;
  return (
    <svg
      width="1200"
      height="340"
      className="absolute bottom-0 inset-x-[-3%] w-[106%] h-[66%] min-h-[190px] text-slate-950 vm-theme-transition"
      viewBox="0 0 1200 340"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <g
        fill="currentColor"
        fillOpacity={farLayerOpacity}
        style={{
          transform: `translate3d(${(parallax.x * c.farParallaxXFactor).toFixed(1)}px, ${(parallax.y * c.farParallaxYFactor).toFixed(1)}px, 0)`,
        }}
      >
        <path d="M0 340 L0 266 Q180 240 360 262 T740 248 T1200 268 L1200 340 Z" />
        <rect x="65" y="218" width="38" height="122" />
        <rect x="112" y="198" width="32" height="142" />
        <rect x="280" y="210" width="44" height="130" />
        <rect x="450" y="204" width="36" height="136" />
        <rect x="742" y="192" width="48" height="148" />
        <rect x="944" y="212" width="42" height="128" />
        <rect x="1090" y="202" width="46" height="138" />
      </g>

      <g
        stroke={SKYLINE_PALETTE.midLayerStroke}
        strokeWidth="1"
        style={{
          transform: `translate3d(${(parallax.x * c.midParallaxXFactor).toFixed(1)}px, ${(parallax.y * c.midParallaxYFactor).toFixed(1)}px, 0)`,
        }}
      >
        <LandmarkMidLayer cityKey={cityKey} />
      </g>

      <g
        fill="currentColor"
        fillOpacity="0.92"
        style={{
          transform: `translate3d(${parallax.x.toFixed(1)}px, ${(parallax.y * c.nearParallaxYFactor).toFixed(1)}px, 0)`,
        }}
      >
        <path d="M0 340 L0 310 L68 310 L68 296 L124 296 L124 316 L210 316 L210 302 L276 302 L276 318 L392 318 L392 298 L452 298 L452 320 L560 320 L560 305 L635 305 L635 318 L754 318 L754 294 L828 294 L828 316 L932 316 L932 304 L1022 304 L1022 320 L1118 320 L1118 300 L1200 300 L1200 340 Z" />
      </g>
    </svg>
  );
};

function useParallaxMotion(prefersReducedMotion: boolean) {
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const c = SKYLINE_SCENE_CONSTANTS;

  useEffect(() => {
    if (prefersReducedMotion) return;
    const handleScroll = () => {
      setParallax((prev) => ({
        ...prev,
        y: Math.min(c.maxScrollParallaxY, window.scrollY * c.scrollParallaxFactor),
      }));
    };
    const handleOrientation = (evt: DeviceOrientationEvent) => {
      if (typeof evt.gamma !== 'number') return;
      const clamped = Math.max(
        -c.maxOrientationGammaDeg,
        Math.min(c.maxOrientationGammaDeg, evt.gamma)
      );
      setParallax((prev) => ({ ...prev, x: clamped * c.orientationParallaxFactor }));
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [prefersReducedMotion, c]);

  return prefersReducedMotion ? { x: 0, y: 0 } : parallax;
}

export const HeroSkylineScene: React.FC<{
  cityName: string;
  theme: ThemeTokens;
  pm25: number;
  sunXPercent?: number;
  sunYPercent?: number;
}> = React.memo(({ cityName, theme, pm25, sunXPercent = 82, sunYPercent = 18 }) => {
  const cityKey = useMemo(() => resolveCitySkyline(cityName), [cityName]);
  const prefersReducedMotion = Boolean(useReducedMotion());
  const c = SKYLINE_SCENE_CONSTANTS;
  const farLayerOpacity = Math.max(
    c.minFarOpacity,
    c.baseFarOpacity - theme.hazeOpacity * c.hazeFarOpacityFactor
  );
  const effectiveParallax = useParallaxMotion(prefersReducedMotion);

  const sunOpacity =
    theme.weatherScene === 'fog' || theme.weatherScene === 'thunder'
      ? c.dimmedSunOpacity
      : Math.max(
          c.minSunOpacity,
          c.baseSunOpacity - theme.hazeOpacity * c.hazeSunOpacityFactor
        );

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden vm-theme-transition vm-sky-gradient"
      aria-hidden="true"
    >
      <div className="absolute inset-0 vm-grain-overlay opacity-70" />
      {!prefersReducedMotion && (
        <Suspense fallback={null}>
          <HeroParticleCanvas
            theme={theme}
            pm25={pm25}
            sunXPercent={sunXPercent}
            sunYPercent={sunYPercent}
          />
        </Suspense>
      )}
      <div
        className="absolute w-16 h-16 sm:w-24 sm:h-24 rounded-full -translate-x-1/2 -translate-y-1/2 vm-theme-transition"
        style={{
          left: `${sunXPercent}%`,
          top: `${sunYPercent}%`,
          background: `radial-gradient(circle, ${theme.sunColor} 50%, transparent 100%)`,
          opacity: sunOpacity,
          boxShadow: `0 0 48px 14px ${theme.sunGlow}`,
          transition: prefersReducedMotion
            ? 'none'
            : 'left 450ms cubic-bezier(0.16, 1, 0.3, 1), top 450ms cubic-bezier(0.16, 1, 0.3, 1), opacity 400ms ease',
        }}
      />
      <WeatherOverlays theme={theme} />
      <SkylineParallaxSvg
        cityKey={cityKey}
        farLayerOpacity={farLayerOpacity}
        parallax={effectiveParallax}
      />
    </div>
  );
});

HeroSkylineScene.displayName = 'HeroSkylineScene';

export const SkylineBackdrop: React.FC<{ theme: ThemeTokens }> = React.memo(
  ({ theme }) => (
    <div
      className="pointer-events-none fixed inset-0 z-0 vm-theme-transition vm-sky-gradient"
      data-theme-category={theme.category}
      aria-hidden="true"
    >
      <div className="absolute inset-0 vm-grain-overlay opacity-75" />
    </div>
  )
);

SkylineBackdrop.displayName = 'SkylineBackdrop';

export default SkylineBackdrop;
