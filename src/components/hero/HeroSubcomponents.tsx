import type React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CloudSun,
  Flame,
  Info,
  Leaf,
  ShieldAlert,
  ShieldCheck,
  Skull,
} from 'lucide-react';
import { NAQI_CATEGORY_RANGES } from '../../lib/naqi/naqi.ts';
import type { ThemeTokens, VerdictPillLevel } from '../../types/index.ts';

export { HeroHeaderBar } from './HeroHeaderBar.tsx';

export const HeroLoadingSkeleton: React.FC = () => (
  <div className="py-4 flex flex-col sm:flex-row items-center gap-6" aria-busy="true">
    <div className="w-[172px] h-[172px] rounded-full vm-shimmer border border-white/15 shrink-0" />
    <div className="space-y-3 flex-1 w-full">
      <div className="h-8 w-44 rounded-xl vm-shimmer" />
      <div className="h-5 w-72 rounded-lg vm-shimmer" />
    </div>
  </div>
);

export const CategoryIcon: React.FC<{
  icon: ThemeTokens['badgeIcon'];
  className?: string;
}> = ({ icon, className }) => {
  switch (icon) {
    case 'shield-check':
      return <ShieldCheck className={className} aria-hidden="true" />;
    case 'leaf':
      return <Leaf className={className} aria-hidden="true" />;
    case 'cloud-sun':
      return <CloudSun className={className} aria-hidden="true" />;
    case 'alert-triangle':
      return <AlertTriangle className={className} aria-hidden="true" />;
    case 'flame':
      return <Flame className={className} aria-hidden="true" />;
    case 'skull':
      return <Skull className={className} aria-hidden="true" />;
  }
};

export const VerdictIcon: React.FC<{ level: VerdictPillLevel }> = ({ level }) => {
  if (level === 'GO')
    return <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />;
  if (level === 'CAUTION') {
    return <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />;
  }
  return <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />;
};

export const NaqiCategoryBadgeRow: React.FC<{
  categoryLabel: string;
  activeDominant: string;
  theme: ThemeTokens;
  rangesOpen: boolean;
  hi: boolean;
  onToggleRanges: () => void;
}> = ({ categoryLabel, activeDominant, theme, rangesOpen, hi, onToggleRanges }) => (
  <div className="relative flex items-center gap-2.5">
    <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-white/25 bg-slate-950/75 vm-accent-text">
      <CategoryIcon icon={theme.badgeIcon} className="w-5 h-5" />
    </span>
    <div>
      <div className="flex items-center gap-1">
        <span
          className="font-display text-xl sm:text-2xl font-semibold tracking-tight vm-accent-text"
          data-testid="hero-naqi-category"
        >
          {categoryLabel}
        </span>
        <button
          type="button"
          onClick={onToggleRanges}
          aria-expanded={rangesOpen}
          aria-controls="naqi-ranges-tooltip"
          aria-label={hi ? 'वायु सूचकांक श्रेणी सीमाएँ देखें' : 'View NAQI category ranges'}
          className="min-h-[44px] min-w-[44px] -my-2 inline-flex items-center justify-center rounded-lg text-slate-200 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Info className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      <div className="text-xs text-slate-200">
        {hi ? `प्रमुख प्रदूषक: ${activeDominant}` : `Dominant: ${activeDominant}`}
      </div>
    </div>

    {rangesOpen && (
      <div
        id="naqi-ranges-tooltip"
        role="region"
        aria-label={hi ? 'भारत वायु सूचकांक श्रेणियाँ' : 'India NAQI category ranges'}
        className="absolute left-0 top-full mt-2 z-30 w-64 rounded-2xl bg-slate-950/95 border border-white/25 p-3.5 shadow-2xl space-y-1.5"
      >
        <div className="text-xs font-semibold text-white pb-1 border-b border-white/15">
          {hi ? 'भारत वायु सूचकांक श्रेणियाँ' : 'India NAQI Ranges'}
        </div>
        {NAQI_CATEGORY_RANGES.map((item) => (
          <div
            key={item.category}
            className="flex items-center justify-between text-xs text-slate-200"
          >
            <span>{hi ? item.categoryHi : item.category}</span>
            <span className="font-mono-tabular text-white font-medium">{item.range}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

export const HeroTelemetryStrip: React.FC<{
  activePm25: number;
  activePm10: number;
  temperatureC: number;
  humidityPct: number;
  windSpeedKmh: number;
  hi: boolean;
}> = ({ activePm25, activePm10, temperatureC, humidityPct, windSpeedKmh, hi }) => (
  <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 border-t border-white/20">
    <div>
      <dt className="text-xs text-slate-300">PM2.5</dt>
      <dd className="font-mono-tabular text-base font-semibold text-white mt-0.5">
        {activePm25} <span className="text-xs font-normal text-slate-300">µg/m³</span>
      </dd>
    </div>
    <div>
      <dt className="text-xs text-slate-300">PM10</dt>
      <dd className="font-mono-tabular text-base font-semibold text-white mt-0.5">
        {activePm10} <span className="text-xs font-normal text-slate-300">µg/m³</span>
      </dd>
    </div>
    <div>
      <dt className="text-xs text-slate-300">{hi ? 'तापमान' : 'Temp'}</dt>
      <dd className="font-mono-tabular text-base font-semibold text-white mt-0.5">
        {temperatureC}°C
      </dd>
    </div>
    <div>
      <dt className="text-xs text-slate-300">{hi ? 'नमी' : 'Humidity'}</dt>
      <dd className="font-mono-tabular text-base font-semibold text-white mt-0.5">
        {humidityPct}%
      </dd>
    </div>
    <div>
      <dt className="text-xs text-slate-300">{hi ? 'हवा' : 'Wind'}</dt>
      <dd className="font-mono-tabular text-base font-semibold text-white mt-0.5">
        {windSpeedKmh} <span className="text-xs font-normal text-slate-300">km/h</span>
      </dd>
    </div>
  </dl>
);
