import type React from 'react';
import { CheckCircle2, Clock, Flame, Info, RotateCcw } from 'lucide-react';
import type {
  HourWindow,
  HourlyPollutantPoint,
  NaqiCategory,
  ScrubbedHourState,
  WindowDayLabel,
} from '../../types/index.ts';

export { ScrubberSliderTrack, resolveClientXIndex } from './ScrubberTrack.tsx';

function dayLabelText(day: WindowDayLabel, hi: boolean): string {
  if (!hi) return day;
  return day === 'Today' ? 'आज' : 'कल';
}

function getCleanWord(category: NaqiCategory, hi: boolean): string {
  if (category === 'Good') return hi ? 'स्वच्छ समय:' : 'Cleanest:';
  return hi ? 'न्यूनतम प्रदूषण:' : 'Lowest-AQI:';
}

function getIstTag(isCurrentHour: boolean, hi: boolean): string {
  if (isCurrentHour) return hi ? '(अभी)' : 'IST (Now)';
  return hi ? '' : 'IST';
}

export function buildScrubberAnnouncement(
  scrubbed: ScrubbedHourState | null,
  hi: boolean
): string {
  if (!scrubbed) return '';
  const day = dayLabelText(scrubbed.dayLabel, hi);
  return hi
    ? `${day} ${scrubbed.hourLabel}: वायु सूचकांक ${scrubbed.aqi}, ${scrubbed.verdictLabel}। ${scrubbed.verdictLine}`
    : `${day} ${scrubbed.hourLabel}: NAQI ${scrubbed.aqi}, ${scrubbed.verdictLabel}. ${scrubbed.verdictLine}`;
}

export const ScrubberHeader: React.FC<{
  activeIndex: number;
  hi: boolean;
  onResetToNow: () => void;
  onOpenDetails: () => void;
}> = ({ activeIndex, hi, onResetToNow, onOpenDetails }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <div>
      <h2 className="font-display text-lg font-semibold text-white">
        {hi ? '24 घंटे समय स्क्रबर' : 'Next 24h time scrubber'}
      </h2>
      <p className="text-xs text-slate-300 mt-0.5">
        {hi
          ? 'किसी भी घंटे पर टैप, ड्रैग या तीर कुंजी से स्क्रब करें — ऊपर का पूरा दृश्य लाइव बदलता है।'
          : 'Drag, tap, or use arrow keys to preview any hour live in the hero scene.'}
      </p>
    </div>

    <div className="flex flex-wrap items-center gap-2">
      {activeIndex !== 0 && (
        <button
          type="button"
          onClick={onResetToNow}
          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white text-slate-950 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-100 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{hi ? 'अभी पर लौटें' : 'Back to now'}</span>
        </button>
      )}

      <button
        type="button"
        onClick={onOpenDetails}
        className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-950/65 border border-white/20 text-xs font-medium text-white hover:bg-slate-900/85 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <Info className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{hi ? 'घंटे का विवरण' : 'Hour details'}</span>
      </button>
    </div>
  </div>
);

export const ScrubberWindowLegend: React.FC<{
  cleanestWindow: HourWindow | null;
  worstWindow: HourWindow | null;
  category: NaqiCategory;
  accent?: string;
  hi: boolean;
}> = ({ cleanestWindow, worstWindow, category, hi }) => (
  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-200">
    <span className="inline-flex items-center gap-1.5">
      <Clock className="w-3.5 h-3.5 text-sky-300" aria-hidden="true" />
      <span>{hi ? 'अभी (पहला बार)' : 'Now (1st bar)'}</span>
    </span>
    {cleanestWindow && (
      <span className="inline-flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 vm-accent-text" aria-hidden="true" />
        <span>
          {getCleanWord(category, hi)}{' '}
          <strong className="font-mono-tabular text-white">
            {dayLabelText(cleanestWindow.dayLabel, hi)} {cleanestWindow.startHour}–
            {cleanestWindow.endHour}
          </strong>
        </span>
      </span>
    )}
    {worstWindow && (
      <span className="inline-flex items-center gap-1.5">
        <Flame className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
        <span>
          {hi ? 'अधिकतम धुंध:' : 'Peak:'}{' '}
          <strong className="font-mono-tabular text-white">
            {dayLabelText(worstWindow.dayLabel, hi)} {worstWindow.startHour}–
            {worstWindow.endHour}
          </strong>
        </span>
      </span>
    )}
  </div>
);

export const ScrubberLiveFooter: React.FC<{
  activePoint: HourlyPollutantPoint;
  scrubbed: ScrubbedHourState | null;
  announcement: string;
  hi: boolean;
}> = ({ activePoint, scrubbed, announcement, hi }) => (
  <div
    aria-live="polite"
    className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/15 text-xs text-slate-200"
  >
    <span className="font-mono-tabular font-semibold text-white">
      {dayLabelText(activePoint.dayLabel, hi)} · {activePoint.hourLabel}{' '}
      {getIstTag(activePoint.isCurrentHour, hi)}
    </span>
    <div className="flex flex-wrap items-center gap-3 font-mono-tabular">
      <span>
        {hi ? 'वायु सूचकांक' : 'NAQI'}{' '}
        <strong className="text-white">{scrubbed?.aqi ?? activePoint.naqi ?? '—'}</strong>
      </span>
      <span aria-hidden="true">·</span>
      <span>
        PM2.5{' '}
        <strong className="text-white">
          {scrubbed?.pm25 ?? activePoint.pm2_5 ?? '—'}
        </strong>{' '}
        µg/m³
      </span>
      <span aria-hidden="true">·</span>
      <span>
        PM10{' '}
        <strong className="text-white">
          {scrubbed?.pm10 ?? activePoint.pm10 ?? '—'}
        </strong>{' '}
        µg/m³
      </span>
    </div>
    <span className="sr-only">{announcement}</span>
  </div>
);
