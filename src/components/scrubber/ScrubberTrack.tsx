import type React from 'react';
import { triggerHapticTap } from '../../lib/advice/progress.ts';
import type {
  HourWindow,
  HourlyPollutantPoint,
  NaqiCategory,
} from '../../types/index.ts';
import { ScrubberHourBar } from './ScrubberBar.tsx';

export function handleScrubberKeyNavigation(
  key: string,
  activeIndex: number,
  total: number,
  onChangeIndex: (index: number) => void
): boolean {
  if (key === 'ArrowRight' || key === 'ArrowUp') {
    triggerHapticTap(8);
    onChangeIndex(Math.min(total - 1, activeIndex + 1));
    return true;
  }
  if (key === 'ArrowLeft' || key === 'ArrowDown') {
    triggerHapticTap(8);
    onChangeIndex(Math.max(0, activeIndex - 1));
    return true;
  }
  if (key === 'Home') {
    onChangeIndex(0);
    return true;
  }
  if (key === 'End') {
    onChangeIndex(total - 1);
    return true;
  }
  return false;
}

export function resolveClientXIndex(
  trackEl: HTMLDivElement | null,
  clientX: number,
  total: number,
  fallbackIdx: number
): number {
  if (!trackEl) return fallbackIdx;
  const rect = trackEl.getBoundingClientRect();
  if (rect.width <= 0) return fallbackIdx;
  const ratio = Math.max(0, Math.min(0.9999, (clientX - rect.left) / rect.width));
  return Math.min(total - 1, Math.floor(ratio * total));
}

export const ScrubberSliderTrack: React.FC<{
  trackRef: React.RefObject<HTMLDivElement | null>;
  hourly: HourlyPollutantPoint[];
  maxNaqi: number;
  activeIndex: number;
  cleanestWindow: HourWindow | null;
  worstWindow: HourWindow | null;
  category: NaqiCategory;
  announcement: string;
  hi: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onStopDrag: () => void;
  onChangeIndex: (idx: number) => void;
}> = ({
  trackRef,
  hourly,
  maxNaqi,
  activeIndex,
  cleanestWindow,
  worstWindow,
  category,
  announcement,
  hi,
  onPointerDown,
  onPointerMove,
  onStopDrag,
  onChangeIndex,
}) => (
  <div
    ref={trackRef}
    role="slider"
    tabIndex={0}
    aria-label={hi ? 'आगामी 24 घंटे वायु स्क्रबर' : 'Forward 24-hour NAQI scrubber'}
    aria-valuemin={0}
    aria-valuemax={hourly.length - 1}
    aria-valuenow={activeIndex}
    aria-valuetext={announcement}
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onStopDrag}
    onPointerCancel={onStopDrag}
    onKeyDown={(e) => {
      if (handleScrubberKeyNavigation(e.key, activeIndex, hourly.length, onChangeIndex)) {
        e.preventDefault();
      }
    }}
    className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[2px] sm:gap-1 items-end h-44 pt-7 px-1 rounded-2xl touch-none select-none cursor-ew-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
  >
    {hourly.map((pt, idx) => (
      <ScrubberHourBar
        key={pt.time}
        pt={pt}
        idx={idx}
        maxNaqi={maxNaqi}
        activeIndex={activeIndex}
        cleanestWindow={cleanestWindow}
        worstWindow={worstWindow}
        category={category}
        hi={hi}
      />
    ))}
  </div>
);
