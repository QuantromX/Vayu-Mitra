import type React from 'react';
import { Suspense, lazy } from 'react';
import type { useAppDashboard } from '../hooks/useAppLayoutState.ts';
import type { Language, ScrubbedHourState, ThemeTokens } from '../types/index.ts';
import { AdviceCardsGrid, VerdictAndMaskCard } from './AdviceSection.tsx';
import { DataConfidenceCard } from './DataConfidenceCard.tsx';
import { ErrorBanner } from './ErrorBanner.tsx';
import { HeroReadout } from './HeroReadout.tsx';
import { OnboardingBanner, saveOnboardingDismissed } from './OnboardingBanner.tsx';
import { ProfileControls } from './ProfileControls.tsx';
import { TimeScrubber } from './TimeScrubber.tsx';

const HourlyDetailsSheet = lazy(() => import('./HourlyDetailsSheet.tsx'));
const ShortcutsModal = lazy(() => import('./ShortcutsModal.tsx'));
const AskVayuMitra = lazy(() => import('./AskVayuMitra.tsx'));
const PhotoCheckCard = lazy(() => import('./PhotoCheckCard.tsx'));

type DashboardState = ReturnType<typeof useAppDashboard>;

const AppFooter: React.FC<{ hi: boolean; onOpenShortcuts: () => void }> = ({
  hi,
  onOpenShortcuts,
}) => (
  <footer className="pt-5 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
    <span>{hi ? 'वायुमित्र · डेटा: Open-Meteo' : 'VayuMitra · Data: Open-Meteo'}</span>
    <div className="flex flex-wrap items-center gap-3">
      <span>
        {hi
          ? 'भारत NAQI-शैली अनुमान · केवल जानकारी हेतु मार्गदर्शन'
          : 'India NAQI-style estimate · Informational guidance only'}
      </span>
      <button
        type="button"
        onClick={onOpenShortcuts}
        className="min-h-[44px] px-2.5 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {hi ? 'शॉर्टकट (?)' : 'Shortcuts (?)'}
      </button>
    </div>
  </footer>
);

const HeroAndTimelineSection: React.FC<{ d: DashboardState }> = ({ d }) => {
  const { profile } = d.userState;
  return (
    <>
      {d.airState.error && (
        <ErrorBanner
          message={d.airState.error}
          language={profile.language}
          isOfflineData={d.airState.isOfflineData}
          offlineSavedAt={d.airState.offlineSavedAt}
          onRetry={() => d.airState.retry(true)}
        />
      )}

      <HeroReadout
        city={profile.city}
        naqi={d.airState.naqi}
        scrubbed={d.scrubbed}
        theme={d.theme}
        loading={d.airState.loading}
        lastUpdated={d.airState.lastUpdated}
        isOfflineData={d.airState.isOfflineData}
        language={profile.language}
        sharing={d.sharing}
        shareNotice={d.shareNotice}
        onRefresh={() => d.airState.retry(true)}
        onShareCard={d.handleShareCard}
      />

      {d.airState.naqi && (
        <TimeScrubber
          hourly={d.airState.naqi.forwardHourly}
          activeIndex={d.scrubIndex}
          scrubbed={d.scrubbed}
          cleanestWindow={d.airState.naqi.cleanestWindow}
          worstWindow={d.airState.naqi.worstWindow}
          category={d.airState.naqi.category}
          theme={d.theme}
          language={profile.language}
          onChangeIndex={d.setScrubIndex}
          onOpenDetails={() => d.setDetailsOpen(true)}
        />
      )}
    </>
  );
};

