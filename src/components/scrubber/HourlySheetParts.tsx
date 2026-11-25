import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Thermometer, Wind, X } from 'lucide-react';
import { UI_LIMITS } from '../../lib/config.ts';
import type { ScrubbedHourState, ThemeTokens } from '../../types/index.ts';

function handleSheetTabNavigation(e: KeyboardEvent, container: HTMLElement | null): void {
  if (e.key !== 'Tab' || !container) return;
  const focusables = Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )
  );
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (!first || !last) return;

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export function useSheetKeyboardTrap(
  open: boolean,
  sheetRef: React.RefObject<HTMLDivElement | null>,
  closeBtnRef: React.RefObject<HTMLButtonElement | null>,
  onClose: () => void
): void {
  useEffect(() => {
    if (!open) return;
    const prevFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      handleSheetTabNavigation(e, sheetRef.current);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      prevFocus?.focus?.();
    };
  }, [open, sheetRef, closeBtnRef, onClose]);
}

export function useSheetDragDismiss(onClose: () => void) {
  const dragStartYRef = useRef<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);

  return {
    dragOffsetY,
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      dragStartYRef.current = e.clientY;
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragStartYRef.current === null) return;
      setDragOffsetY(Math.max(0, e.clientY - dragStartYRef.current));
    },
    onPointerUp: () => {
      const shouldClose = dragOffsetY > UI_LIMITS.dragDismissThresholdPx;
      setDragOffsetY(0);
      dragStartYRef.current = null;
      if (shouldClose) onClose();
    },
  };
}

export function getDayWord(dayLabel: ScrubbedHourState['dayLabel'], hi: boolean): string {
  if (!hi) return dayLabel;
  return dayLabel === 'Today' ? 'आज' : 'कल';
}

export function getNowSuffix(isLive: boolean, hi: boolean): string {
  if (!isLive) return '';
  return hi ? ' (अभी)' : ' (Now)';
}

export const HourlyMetricsList: React.FC<{
  scrubbed: ScrubbedHourState;
  hi: boolean;
}> = ({ scrubbed, hi }) => (
  <dl className="grid grid-cols-2 gap-3">
    <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5">
      <dt className="text-xs text-slate-300">PM2.5</dt>
      <dd className="font-mono-tabular text-lg font-semibold text-white mt-1">
        {scrubbed.pm25} <span className="text-xs font-normal text-slate-300">µg/m³</span>
      </dd>
    </div>
    <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5">
      <dt className="text-xs text-slate-300">PM10</dt>
      <dd className="font-mono-tabular text-lg font-semibold text-white mt-1">
        {scrubbed.pm10} <span className="text-xs font-normal text-slate-300">µg/m³</span>
      </dd>
    </div>
    <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5">
      <dt className="text-xs text-slate-300 inline-flex items-center gap-1.5">
        <Thermometer className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{hi ? 'तापमान' : 'Temperature'}</span>
      </dt>
      <dd className="font-mono-tabular text-lg font-semibold text-white mt-1">
        {scrubbed.temperatureC}°C
      </dd>
    </div>
    <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5">
      <dt className="text-xs text-slate-300 inline-flex items-center gap-1.5">
        <Wind className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{hi ? 'हवा की गति' : 'Wind speed'}</span>
      </dt>
      <dd className="font-mono-tabular text-lg font-semibold text-white mt-1">
        {scrubbed.windSpeedKmh}{' '}
        <span className="text-xs font-normal text-slate-300">km/h</span>
      </dd>
    </div>
  </dl>
);

export const HourlySheetHeader: React.FC<{
  title: string;
  hi: boolean;
  closeBtnRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}> = ({ title, hi, closeBtnRef, onClose }) => (
  <div className="flex items-start justify-between gap-3">
    <div>
      <div className="text-xs text-slate-300">
        {hi ? 'प्रति घंटा विवरण' : 'Hourly inspection'}
      </div>
      <h2 className="font-display text-xl font-semibold text-white mt-0.5">{title}</h2>
    </div>

    <button
      ref={closeBtnRef}
      type="button"
      onClick={onClose}
      aria-label={hi ? 'विवरण बंद करें' : 'Close hourly details'}
      className="min-h-[44px] min-w-[44px] rounded-xl bg-white/10 hover:bg-white/20 text-white inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      <X className="w-4 h-4" aria-hidden="true" />
    </button>
  </div>
);

export const HourlySheetFooter: React.FC<{
  index: number;
  totalHours: number;
  hi: boolean;
  onStepHour: (delta: number) => void;
}> = ({ index, totalHours, hi, onStepHour }) => (
  <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/15">
    <button
      type="button"
      disabled={index <= 0}
      onClick={() => onStepHour(-1)}
      className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-xs font-medium text-white inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      <span>{hi ? 'पिछला घंटा' : 'Prev hour'}</span>
    </button>

    <button
      type="button"
      disabled={index >= totalHours - 1}
      onClick={() => onStepHour(1)}
      className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-xs font-medium text-white inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      <span>{hi ? 'अगला घंटा' : 'Next hour'}</span>
      <ChevronRight className="w-4 h-4" aria-hidden="true" />
    </button>
  </div>
);

export const HourlyNaqiSummaryCard: React.FC<{
  scrubbed: ScrubbedHourState;
  catLabel: string;
  theme?: ThemeTokens;
  hi: boolean;
}> = ({ scrubbed, catLabel, hi }) => (
  <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/5 border border-white/15 p-4">
    <div>
      <div className="text-xs text-slate-300">
        {hi ? 'वायु सूचकांक' : 'India NAQI estimate'}
      </div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="font-display text-4xl font-light tabular-nums text-white">
          {scrubbed.aqi}
        </span>
        <span className="text-sm font-semibold vm-accent-text">{catLabel}</span>
      </div>
    </div>
    <span className="px-3 py-1.5 rounded-xl text-xs font-bold vm-accent-pill">
      {scrubbed.verdictLabel}
    </span>
  </div>
);
