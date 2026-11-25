import type React from 'react';
import { RefreshCw, Share2, WifiOff } from 'lucide-react';
import type { CityLocation, NaqiResult, ScrubbedHourState } from '../../types/index.ts';

function getShareDesktopText(sharing: boolean, hi: boolean): string {
  if (sharing) return hi ? 'बना रहा है...' : 'Rendering...';
  return hi ? 'एयर कार्ड साझा करें' : 'Share Air Card';
}

function getTimingLabel(params: {
  scrubbed: ScrubbedHourState | null;
  scrubbedDayLabel: string;
  basis: NaqiResult['basis'] | undefined;
  hi: boolean;
}): string {
  const { scrubbed, scrubbedDayLabel, basis, hi } = params;
  if (scrubbed && !scrubbed.isLive) {
    return hi
      ? `अनुमानित समय: ${scrubbedDayLabel} ${scrubbed.hourLabel}`
      : `Preview: ${scrubbedDayLabel} ${scrubbed.hourLabel}`;
  }
  if (basis === 'rolling_24h') {
    return hi ? '24 घंटे औसत आधार' : 'Rolling 24h avg';
  }
  return hi ? 'वर्तमान माप' : 'Current reading';
}

const HeroActionButtons: React.FC<{
  hasNaqi: boolean;
  loading: boolean;
  sharing: boolean;
  hi: boolean;
  onRefresh: () => void;
  onShareCard: () => void;
}> = ({ hasNaqi, loading, sharing, hi, onRefresh, onShareCard }) => (
  <div className="flex items-center gap-2 shrink-0">
    {hasNaqi && (
      <button
        type="button"
        onClick={onShareCard}
        disabled={sharing}
        aria-label={hi ? 'एयर कार्ड साझा करें' : 'Share Air Card'}
        className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-950/65 border border-white/25 text-xs font-medium text-white hover:bg-slate-900/85 disabled:opacity-50 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <Share2 className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">{getShareDesktopText(sharing, hi)}</span>
        <span className="sm:hidden">{hi ? 'साझा करें' : 'Share'}</span>
      </button>
    )}

    <button
      type="button"
      onClick={onRefresh}
      disabled={loading}
      aria-label={hi ? 'डेटा रीफ़्रेश करें' : 'Refresh live readings'}
      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-950/65 border border-white/25 text-xs font-medium text-white hover:bg-slate-900/85 disabled:opacity-50 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      <RefreshCw
        className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
        aria-hidden="true"
      />
      <span className="hidden sm:inline">{hi ? 'रीफ़्रेश' : 'Refresh'}</span>
    </button>
  </div>
);

const HeroMetaBadges: React.FC<{
  naqiLabel: string;
  timingLabel: string;
  isOfflineData: boolean;
  formattedUpdated: string | null;
  shareNotice: string | null;
  hi: boolean;
}> = ({ naqiLabel, timingLabel, isOfflineData, formattedUpdated, shareNotice, hi }) => (
  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-200">
    <span>{naqiLabel}</span>
    <span aria-hidden="true">·</span>
    <span>{timingLabel}</span>
    <span aria-hidden="true">·</span>
    <span>{hi ? 'डेटा: Open-Meteo' : 'Data: Open-Meteo'}</span>
    {isOfflineData && (
      <>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-300 text-slate-950 font-bold">
          <WifiOff className="w-3 h-3" aria-hidden="true" />
          <span>{hi ? 'ऑफ़लाइन' : 'Offline'}</span>
        </span>
      </>
    )}
    {formattedUpdated && (
      <>
        <span aria-hidden="true">·</span>
        <span className="font-mono-tabular">
          {hi ? `अपडेट ${formattedUpdated}` : `Updated ${formattedUpdated} IST`}
        </span>
      </>
    )}
    {shareNotice && (
      <>
        <span aria-hidden="true">·</span>
        <span className="text-white font-medium" role="status">
          {shareNotice}
        </span>
      </>
    )}
  </div>
);

export const HeroHeaderBar: React.FC<{
  city: CityLocation;
  naqi: NaqiResult | null;
  scrubbed: ScrubbedHourState | null;
  scrubbedDayLabel: string;
  loading: boolean;
  isOfflineData: boolean;
  formattedUpdated: string | null;
  sharing: boolean;
  shareNotice: string | null;
  hi: boolean;
  onRefresh: () => void;
  onShareCard: () => void;
}> = ({
  city,
  naqi,
  scrubbed,
  scrubbedDayLabel,
  loading,
  isOfflineData,
  formattedUpdated,
  sharing,
  shareNotice,
  hi,
  onRefresh,
  onShareCard,
}) => {
  const timingLabel = getTimingLabel({
    scrubbed,
    scrubbedDayLabel,
    basis: naqi?.basis,
    hi,
  });
  const naqiLabel = hi ? 'भारत वायु सूचकांक अनुमान' : (naqi?.label ?? 'NAQI-style estimate');

  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-display text-2xl sm:text-4xl font-semibold tracking-tight text-white min-w-0 text-balance">
          {city.name}
          {city.admin1 ? (
            <span className="text-slate-200 font-normal text-lg sm:text-2xl">
              , {city.admin1}
            </span>
          ) : null}
        </h1>

        <HeroActionButtons
          hasNaqi={Boolean(naqi)}
          loading={loading}
          sharing={sharing}
          hi={hi}
          onRefresh={onRefresh}
          onShareCard={onShareCard}
        />
      </div>

      <HeroMetaBadges
        naqiLabel={naqiLabel}
        timingLabel={timingLabel}
        isOfflineData={isOfflineData}
        formattedUpdated={formattedUpdated}
        shareNotice={shareNotice}
        hi={hi}
      />
    </div>
  );
};
