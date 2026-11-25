import type React from 'react';
import { Loader2, MapPin, Search, X } from 'lucide-react';
import { APP_CONFIG } from '../../lib/config.ts';
import type { CityLocation } from '../../types/index.ts';

export const CitySuggestionsListbox: React.FC<{
  listboxId: string;
  errorId: string;
  hi: boolean;
  error: string | null;
  loading: boolean;
  results: CityLocation[];
  activeIndex: number;
  onSelect: (city: CityLocation) => void;
}> = ({ listboxId, errorId, hi, error, loading, results, activeIndex, onSelect }) => (
  <div
    id={listboxId}
    role="listbox"
    aria-label={hi ? 'शहर सुझाव' : 'City suggestions'}
    className="absolute z-50 left-0 right-0 mt-1.5 rounded-xl bg-slate-950/95 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden"
  >
    {error && (
      <div id={errorId} role="alert" className="px-4 py-3 text-xs text-rose-200">
        {error}
      </div>
    )}
    {!error && results.length === 0 && !loading && (
      <div className="px-4 py-3 text-xs text-slate-300">
        {hi ? 'कोई भारतीय शहर नहीं मिला।' : 'No matching Indian cities found.'}
      </div>
    )}
    {!error &&
      results.map((city, idx) => {
        const isActive = idx === activeIndex;
        return (
          <button
            key={city.id}
            id={`${listboxId}-opt-${idx}`}
            type="button"
            role="option"
            aria-selected={isActive}
            onClick={() => onSelect(city)}
            className={`w-full min-h-[44px] px-3.5 py-2.5 text-left flex items-center gap-2.5 text-sm transition-colors ${
              isActive ? 'bg-white/15 text-white' : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            <MapPin className="w-4 h-4 shrink-0 text-slate-300" aria-hidden="true" />
            <span className="truncate font-medium">{city.name}</span>
            {city.admin1 && (
              <span className="text-xs text-slate-400 truncate">{city.admin1}</span>
            )}
          </button>
        );
      })}
  </div>
);

export function handleAutocompleteKeyDown(params: {
  e: React.KeyboardEvent<HTMLInputElement>;
  open: boolean;
  results: CityLocation[];
  activeIndex: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  setOpen: (v: boolean) => void;
  commitSelection: (city: CityLocation) => void;
}) {
  const { e, open, results, activeIndex, setActiveIndex, setOpen, commitSelection } =
    params;
  if (!open || results.length === 0) {
    if (e.key === 'Escape') setOpen(false);
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setActiveIndex((prev) => (prev + 1) % results.length);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
  } else if (e.key === 'Enter' && activeIndex >= 0) {
    const selected = results[activeIndex];
    if (selected) {
      e.preventDefault();
      commitSelection(selected);
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    setOpen(false);
  }
}

export const CitySearchInputBox: React.FC<{
  inputRef?: React.RefObject<HTMLInputElement | null>;
  inputId: string;
  listboxId: string;
  errorId: string;
  placeholder: string;
  hi: boolean;
  query: string;
  open: boolean;
  loading: boolean;
  error: string | null;
  activeIndex: number;
  onChangeText: (val: string) => void;
  onFocusOpen: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClear: () => void;
}> = ({
  inputRef,
  inputId,
  listboxId,
  errorId,
  placeholder,
  hi,
  query,
  open,
  loading,
  error,
  activeIndex,
  onChangeText,
  onFocusOpen,
  onKeyDown,
  onClear,
}) => {
  const activeDescendant =
    open && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined;
  return (
    <div className="relative flex items-center">
      <Search
        className="w-4 h-4 text-slate-300 absolute left-3.5 pointer-events-none"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        maxLength={APP_CONFIG.maxCityNameLength}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        aria-activedescendant={activeDescendant}
        value={query}
        onChange={(e) => onChangeText(e.target.value)}
        onFocus={onFocusOpen}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full min-h-[44px] pl-10 pr-10 py-2.5 rounded-xl bg-slate-950/55 border border-white/20 text-sm text-white placeholder:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 transition-colors"
      />
      {loading && (
        <Loader2
          className="w-4 h-4 text-slate-300 animate-spin absolute right-3.5"
          aria-label={hi ? 'खोज रहा है' : 'Searching cities'}
        />
      )}
      {!loading && query.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          aria-label={hi ? 'खोज साफ़ करें' : 'Clear city search'}
          className="absolute right-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