const ProfileAndAdviceSection: React.FC<{ d: DashboardState }> = ({ d }) => {
  const { profile } = d.userState;
  return (
    <>
      <VerdictAndMaskCard
        advice={d.adviceState.advice}
        loading={d.adviceState.loading}
        revealStage={d.adviceState.revealStage}
        language={profile.language}
        theme={d.theme}
        errorNotice={d.adviceState.error}
        onRetryAdvice={d.adviceState.retryAdvice}
      />

      {!d.onboardingDismissed && (
        <OnboardingBanner
          language={profile.language}
          theme={d.theme}
          onOpenProfile={() => {
            d.setProfileOpen(true);
            window.setTimeout(() => d.cityInputRef.current?.focus(), 60);
          }}
          onDismiss={() => {
            saveOnboardingDismissed();
            d.setOnboardingDismissed(true);
          }}
        />
      )}

      <ProfileControls
        profile={profile}
        activeSampleId={d.userState.activeSampleId}
        isOpen={d.profileOpen}
        onToggleOpen={() => d.setProfileOpen((o) => !o)}
        onSelectCity={(city) => {
          d.userState.setCity(city);
          d.setProfileOpen(false);
        }}
        onToggleHousehold={d.userState.toggleHouseholdGroup}
        onChangeLifestyle={d.userState.setLifestyle}
        onChangePurifier={d.userState.setHasPurifier}
        onApplySample={(id) => {
          d.userState.applySampleProfile(id);
          d.setProfileOpen(false);
        }}
        cityInputRef={d.cityInputRef}
      />

      <AdviceCardsGrid
        advice={d.adviceState.advice}
        loading={d.adviceState.loading}
        revealStage={d.adviceState.revealStage}
        language={profile.language}
        theme={d.theme}
        completedIds={d.completedIds}
        planProgress={d.planProgress}
        onToggleDone={d.handleToggleDone}
      />
    </>
  );
};

export const AppModals: React.FC<{
  detailsOpen: boolean;
  shortcutsOpen: boolean;
  scrubbed: ScrubbedHourState | null;
  totalForwardHours: number;
  theme: ThemeTokens;
  language: Language;
  onCloseDetails: () => void;
  onCloseShortcuts: () => void;
  onStepHour: (delta: number) => void;
}> = ({
  detailsOpen,
  shortcutsOpen,
  scrubbed,
  totalForwardHours,
  theme,
  language,
  onCloseDetails,
  onCloseShortcuts,
  onStepHour,
}) => (
  <>
    <Suspense fallback={null}>
      {detailsOpen && (
        <HourlyDetailsSheet
          open={detailsOpen}
          scrubbed={scrubbed}
          totalHours={totalForwardHours}
          theme={theme}
          language={language}
          onClose={onCloseDetails}
          onStepHour={onStepHour}
        />
      )}
    </Suspense>

    <Suspense fallback={null}>
      {shortcutsOpen && (
        <ShortcutsModal
          open={shortcutsOpen}
          language={language}
          onClose={onCloseShortcuts}
        />
      )}
    </Suspense>
  </>
);

export const AppMainBody: React.FC<{ d: DashboardState }> = ({ d }) => {
  const { profile } = d.userState;
  const hi = profile.language === 'hi';
  const mainTransition = d.prefersReducedMotion ? '' : 'transition-opacity duration-200';
  const mainOpacity = d.langFading ? 'opacity-40' : 'opacity-100';

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={`relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-16 space-y-5 focus:outline-none ${mainTransition} ${mainOpacity}`}
    >
      <HeroAndTimelineSection d={d} />
      <ProfileAndAdviceSection d={d} />

      <Suspense fallback={null}>
        <AskVayuMitra
          profile={profile}
          naqi={d.airState.naqi}
          weather={d.airState.weather}
          theme={d.theme}
        />
      </Suspense>

      <Suspense fallback={null}>
        <PhotoCheckCard profile={profile} naqi={d.airState.naqi} theme={d.theme} />
      </Suspense>

      <DataConfidenceCard
        cityName={profile.city.name}
        naqi={d.airState.naqi}
        lastUpdated={d.airState.lastUpdated}
        language={profile.language}
        theme={d.theme}
      />

      <AppFooter hi={hi} onOpenShortcuts={() => d.setShortcutsOpen(true)} />
    </main>
  );
};
