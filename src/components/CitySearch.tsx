import type React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { searchIndianCities } from '../lib/api/openMeteo.ts';
import { UI_LIMITS } from '../lib/config.ts';
import type { CityLocation, Language } from '../types/index.ts';
import {
  CitySearchInputBox,
  CitySuggestionsListbox,
  handleAutocompleteKeyDown,
} from './search/CitySearchParts.tsx';

interface CitySearchProps {
  selectedCity: CityLocation;
  language: Language;
  onSelectCity: (city: CityLocation) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

function useCityAutocomplete(
  containerRef: React.RefObject<HTMLDivElement | null>,
  hi: boolean,
  onSelectCity: (city: CityLocation) => void
) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CityLocation[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await searchIndianCities(trimmed, controller.signal);
        setResults(items);
        setOpen(true);
        setActiveIndex(items.length > 0 ? 0 : -1);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(hi ? 'शहर खोजने में समस्या आई।' : 'Unable to search cities right now.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, UI_LIMITS.citySearchDebounceMs);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, hi]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        e.target instanceof Node &&
        !containerRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [containerRef]);

  const commitSelection = (city: CityLocation) => {
    onSelectCity(city);
    setQuery('');
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
  };

  return {
    query,
    open,
    loading,
    error,
    results,
    activeIndex,
    setQuery,
    setOpen,
    setLoading,
    setError,
    setResults,
    setActiveIndex,
    commitSelection,
  };
}

function buildAutocompleteHandlers(state: ReturnType<typeof useCityAutocomplete>) {
  return {
    onChangeText: (val: string) => {
      state.setQuery(val);
      if (val.trim().length >= 2) {
        state.setOpen(true);
      } else {
        state.setResults([]);
        state.setLoading(false);
        state.setError(null);
      }
    },
    onFocusOpen: () => {
      if (state.results.length > 0) state.setOpen(true);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) =>
      handleAutocompleteKeyDown({
        e,
        open: state.open,
        results: state.results,
        activeIndex: state.activeIndex,
        setActiveIndex: state.setActiveIndex,
        setOpen: state.setOpen,
        commitSelection: state.commitSelection,
      }),
    onClear: () => {
      state.setQuery('');
      state.setResults([]);
      state.setOpen(false);
    },
  };
}

export const CitySearch: React.FC<CitySearchProps> = ({
  selectedCity,
  language,
  onSelectCity,
  inputRef,
}) => {
  const hi = language === 'hi';
  const listboxId = useId();
  const inputId = useId();
  const errorId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const state = useCityAutocomplete(containerRef, hi, onSelectCity);
  const handlers = buildAutocompleteHandlers(state);
  const placeholder = selectedCity.admin1
    ? `${selectedCity.name}, ${selectedCity.admin1}`
    : selectedCity.name;
  const showDropdown =
    state.open && (state.query.trim().length >= 2 || Boolean(state.error));

  return (
    <div ref={containerRef} className="relative">
      <label
        htmlFor={inputId}
        className="block text-xs font-medium text-slate-300 mb-1.5"
      >
        {hi ? 'भारतीय शहर चुनें' : 'Indian city'}
      </label>

      <CitySearchInputBox
        inputRef={inputRef}
        inputId={inputId}
        listboxId={listboxId}
        errorId={errorId}
        placeholder={placeholder}
        hi={hi}
        query={state.query}
        open={state.open}
        loading={state.loading}
        error={state.error}
        activeIndex={state.activeIndex}
        {...handlers}
      />

      {showDropdown && (
        <CitySuggestionsListbox
          listboxId={listboxId}
          errorId={errorId}
          hi={hi}
          error={state.error}
          loading={state.loading}
          results={state.results}
          activeIndex={state.activeIndex}
          onSelect={state.commitSelection}
        />
      )}
    </div>
  );
};
