import React, { useRef } from 'react';
import type { Language, ScrubbedHourState, ThemeTokens } from '../types/index.ts';
import { CATEGORY_HINDI } from './HeroReadout.tsx';
import {
  HourlyMetricsList,
  HourlyNaqiSummaryCard,
  HourlySheetFooter,
  HourlySheetHeader,
  getDayWord,
  getNowSuffix,
  useSheetDragDismiss,
  useSheetKeyboardTrap,
} from './scrubber/HourlySheetParts.tsx';

interface HourlyDetailsSheetProps {
  open: boolean;
  scrubbed: ScrubbedHourState | null;
  totalHours: number;
  theme: ThemeTokens;
  language: Language;
  onClose: () => void;
  onStepHour: (delta: number) => void;
}

const HourlyDetailsSheet: React.FC<HourlyDetailsSheetProps> = ({
  open,
  scrubbed,
  totalHours,
  theme,
  language,
  onClose,
  onStepHour,
}) => {
  const hi = language === 'hi';
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const drag = useSheetDragDismiss(onClose);

  useSheetKeyboardTrap(open, sheetRef, closeBtnRef, onClose);
  if (!open || !scrubbed) return null;

  const title = `${getDayWord(scrubbed.dayLabel, hi)} · ${scrubbed.hourLabel} IST${getNowSuffix(scrubbed.isLive, hi)}`;
  const catLabel = hi ? CATEGORY_HINDI[scrubbed.category] : scrubbed.category;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={hi ? 'प्रति घंटा वायु विवरण' : 'Hourly air quality details'}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        style={{ transform: `translate3d(0, ${drag.dragOffsetY}px, 0)` }}
        className="w-full sm:max-w-lg rounded-t-[28px] sm:rounded-[28px] bg-slate-950/95 border border-white/20 p-5 sm:p-6 shadow-2xl space-y-5"
      >
        <div
          className="w-12 h-1.5 rounded-full bg-white/30 mx-auto sm:hidden"
          aria-hidden="true"
        />
        <HourlySheetHeader
          title={title}
          hi={hi}
          closeBtnRef={closeBtnRef}
          onClose={onClose}
        />
        <HourlyNaqiSummaryCard
          scrubbed={scrubbed}
          catLabel={catLabel}
          theme={theme}
          hi={hi}
        />
        <HourlyMetricsList scrubbed={scrubbed} hi={hi} />
        <p className="text-xs text-slate-200 leading-relaxed">{scrubbed.verdictLine}</p>
        <HourlySheetFooter
          index={scrubbed.index}
          totalHours={totalHours}
          hi={hi}
          onStepHour={onStepHour}
        />
      </div>
    </div>
  );
};

export default React.memo(HourlyDetailsSheet);
