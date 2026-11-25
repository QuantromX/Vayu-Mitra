import type React from 'react';
import { SAMPLE_PROFILES } from '../../lib/profiles/samples.ts';
import type { HouseholdGroup, LifestyleMode } from '../../types/index.ts';

export const HOUSEHOLD_OPTIONS: Array<{
  id: HouseholdGroup;
  en: string;
  hi: string;
}> = [
  { id: 'kids', en: 'Kids', hi: 'बच्चे' },
  { id: 'seniors', en: 'Seniors', hi: 'वरिष्ठ' },
  { id: 'pregnant', en: 'Pregnant', hi: 'गर्भवती' },
  { id: 'asthma_heart', en: 'Asthma / Heart', hi: 'अस्थमा / हृदय' },
  { id: 'outdoor_worker', en: 'Outdoor worker', hi: 'बाहरी कार्य' },
];

export const LIFESTYLE_OPTIONS: Array<{
  id: LifestyleMode;
  en: string;
  hi: string;
}> = [
  { id: 'wfh', en: 'Works from home', hi: 'घर से काम' },
  { id: 'commute_metro', en: 'Metro commute', hi: 'मेट्रो यात्रा' },
  { id: 'commute_bus', en: 'Bus commute', hi: 'बस यात्रा' },
  { id: 'commute_bike', en: 'Two-wheeler', hi: 'बाइक / स्कूटर' },
  { id: 'commute_car', en: 'Car commute', hi: 'कार यात्रा' },
  { id: 'runner_walker', en: 'Runs / walks daily', hi: 'दैनिक सैर / दौड़' },
];

export const SamplePresetsGrid: React.FC<{
  activeSampleId: string | null;
  hi: boolean;
  onApplySample: (sampleId: string) => void;
}> = ({ activeSampleId, hi, onApplySample }) => (
  <div>
    <h2 className="text-xs font-semibold tracking-wide text-slate-200 mb-2.5">
      {hi ? 'त्वरित उदाहरण प्रोफ़ाइल' : 'One-tap household presets'}
    </h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
      {SAMPLE_PROFILES.map((sample) => {
        const active = activeSampleId === sample.id;
        return (
          <button
            key={sample.id}
            type="button"
            aria-pressed={active}
            onClick={() => onApplySample(sample.id)}
            className={`min-h-[44px] px-3.5 py-2.5 rounded-xl text-left transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              active
                ? 'bg-white/20 border-white/60 text-white'
                : 'bg-slate-950/45 border-white/15 text-slate-200 hover:bg-white/10 hover:border-white/30'
            }`}
          >
            <div className="text-xs font-semibold truncate">
              {hi ? sample.labelHi : sample.label}
            </div>
            <div className="text-xs text-slate-300 truncate mt-0.5">
              {hi ? sample.subtitleHi : sample.subtitle}
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

export const HouseholdMembersPicker: React.FC<{
  household: HouseholdGroup[];
  hi: boolean;
  onToggleHousehold: (group: HouseholdGroup) => void;
}> = ({ household, hi, onToggleHousehold }) => (
  <div className="lg:col-span-4">
    <span className="block text-xs font-medium text-slate-300 mb-2">
      {hi ? 'परिवार के सदस्य' : 'Household members'}
    </span>
    <div className="flex flex-wrap gap-2">
      {HOUSEHOLD_OPTIONS.map((opt) => {
        const selected = household.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onToggleHousehold(opt.id)}
            className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-medium transition-colors border whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              selected
                ? 'bg-white text-slate-950 border-white shadow-sm'
                : 'bg-slate-950/45 text-slate-200 border-white/20 hover:bg-white/12'
            }`}
          >
            {hi ? opt.hi : opt.en}
          </button>
        );
      })}
    </div>
  </div>
);

export const LifestylePicker: React.FC<{
  lifestyle: LifestyleMode;
  hi: boolean;
  onChangeLifestyle: (lifestyle: LifestyleMode) => void;
}> = ({ lifestyle, hi, onChangeLifestyle }) => (
  <div className="lg:col-span-4">
    <span className="block text-xs font-medium text-slate-300 mb-2">
      {hi ? 'दैनिक दिनचर्या और यात्रा' : 'Daily routine & commute'}
    </span>
    <div className="grid grid-cols-2 gap-2">
      {LIFESTYLE_OPTIONS.map((opt) => {
        const selected = lifestyle === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChangeLifestyle(opt.id)}
            className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              selected
                ? 'bg-white text-slate-950 border-white shadow-sm'
                : 'bg-slate-950/45 text-slate-200 border-white/20 hover:bg-white/12'
            }`}
          >
            <span className="block truncate">{hi ? opt.hi : opt.en}</span>
          </button>
        );
      })}
    </div>
  </div>
);
