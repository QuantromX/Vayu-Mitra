import React, { useState } from 'react';
import { CATEGORY_HINDI } from '../lib/shared/domain.ts';
import type {
  CityLocation,
  Language,
  NaqiResult,
  ScrubbedHourState,
  ThemeTokens,
} from '../types/index.ts';
import { AqiRingGauge } from './AqiRingGauge.tsx';
import { HeroSkylineScene } from './SkylineBackdrop.tsx';
import {
  HeroHeaderBar,
  HeroLoadingSkeleton,
  HeroTelemetryStrip,
  NaqiCategoryBadgeRow,
  VerdictIcon,
} from './hero/HeroSubcomponents.tsx';
import {
  deriveHeroMetrics,
  formatUpdatedTime,
  getWindowDescriptor,
} from './hero/heroHelpers.ts';

export { CATEGORY_HINDI };

interface HeroReadoutProps {
  city: CityLocation;
  naqi: NaqiResult | null;
  scrubbed: ScrubbedHourState | null;
  theme: ThemeTokens;
  loading: boolean;
  lastUpdated: Date | null;
  isOfflineData?: boolean;
  language: Language;
  sharing: boolean;
  shareNotice: string | null;
  onRefresh: () => void;
  onShareCard: () => void;
}

const HeroMainDisplay: React.FC<{
  naqi: NaqiResult;
  scrubbed: ScrubbedHourState;
  metrics: ReturnType<typeof deriveHeroMetrics>;
  theme: ThemeTokens;
  rangesOpen: boolean;
  hi: boolean;
  onToggleRanges: () => void;
}> = ({ naqi, scrubbed, metrics, theme, rangesOpen, hi, onToggleRanges }) => (
  <>
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <AqiRingGauge
          aqi={metrics.activeAqi}
          categoryLabel={metrics.categoryLabel}
          theme={theme}
        />

        <div className="space-y-3">
          <NaqiCategoryBadgeRow
            categoryLabel={metrics.categoryLabel}
            activeDominant={metrics.activeDominant}
            theme={theme}
            rangesOpen={rangesOpen}
            hi={hi}
            onToggleRanges={onToggleRanges}
          />

          <div className="flex flex-wrap items-center gap-2.5">
            <span
              data-testid="hero-verdict-pill"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold tracking-wide whitespace-nowrap shadow-sm vm-accent-pill"
            >
              <VerdictIcon level={scrubbed.verdictPill} />
              <span>{scrubbed.verdictLabel}</span>
            </span>
            <span
              className="text-sm sm:text-base font-medium text-white leading-snug"
              aria-live="polite"
            >
              {scrubbed.verdictLine}
            </span>
          </div>
        </div>
      </div>

      {naqi.cleanestWindow && (
        <div className="text-xs md:text-right text-slate-200 space-y-0.5 bg-slate-950/60 border border-white/15 rounded-2xl px-4 py-3 shrink-0">
          <div className="text-slate-300">
            {getWindowDescriptor(metrics.activeCategory, hi)}
          </div>
          <div className="font-mono-tabular text-sm font-semibold text-white">
            {metrics.cleanDayLabel} {naqi.cleanestWindow.startHour}–
            {naqi.cleanestWindow.endHour}
          </div>
        </div>
      )}
    </div>

    <HeroTelemetryStrip
      activePm25={metrics.activePm25}
      activePm10={metrics.activePm10}
      temperatureC={scrubbed.temperatureC}
      humidityPct={scrubbed.humidityPct}
      windSpeedKmh={scrubbed.windSpeedKmh}
      hi={hi}
    />
  </>
);

export const HeroReadout: React.FC<HeroReadoutProps> = React.memo(
  ({
    city,
    naqi,
    scrubbed,
    theme,
    loading,
    lastUpdated,
    isOfflineData = false,
    language,
    sharing,
    shareNotice,
    onRefresh,
    onShareCard,
  }) => {
    const hi = language === 'hi';
    const [rangesOpen, setRangesOpen] = useState(false);
    const formattedUpdated = formatUpdatedTime(lastUpdated);
    const metrics = deriveHeroMetrics({ naqi, scrubbed, hi });

    return (
      <section
        aria-label={hi ? 'वर्तमान वायु गुणवत्ता दृश्य' : 'Live air quality hero scene'}
        className="relative rounded-[28px] p-5 sm:p-8 border border-white/20 shadow-2xl min-h-[360px] sm:min-h-[400px] flex flex-col justify-between"
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-[28px] overflow-hidden"
          aria-hidden="true"
        >
          <HeroSkylineScene
            cityName={city.name}
            theme={theme}
            pm25={metrics.activePm25}
            sunXPercent={scrubbed?.sunXPercent ?? 82}
            sunYPercent={scrubbed?.sunYPercent ?? 18}
          />
          <div className="absolute inset-0 vm-hero-scrim" />
        </div>

        <div className="relative z-10 space-y-6">
          <HeroHeaderBar
            city={city}
            naqi={naqi}
            scrubbed={scrubbed}
            scrubbedDayLabel={metrics.scrubbedDayLabel}
            loading={loading}
            isOfflineData={isOfflineData}
            formattedUpdated={formattedUpdated}
            sharing={sharing}
            shareNotice={shareNotice}
            hi={hi}
            onRefresh={onRefresh}
            onShareCard={onShareCard}
          />
          {loading && !naqi && <HeroLoadingSkeleton />}
          {naqi && scrubbed && (
            <HeroMainDisplay
              naqi={naqi}
              scrubbed={scrubbed}
              metrics={metrics}
              theme={theme}
              rangesOpen={rangesOpen}
              hi={hi}
              onToggleRanges={() => setRangesOpen((prev) => !prev)}
            />
          )}
        </div>
      </section>
    );
  }
);

HeroReadout.displayName = 'HeroReadout';
