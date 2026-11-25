import React, { useMemo, useRef, useState } from 'react';
import { triggerHapticTap } from '../lib/advice/progress.ts';
import type {
  HourWindow,
  HourlyPollutantPoint,
  Language,
  NaqiCategory,
  ScrubbedHourState,
  ThemeTokens,
} from '../types/index.ts';
import {
  ScrubberHeader,
  ScrubberLiveFooter,
  ScrubberSliderTrack,
  ScrubberWindowLegend,
  buildScrubberAnnouncement,
  resolveClientXIndex,
} from './scrubber/ScrubberSubcomponents.tsx';

interface TimeScrubberProps {
  hourly: HourlyPollutantPoint[];
  activeIndex: number;
  scrubbed: ScrubbedHourState | null;
  cleanestWindow: HourWindow | null;
  worstWindow: HourWindow | null;
  category: NaqiCategory;
  theme: ThemeTokens;
  language: Language;
  onChangeIndex: (index: number) => void;
  onOpenDetails: () => void;
}

function startTrackPointerDrag(params: {
  e: React.PointerEvent<HTMLDivElement>;
  trackEl: HTMLDivElement | null;
  total: number;
  activeIndex: number;
  setDragging: (v: boolean) => void;
  onChangeIndex: (idx: number) => void;
}) {
  const { e, trackEl, total, activeIndex, setDragging, onChangeIndex } = params;
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  setDragging(true);
  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {
    // Ignore synthetic pointer events
  }
  const nextIdx = resolveClientXIndex(trackEl, e.clientX, total, activeIndex);
  if (nextIdx !== activeIndex) {
    triggerHapticTap(8);
    onChangeIndex(nextIdx);
  }
}

function moveTrackPointerDrag(params: {
  e: React.PointerEvent<HTMLDivElement>;
  dragging: boolean;
  trackEl: HTMLDivElement | null;
  total: number;
  activeIndex: number;
  onChangeIndex: (idx: number) => void;
}) {
  if (!params.dragging) return;
  const nextIdx = resolveClientXIndex(
    params.trackEl,
    params.e.clientX,
    params.total,
    params.activeIndex
  );
  if (nextIdx !== params.activeIndex) params.onChangeIndex(nextIdx);
}

function buildSliderDragProps(params: {
  trackRef: React.RefObject<HTMLDivElement | null>;
  total: number;
  activeIndex: number;
  dragging: boolean;
  setDragging: (v: boolean) => void;
  onChangeIndex: (idx: number) => void;
}) {
  return {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) =>
      startTrackPointerDrag({
        e,
        trackEl: params.trackRef.current,
        total: params.total,
        activeIndex: params.activeIndex,
        setDragging: params.setDragging,
        onChangeIndex: params.onChangeIndex,
      }),
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) =>
      moveTrackPointerDrag({
        e,
        dragging: params.dragging,
        trackEl: params.trackRef.current,
        total: params.total,
        activeIndex: params.activeIndex,
        onChangeIndex: params.onChangeIndex,
      }),
    onStopDrag: () => params.setDragging(false),
  };
}

export const TimeScrubber: React.FC<TimeScrubberProps> = React.memo(
  ({
    hourly,
    activeIndex,
    scrubbed,
    cleanestWindow,
    worstWindow,
    category,
    theme,
    language,
    onChangeIndex,
    onOpenDetails,
  }) => {
    const hi = language === 'hi';
    const trackRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);

    const maxNaqi = useMemo(() => {
      const maxVal = hourly.reduce((m, pt) => Math.max(m, pt.naqi ?? 0), 100);
      return Math.max(120, Math.ceil(maxVal / 50) * 50);
    }, [hourly]);

    const activePoint = hourly[activeIndex] ?? hourly[0];
    if (hourly.length === 0 || !activePoint) return null;
    const announcement = buildScrubberAnnouncement(scrubbed, hi);
    const dragProps = buildSliderDragProps({
      trackRef,
      total: hourly.length,
      activeIndex,
      dragging,
      setDragging,
      onChangeIndex,
    });

    return (
      <section
        aria-label={hi ? '24 घंटे टाइम स्क्रबर' : 'Next 24 hours forward time scrubber'}
        className="vm-glass-card rounded-[24px] p-5 sm:p-6 space-y-4"
      >
        <ScrubberHeader
          activeIndex={activeIndex}
          hi={hi}
          onResetToNow={() => {
            triggerHapticTap(10);
            onChangeIndex(0);
          }}
          onOpenDetails={onOpenDetails}
        />
        <ScrubberWindowLegend
          cleanestWindow={cleanestWindow}
          worstWindow={worstWindow}
          category={category}
          accent={theme.accent}
          hi={hi}
        />
        <ScrubberSliderTrack
          trackRef={trackRef}
          hourly={hourly}
          maxNaqi={maxNaqi}
          activeIndex={activeIndex}
          cleanestWindow={cleanestWindow}
          worstWindow={worstWindow}
          category={category}
          announcement={announcement}
          hi={hi}
          onChangeIndex={onChangeIndex}
          {...dragProps}
        />
        <ScrubberLiveFooter
          activePoint={activePoint}
          scrubbed={scrubbed}
          announcement={announcement}
          hi={hi}
        />
      </section>
    );
  }
);

TimeScrubber.displayName = 'TimeScrubber';
