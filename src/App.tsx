import { AppHeader } from './components/AppHeader.tsx';
import { AppMainBody, AppModals } from './components/AppMainBody.tsx';
import { SkylineBackdrop } from './components/SkylineBackdrop.tsx';
import { useAppDashboard } from './hooks/useAppLayoutState.ts';

export default function App() {
  const d = useAppDashboard();
  const { profile } = d.userState;
  const hi = profile.language === 'hi';

  return (
    <div
      className="relative min-h-screen text-slate-50"
      data-naqi-category={d.theme.category}
      data-weather-scene={d.theme.weatherScene}
      data-is-day={String(d.theme.isDay)}
    >
      <SkylineBackdrop theme={d.theme} />

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:min-h-[44px] focus:inline-flex focus:items-center focus:px-4 focus:py-2 focus:rounded-xl focus:bg-white focus:text-slate-950 focus:text-xs focus:font-semibold focus:shadow-2xl focus:outline-none focus:ring-2 focus:ring-slate-950"
      >
        {hi ? 'मुख्य सामग्री पर जाएँ' : 'Skip to main content'}
      </a>

      <AppHeader
        cityName={profile.city.name}
        language={profile.language}
        scrolledCompact={d.scrolledCompact}
        scrubbed={d.scrubbed}
        theme={d.theme}
        onOpenShortcuts={() => d.setShortcutsOpen(true)}
        onChangeLanguage={d.handleLanguageChange}
      />

      <AppMainBody d={d} />

      <AppModals
        detailsOpen={d.detailsOpen}
        shortcutsOpen={d.shortcutsOpen}
        scrubbed={d.scrubbed}
        totalForwardHours={d.totalForwardHours}
        theme={d.theme}
        language={profile.language}
        onCloseDetails={() => d.setDetailsOpen(false)}
        onCloseShortcuts={() => d.setShortcutsOpen(false)}
        onStepHour={d.handleStepHour}
      />
    </div>
  );
}
