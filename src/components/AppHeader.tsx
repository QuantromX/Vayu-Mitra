import type React from 'react';
import { HelpCircle } from 'lucide-react';
import type { Language, ScrubbedHourState, ThemeTokens } from '../types/index.ts';

interface AppHeaderProps {
  cityName: string;
  language: Language;
  scrolledCompact: boolean;
  scrubbed: ScrubbedHourState | null;
  theme?: ThemeTokens;
  onOpenShortcuts: () => void;
  onChangeLanguage: (lang: Language) => void;
}

const LanguageToggleButtons: React.FC<{
  language: Language;
  hi: boolean;
  onChangeLanguage: (lang: Language) => void;
}> = ({ language, hi, onChangeLanguage }) => (
  <div
    role="group"
    aria-label={hi ? 'भाषा चुनें' : 'Select language'}
    className="inline-flex p-0.5 rounded-lg bg-slate-950/75 border border-white/20 shrink-0"
  >
    <button
      type="button"
      aria-pressed={language === 'en'}
      onClick={() => onChangeLanguage('en')}
      className={`min-h-[44px] min-w-[44px] px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
        language === 'en' ? 'bg-white text-slate-950' : 'text-slate-200 hover:text-white'
      }`}
    >
      EN
    </button>
    <button
      type="button"
      aria-pressed={language === 'hi'}
      onClick={() => onChangeLanguage('hi')}
      className={`min-h-[44px] min-w-[44px] px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
        language === 'hi' ? 'bg-white text-slate-950' : 'text-slate-200 hover:text-white'
      }`}
    >
      हिन्दी
    </button>
  </div>
);

export const AppHeader: React.FC<AppHeaderProps> = ({
  cityName,
  language,
  scrolledCompact,
  scrubbed,
  onOpenShortcuts,
  onChangeLanguage,
}) => {
  const hi = language === 'hi';

  return (
    <header className="sticky top-0 z-30 h-14 bg-slate-950/95 backdrop-blur-md border-b border-white/10">
      <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <a
            href="#main-content"
            className="min-h-[44px] inline-flex items-center font-display text-lg font-semibold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-md px-1"
          >
            {hi ? 'वायुमित्र' : 'VayuMitra'}
          </a>

          {scrolledCompact && scrubbed && (
            <div
              data-testid="sticky-compact-readout"
              className="flex items-center gap-2 min-w-0 pl-2.5 border-l border-white/15 text-xs"
            >
              <span className="font-medium text-white truncate max-w-[132px] sm:max-w-[180px]">
                {cityName}
              </span>
              <span className="font-mono-tabular font-semibold px-2 py-0.5 rounded-md shrink-0 vm-accent-pill">
                {scrubbed.aqi}
              </span>
              <span className="hidden sm:inline text-slate-200 font-medium truncate">
                {scrubbed.verdictLabel}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenShortcuts}
            aria-label={hi ? 'कीबोर्ड शॉर्टकट (?)' : 'Keyboard shortcuts (?)'}
            className="hidden sm:inline-flex min-h-[44px] min-w-[44px] rounded-xl bg-slate-950/75 border border-white/20 text-slate-200 hover:text-white hover:bg-white/10 items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <HelpCircle className="w-4 h-4" aria-hidden="true" />
          </button>

          <LanguageToggleButtons
            language={language}
            hi={hi}
            onChangeLanguage={onChangeLanguage}
          />
        </div>
      </div>
    </header>
  );
};
