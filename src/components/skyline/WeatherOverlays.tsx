import type React from 'react';
import type { ThemeTokens } from '../../types/index.ts';
import { SKYLINE_PALETTE, SKYLINE_SCENE_CONSTANTS } from './skylinePalette.ts';

const CloudOverlaySvg: React.FC<{ isThunder: boolean }> = ({ isThunder }) => (
  <svg
    width="1200"
    height="220"
    className="vm-cloud absolute inset-x-[-6%] top-0 w-[112%] h-[58%]"
    viewBox="0 0 1200 220"
    preserveAspectRatio="xMidYMin slice"
    aria-hidden="true"
    focusable="false"
  >
    <g
      fill={isThunder ? SKYLINE_PALETTE.cloudThunderFill : SKYLINE_PALETTE.cloudDayFill}
      fillOpacity={isThunder ? 0.55 : 0.16}
    >
      <ellipse cx="220" cy="65" rx="150" ry="38" />
      <ellipse cx="320" cy="52" rx="115" ry="34" />
      <ellipse cx="860" cy="76" rx="170" ry="42" />
      <ellipse cx="970" cy="60" rx="120" ry="34" />
    </g>
  </svg>
);

const ThunderOverlay: React.FC = () => (
  <>
    <div className="vm-thunder absolute inset-0 bg-indigo-100" />
    <svg
      width="40"
      height="100"
      className="absolute right-[24%] top-[18%] w-10 h-24 text-amber-200/75"
      viewBox="0 0 40 100"
      aria-hidden="true"
      focusable="false"
    >
      <polygon points="22,4 8,50 20,50 14,92 34,42 22,42" fill="currentColor" />
    </svg>
  </>
);

const FogDriftOverlay: React.FC<{ theme: ThemeTokens }> = ({ theme }) => {
  const isFog = theme.weatherScene === 'fog';
  const tint1 = isFog ? SKYLINE_PALETTE.fogTintPrimary : theme.hazeColor;
  const tint2 = isFog ? SKYLINE_PALETTE.fogTintSecondary : theme.hazeColor;

  return (
    <>
      <div
        className="vm-fog-layer absolute inset-x-[-10%] bottom-[20%] h-36"
        style={{
          background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${tint1} 0%, transparent 75%)`,
          opacity: isFog ? 0.78 : theme.hazeOpacity * 0.85,
        }}
      />
      <div
        className="vm-fog-layer absolute inset-x-[-12%] bottom-[4%] h-40"
        style={{
          background: `radial-gradient(ellipse 65% 55% at 50% 50%, ${tint2} 0%, transparent 75%)`,
          animationDelay: '-6s',
          opacity: isFog ? 0.82 : theme.hazeOpacity * 0.9,
        }}
      />
    </>
  );
};

export const WeatherOverlays: React.FC<{ theme: ThemeTokens }> = ({ theme }) => {
  const scene = theme.weatherScene;
  const showClouds = scene === 'cloudy' || scene === 'rain' || scene === 'thunder';
  const showFog =
    scene === 'fog' || theme.hazeOpacity >= SKYLINE_SCENE_CONSTANTS.fogOverlayThreshold;

  return (
    <>
      {showClouds && <CloudOverlaySvg isThunder={scene === 'thunder'} />}
      {scene === 'thunder' && <ThunderOverlay />}
      {showFog && <FogDriftOverlay theme={theme} />}
    </>
  );
};
