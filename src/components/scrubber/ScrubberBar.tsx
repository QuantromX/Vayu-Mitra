import type React from 'react';
import type {
  HourWindow,
  HourlyPollutantPoint,
  NaqiCategory,
} from '../../types/index.ts';

function barColorForCategory(cat: NaqiCategory | null): string {
  switch (cat) {
    case 'Good':
      return '#2dd4bf';
    case 'Satisfactory':
      return '#a3e635';
    case 'Moderate':
      return '#fbbf24';
    case 'Poor':
      return '#fb923c';
    case 'Very Poor':
      return '#f87171';
    case 'Severe':
      return '#e879f9';
    default:
      return 'rgba(255, 255, 255, 0.35)';
  }
}

function getWindowBadgeText(
  showCleanTag: boolean,
  category: NaqiCategory,
  hi: boolean
): string {
  if (!showCleanTag) return hi ? '! उच्च' : '! Peak';
  if (category === 'Good') return hi ? '✓ स्वच्छ' : '✓ Clean';
  return hi ? '✓ कम' : '✓ Low';
}

function resolveBarBorder(isNow: boolean, inClean: boolean): string {
  if (isNow) return '2px solid #ffffff';
  if (inClean) return '1px solid rgba(255,255,255,0.75)';
  return '1px solid rgba(255,255,255,0.2)';
}

function resolveBarOpacity(isSelected: boolean, inHighlight: boolean): number {
  if (isSelected) return 1;
  return inHighlight ? 0.88 : 0.62;
}

function isInsideWindow(idx: number, win: HourWindow | null): boolean {
  return win !== null && idx >= win.startIndex && idx <= win.endIndex;
}

function computeBarVisualState(params: {
  pt: HourlyPollutantPoint;
  idx: number;
  maxNaqi: number;
  activeIndex: number;
  cleanestWindow: HourWindow | null;
  worstWindow: HourWindow | null;
  category: NaqiCategory;
  hi: boolean;
}) {
  const { pt, idx, maxNaqi, activeIndex, cleanestWindow, worstWindow, category, hi } =
    params;
  const val = pt.naqi ?? 0;
  const heightPct = Math.max(14, Math.round((val / maxNaqi) * 100));
  const inClean = isInsideWindow(idx, cleanestWindow);
  const inWorst = isInsideWindow(idx, worstWindow);
  const isSelected = idx === activeIndex;
  const isNow = pt.isCurrentHour;
  const showCleanTag = inClean && idx === cleanestWindow?.startIndex;
  const showWorstTag = inWorst && idx === worstWindow?.startIndex;

  return {
    heightPct,
    isSelected,
    isNow,
    windowBadge:
      showCleanTag || showWorstTag
        ? getWindowBadgeText(showCleanTag, category, hi)
        : null,
    border: resolveBarBorder(isNow, inClean),
    opacity: resolveBarOpacity(isSelected, inClean || inWorst),
  };
}

export const ScrubberHourBar: React.FC<{
  pt: HourlyPollutantPoint;
  idx: number;
  maxNaqi: number;
  activeIndex: number;
  cleanestWindow: HourWindow | null;
  worstWindow: HourWindow | null;
  category: NaqiCategory;
  hi: boolean;
}> = ({ pt, idx, maxNaqi, activeIndex, cleanestWindow, worstWindow, category, hi }) => {
  const bar = computeBarVisualState({
    pt,
    idx,
    maxNaqi,
    activeIndex,
    cleanestWindow,
    worstWindow,
    category,
    hi,
  });

  return (
    <div
      className={`relative flex flex-col items-center justify-end h-full min-h-[44px] rounded-md transition-colors ${
        bar.isSelected ? 'bg-white/15' : ''
      }`}
    >
      {bar.isNow && (
        <span className="absolute -top-6 left-0 text-xs font-semibold whitespace-nowrap text-sky-200">
          {hi ? 'अभी' : 'Now'}
        </span>
      )}
      {!bar.isNow && bar.windowBadge && (
        <span className="absolute -top-6 left-0 text-xs font-semibold whitespace-nowrap text-white">
          {bar.windowBadge}
        </span>
      )}
      <span className="flex-1 w-full flex items-end px-[1px]">
        <span
          className={`w-full rounded-t-md transition-transform duration-150 origin-bottom ${
            bar.isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-950' : ''
          }`}
          style={{
            height: `${bar.heightPct}%`,
            backgroundColor: barColorForCategory(pt.category),
            opacity: bar.opacity,
            border: bar.border,
          }}
        />
      </span>
      <span
        className={`h-5 leading-5 text-xs font-mono-tabular mt-1 ${
          bar.isSelected ? 'text-white font-semibold' : 'text-slate-300'
        }`}
      >
        {idx % 4 === 0 ? pt.hourLabel.slice(0, 2) : '\u00A0'}
      </span>
    </div>
  );
};
