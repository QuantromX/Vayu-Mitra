import type React from 'react';
import { ChevronDown, SlidersHorizontal, Sparkles } from 'lucide-react';
import { SAMPLE_PROFILES } from '../../lib/profiles/samples.ts';
import type { HouseholdGroup, LifestyleMode, UserProfile } from '../../types/index.ts';
import { HOUSEHOLD_OPTIONS, LIFESTYLE_OPTIONS } from './ProfileExpandedPanel.tsx';

function formatHouseholdSummary(household: HouseholdGroup[], hi: boolean): string {
  if (household.length === 0) return hi ? 'सामान्य परिवार' : 'General household';
  return household
    .map((id) => {
      const match = HOUSEHOLD_OPTIONS.find((o) => o.id === id);
      if (!match) return id;
      return hi ? match.hi : match.en;
    })
    .join(', ');
}

function formatLifestyleSummary(lifestyle: LifestyleMode, hi: boolean): string {
  const match = LIFESTYLE_OPTIONS.find((o) => o.id === lifestyle);
  if (!match) return lifestyle;
  return hi ? match.hi : match.en;
}

function formatPurifierLabel(hasPurifier: boolean, hi: boolean): string {
  if (hasPurifier) return hi ? 'HEPA प्यूरीफायर: हाँ' : 'Purifier: Yes';
  return hi ? 'HEPA प्यूरीफायर: नहीं' : 'Purifier: No';
}

function getEditButtonLabel(isOpen: boolean, hi: boolean): string {
  if (isOpen) return hi ? 'प्रोफ़ाइल बंद करें' : 'Done editing';
  return hi ? 'प्रोफ़ाइल बदलें' : 'Edit profile';
}

export const ProfileSummaryChips: React.FC<{ profile: UserProfile; hi: boolean }> = ({
  profile,
  hi,
}) => (
  <div className="space-y-2 min-w-0">
    <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
      <SlidersHorizontal className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>{hi ? 'सक्रिय परिवार प्रोफ़ाइल' : 'Active household profile'}</span>
    </div>

    <div className="flex flex-wrap items-center gap-2 text-xs text-white">
      <span className="px-2.5 py-1 rounded-lg bg-slate-950/60 border border-white/20 font-medium">
        {profile.city.name}
      </span>
      <span className="px-2.5 py-1 rounded-lg bg-slate-950/60 border border-white/20">
        {formatHouseholdSummary(profile.household, hi)}
      </span>
      <span className="px-2.5 py-1 rounded-lg bg-slate-950/60 border border-white/20">
        {formatLifestyleSummary(profile.lifestyle, hi)}
      </span>
      <span className="px-2.5 py-1 rounded-lg bg-slate-950/60 border border-white/20">
        {formatPurifierLabel(profile.hasPurifier, hi)}
      </span>
    </div>
  </div>
);

const SampleDropdownMenu: React.FC<{
  activeSampleId: string | null;
  hi: boolean;
  onSelectSample: (id: string) => void;
}> = ({ activeSampleId, hi, onSelectSample }) => (
  <div
    role="menu"
    aria-label={hi ? '8 भारतीय परिवार उदाहरण' : '8 Indian household samples'}
    className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl bg-slate-950/95 border border-white/25 p-2 shadow-2xl z-40 space-y-1 max-h-80 overflow-y-auto"
  >
    {SAMPLE_PROFILES.map((sample) => {
      const active = activeSampleId === sample.id;
      return (
        <button
          key={sample.id}
          type="button"
          role="menuitem"
          onClick={() => onSelectSample(sample.id)}
          className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
            active
              ? 'bg-white/20 text-white'
              : 'text-slate-200 hover:bg-white/10 hover:text-white'
          }`}
        >
          <div className="text-xs font-semibold truncate">
            {hi ? sample.labelHi : sample.label}
          </div>
          <div className="text-xs text-slate-300 truncate">
            {hi ? sample.subtitleHi : sample.subtitle}
          </div>
        </button>
      );
    })}
  </div>
);

export const ProfileActionsBar: React.FC<{
  activeSampleId: string | null;
  sampleMenuOpen: boolean;
  isOpen: boolean;
  hi: boolean;
  sampleMenuRef: React.RefObject<HTMLDivElement | null>;
  onToggleSampleMenu: () => void;
  onApplySample: (id: string) => void;
  onToggleOpen: () => void;
}> = ({
  activeSampleId,
  sampleMenuOpen,
  isOpen,
  hi,
  sampleMenuRef,
  onToggleSampleMenu,
  onApplySample,
  onToggleOpen,
}) => (
  <div className="flex flex-wrap items-center gap-2 shrink-0">
    <div className="relative" ref={sampleMenuRef}>
      <button
        type="button"
        data-testid="try-sample-btn"
        aria-haspopup="menu"
        aria-expanded={sampleMenuOpen}
        onClick={onToggleSampleMenu}
        className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-950/70 border border-white/25 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-white/15 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{hi ? 'उदाहरण चुनें' : 'Try a sample'}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-150 ${sampleMenuOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {sampleMenuOpen && (
        <SampleDropdownMenu
          activeSampleId={activeSampleId}
          hi={hi}
          onSelectSample={onApplySample}
        />
      )}
    </div>

    <button
      type="button"
      aria-expanded={isOpen}
      aria-controls="editable-profile-panel"
      onClick={onToggleOpen}
      className="min-h-[44px] px-4 py-2 rounded-xl bg-white text-slate-950 text-xs font-semibold inline-flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      <span>{getEditButtonLabel(isOpen, hi)}</span>
      <ChevronDown
        className={`w-4 h-4 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
        aria-hidden="true"
      />
    </button>
  </div>
);
