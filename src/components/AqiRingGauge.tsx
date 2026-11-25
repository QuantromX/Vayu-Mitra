import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { UI_LIMITS } from '../lib/config.ts';
import type { ThemeTokens } from '../types/index.ts';

interface AqiRingGaugeProps {
  aqi: number;
  categoryLabel: string;
  theme: ThemeTokens;
}

const SIZE = UI_LIMITS.aqiRingGaugeSizePx;
const STROKE = UI_LIMITS.aqiRingGaugeStrokePx;
const RADIUS = (SIZE - STROKE * 2) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC_FRACTION = 0.75;
const ARC_LENGTH = CIRCUMFERENCE * ARC_FRACTION;

const NAQI_SEGMENTS: Array<{ start: number; end: number; color: string }> = [
  { start: 0, end: 50, color: 'rgba(45, 212, 191, 0.28)' },
  { start: 50, end: 100, color: 'rgba(163, 230, 53, 0.28)' },
  { start: 100, end: 200, color: 'rgba(251, 191, 36, 0.28)' },
  { start: 200, end: 300, color: 'rgba(251, 146, 60, 0.28)' },
  { start: 300, end: 400, color: 'rgba(248, 113, 113, 0.28)' },
  { start: 400, end: 500, color: 'rgba(232, 121, 249, 0.28)' },
];

const GaugeSvgRings: React.FC<{
  dashOffset: number;
  theme: ThemeTokens;
  reducedMotion: boolean;
}> = ({ dashOffset, theme, reducedMotion }) => (
  <svg
    width={SIZE}
    height={SIZE}
    viewBox={`0 0 ${SIZE} ${SIZE}`}
    className="w-full h-full overflow-visible"
    aria-hidden="true"
    focusable="false"
  >
    <g transform={`rotate(135 ${SIZE / 2} ${SIZE / 2})`}>
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke="var(--vm-ring-track)"
        strokeWidth={STROKE}
        strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE}`}
        strokeLinecap="round"
      />
      {NAQI_SEGMENTS.map((seg, idx) => {
        const segSpan = ((seg.end - seg.start) / UI_LIMITS.aqiRingMaxNaqi) * ARC_LENGTH;
        const segStartOffset = (seg.start / UI_LIMITS.aqiRingMaxNaqi) * ARC_LENGTH;
        return (
          <circle
            key={idx}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={seg.color}
            strokeWidth={STROKE - 4}
            strokeDasharray={`${Math.max(2, segSpan - 3)} ${CIRCUMFERENCE}`}
            strokeDashoffset={-segStartOffset}
          />
        );
      })}
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke={theme.accent}
        strokeWidth={STROKE}
        strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        style={{
          transition: reducedMotion
            ? 'none'
            : 'stroke-dashoffset 620ms cubic-bezier(0.16, 1, 0.3, 1), stroke 450ms ease',
          filter: `drop-shadow(0 0 8px ${theme.glowColor})`,
        }}
      />
    </g>
  </svg>
);

/**
 * Animated SVG AQI ring gauge with 6 subtle NAQI category bracket markers
 * and smooth count-up display (respecting prefers-reduced-motion).
 */
export const AqiRingGauge: React.FC<AqiRingGaugeProps> = React.memo(
  ({ aqi, categoryLabel, theme }) => {
    const prefersReducedMotion = Boolean(useReducedMotion());
    const clampedTarget = Math.max(
      0,
      Math.min(UI_LIMITS.aqiRingMaxNaqi, Math.round(aqi))
    );
    const [displayAqi, setDisplayAqi] = useState<number>(
      prefersReducedMotion ? clampedTarget : 0
    );
    const prevValueRef = useRef<number>(prefersReducedMotion ? clampedTarget : 0);

    useEffect(() => {
      if (prefersReducedMotion) {
        prevValueRef.current = clampedTarget;
        return;
      }
      const startVal = prevValueRef.current;
      const diff = clampedTarget - startVal;
      if (diff === 0) return;

      const durationMs = UI_LIMITS.aqiCountUpDurationMs;
      const startTime = performance.now();
      let rafId = 0;

      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplayAqi(Math.round(startVal + diff * eased));
        if (t < 1) {
          rafId = window.requestAnimationFrame(step);
        } else {
          prevValueRef.current = clampedTarget;
        }
      };

      rafId = window.requestAnimationFrame(step);
      return () => window.cancelAnimationFrame(rafId);
    }, [clampedTarget, prefersReducedMotion]);

    const shownAqi = prefersReducedMotion ? clampedTarget : displayAqi;
    const progressFraction = Math.max(
      0.02,
      Math.min(1, clampedTarget / UI_LIMITS.aqiRingMaxNaqi)
    );
    const dashOffset = ARC_LENGTH * (1 - progressFraction);

    return (
      <div className="relative inline-flex items-center justify-center w-[172px] h-[172px] sm:w-[188px] sm:h-[188px] shrink-0">
        <GaugeSvgRings
          dashOffset={dashOffset}
          theme={theme}
          reducedMotion={prefersReducedMotion}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pt-1">
          <span
            className="font-display font-extralight tabular-nums text-5xl sm:text-6xl leading-none tracking-tight text-white"
            data-testid="hero-naqi-value"
          >
            {shownAqi}
          </span>
          <span className="text-xs font-medium text-slate-300 mt-1.5">
            {categoryLabel}
          </span>
        </div>
      </div>
    );
  }
);

AqiRingGauge.displayName = 'AqiRingGauge';
