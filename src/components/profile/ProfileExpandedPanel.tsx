import type React from 'react';
import type {
  CityLocation,
  HouseholdGroup,
  LifestyleMode,
  UserProfile,
} from '../../types/index.ts';
import { CitySearch } from '../CitySearch.tsx';
import {
  HOUSEHOLD_OPTIONS,
  HouseholdMembersPicker,
  LIFESTYLE_OPTIONS,
  LifestylePicker,
  SamplePresetsGrid,
} from './ProfilePickers.tsx';

export { HOUSEHOLD_OPTIONS, LIFESTYLE_OPTIONS };

interface ProfileExpandedPanelProps {
  profile: UserProfile;
  activeSampleId: string | null;
  onSelectCity: (city: CityLocation) => void;
  onToggleHousehold: (group: HouseholdGroup) => void;
  onChangeLifestyle: (lifestyle: LifestyleMode) => void;
  onChangePurifier: (hasPurifier: boolean) => void;
  onApplySample: (sampleId: string) => void;
  cityInputRef?: React.RefObject<HTMLInputElement | null>;
}

const PurifierSwitch: React.FC<{
  hasPurifier: boolean;
  hi: boolean;
  onChangePurifier: (hasPurifier: boolean) => void;
}> = ({ hasPurifier, hi, onChangePurifier }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
    <span className="text-xs font-medium text-slate-200">
      {hi ? 'घर में HEPA एयर प्यूरीफायर?' : 'HEPA air purifier at home?'}
    </span>
    <div
      role="group"
      aria-label={hi ? 'एयर प्यूरीफायर विकल्प' : 'Air purifier availability'}
      className="inline-flex p-1 rounded-lg bg-slate-950/60 border border-white/15"
    >
      <button
        type="button"
        aria-pressed={hasPurifier}
        onClick={() => onChangePurifier(true)}
        className={`min-h-[44px] px-4 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
          hasPurifier ? 'bg-white text-slate-950' : 'text-slate-300 hover:text-white'
        }`}
      >
        {hi ? 'हाँ' : 'Yes'}
      </button>
      <button
        type="button"
        aria-pressed={!hasPurifier}
        onClick={() => onChangePurifier(false)}
        className={`min-h-[44px] px-4 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
          !hasPurifier ? 'bg-white text-slate-950' : 'text-slate-300 hover:text-white'
        }`}
      >
        {hi ? 'नहीं' : 'No'}
      </button>
    </div>
  </div>
);

export const ProfileExpandedPanel: React.FC<ProfileExpandedPanelProps> = ({
  profile,
  activeSampleId,
  onSelectCity,
  onToggleHousehold,
  onChangeLifestyle,
  onChangePurifier,
  onApplySample,
  cityInputRef,
}) => {
  const hi = profile.language === 'hi';

  return (
    <div
      id="editable-profile-panel"
      className="mt-5 pt-5 border-t border-white/15 space-y-5"
    >
      <SamplePresetsGrid
        activeSampleId={activeSampleId}
        hi={hi}
        onApplySample={onApplySample}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-4">
          <CitySearch
            selectedCity={profile.city}
            language={profile.language}
            onSelectCity={onSelectCity}
            inputRef={cityInputRef}
          />
        </div>

        <HouseholdMembersPicker
          household={profile.household}
          hi={hi}
          onToggleHousehold={onToggleHousehold}
        />

        <LifestylePicker
          lifestyle={profile.lifestyle}
          hi={hi}
          onChangeLifestyle={onChangeLifestyle}
        />
      </div>

      <PurifierSwitch
        hasPurifier={profile.hasPurifier}
        hi={hi}
        onChangePurifier={onChangePurifier}
      />
    </div>
  );
};
