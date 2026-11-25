// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdviceCardsGrid, VerdictAndMaskCard } from '../../components/AdviceSection.tsx';
import { AdviceCardsSkeleton } from '../../components/advice/VerdictSkeleton.tsx';
import { AqiRingGauge } from '../../components/AqiRingGauge.tsx';
import AskVayuMitra from '../../components/AskVayuMitra.tsx';
import { CitySearch } from '../../components/CitySearch.tsx';
import { DataConfidenceCard } from '../../components/DataConfidenceCard.tsx';
import { ErrorBanner } from '../../components/ErrorBanner.tsx';
import HourlyDetailsSheet from '../../components/HourlyDetailsSheet.tsx';
import { OnboardingBanner } from '../../components/OnboardingBanner.tsx';
import PhotoCheckCard from '../../components/PhotoCheckCard.tsx';
import { ProfileControls } from '../../components/ProfileControls.tsx';
import ShortcutsModal from '../../components/ShortcutsModal.tsx';
import { TimeScrubber } from '../../components/TimeScrubber.tsx';
import { computeScrubbedHourState } from '../naqi/scrubber.ts';
import { DEFAULT_PROFILE } from '../profiles/samples.ts';
import type { AdviceResponse, UserProfile } from '../../types/index.ts';
import { makeNaqiAndWeatherFixtures, SAMPLE_ADVICE } from './__fixtures__/airFixtures.ts';

const HI_PROFILE: UserProfile = {
  ...DEFAULT_PROFILE,
  household: [],
  hasPurifier: false,
  language: 'hi',
};

const GEMINI_ADVICE_WITH_CO2: AdviceResponse = {
  ...SAMPLE_ADVICE,
  source: 'gemini',
  mask: { ...SAMPLE_ADVICE.mask, recommended: false, type: 'Optional' },
  forWhom: [{ group: 'Seniors', advice: 'Avoid evening traffic.' }],
};

describe('Hindi Localization, Motion & Edge Interactions', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('animates AqiRingGauge count-up when reduced motion is off and handles TimeScrubber pointer drag + Hindi UI', () => {
    let nowMs = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      nowMs += 400;
      if (nowMs <= 800) cb(nowMs);
      return 1;
    });

    const { naqi, weather, theme } = makeNaqiAndWeatherFixtures();
    const scrubbedHi = computeScrubbedHourState({
      naqi,
      weather,
      activeIndex: 3,
      household: [],
      language: 'hi',
    });
    const onChangeIndex = vi.fn();
    const onOpenDetails = vi.fn();

    render(
      <div>
        <AqiRingGauge aqi={245} categoryLabel="खराब" theme={theme} />
        <TimeScrubber
          hourly={naqi.forwardHourly}
          activeIndex={3}
          scrubbed={scrubbedHi}
          cleanestWindow={naqi.cleanestWindow}
          worstWindow={naqi.worstWindow}
          category={naqi.category}
          theme={theme}
          language="hi"
          onChangeIndex={onChangeIndex}
          onOpenDetails={onOpenDetails}
        />
      </div>
    );

    expect(screen.getByTestId('hero-naqi-value')).toBeInTheDocument();

    const slider = screen.getByRole('slider');
    Object.defineProperty(slider, 'getBoundingClientRect', {
      value: () => ({ left: 0, width: 240, top: 0, height: 80, right: 240, bottom: 80 }),
    });
    fireEvent.pointerDown(slider, {
      button: 0,
      pointerType: 'mouse',
      pointerId: 1,
      clientX: 200,
    });
    fireEvent.pointerMove(slider, { clientX: 60 });
    fireEvent.pointerUp(slider);
    expect(onChangeIndex).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /घंटे का विवरण/i }));
    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });

  it('renders Hindi variants across VerdictAndMaskCard, AdviceCardsGrid, ErrorBanner, DataConfidenceCard, OnboardingBanner, AskVayuMitra, PhotoCheckCard, and ProfileControls', async () => {
    const { naqi, weather, theme } = makeNaqiAndWeatherFixtures();
    vi.stubGlobal('navigator', { onLine: false });

    render(
      <div>
        <ErrorBanner
          message="Network down"
          language="hi"
          isOfflineData={false}
          offlineSavedAt={null}
          onRetry={vi.fn()}
        />
        <VerdictAndMaskCard
          advice={GEMINI_ADVICE_WITH_CO2}
          loading={false}
          revealStage={3}
          language="hi"
          theme={theme}
          errorNotice="फ़ॉलबैक सलाह"
          onRetryAdvice={vi.fn()}
        />
        <AdviceCardsGrid
          advice={GEMINI_ADVICE_WITH_CO2}
          loading={false}
          revealStage={3}
          language="hi"
          theme={theme}
          completedIds={['outdoor:0']}
          planProgress={{ completed: 1, total: 3, pct: 33 }}
          onToggleDone={vi.fn()}
        />
        <AdviceCardsSkeleton />
        <DataConfidenceCard
          cityName="दिल्ली"
          naqi={naqi}
          lastUpdated={null}
          language="hi"
          theme={theme}
        />
        <OnboardingBanner
          language="hi"
          theme={theme}
          onOpenProfile={vi.fn()}
          onDismiss={vi.fn()}
        />
        <ProfileControls
          profile={HI_PROFILE}
          activeSampleId={null}
          isOpen={false}
          onToggleOpen={vi.fn()}
          onSelectCity={vi.fn()}
          onToggleHousehold={vi.fn()}
          onChangeLifestyle={vi.fn()}
          onChangePurifier={vi.fn()}
          onApplySample={vi.fn()}
        />
        <AskVayuMitra profile={HI_PROFILE} naqi={naqi} weather={weather} theme={theme} />
        <PhotoCheckCard profile={HI_PROFILE} naqi={naqi} theme={theme} />
      </div>
    );

    expect(screen.getByText(/आप अभी ऑफ़लाइन हैं/i)).toBeInTheDocument();
    expect(screen.getByTestId('advice-source-badge')).toHaveTextContent(
      'Gemini द्वारा सलाह'
    );
    expect(screen.getByText(/सामान्य परिवार/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('data-confidence-toggle'));
    expect(screen.getAllByText(/प्रतीक्षारत/).length).toBeGreaterThan(0);
  });

  it('covers ShortcutsModal Tab/Escape/close, HourlyDetailsSheet drag dismiss & Tab trap, and CitySearch clear/error', async () => {
    const { naqi, weather, theme } = makeNaqiAndWeatherFixtures();
    const scrubbedHi = computeScrubbedHourState({
      naqi,
      weather,
      activeIndex: 0,
      household: [],
      language: 'hi',
    });
    const onCloseShortcuts = vi.fn();
    const onCloseSheet = vi.fn();

    render(
      <div>
        <ShortcutsModal open language="hi" onClose={onCloseShortcuts} />
        <HourlyDetailsSheet
          open
          scrubbed={scrubbedHi}
          totalHours={naqi.forwardHourly.length}
          theme={theme}
          language="hi"
          onClose={onCloseSheet}
          onStepHour={vi.fn()}
        />
      </div>
    );

    const dialogs = screen.getAllByRole('dialog');
    const closeShortcutsBtn = screen.getByRole('button', { name: /^बंद करें$/ });
    closeShortcutsBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: false });
    fireEvent.click(closeShortcutsBtn);
    expect(onCloseShortcuts).toHaveBeenCalled();

    // Drag dismiss gesture on HourlyDetailsSheet
    const sheetDialog = dialogs[1];
    if (sheetDialog) {
      fireEvent.pointerDown(sheetDialog, { clientY: 100 });
      fireEvent.pointerMove(sheetDialog, { clientY: 220 });
      fireEvent.pointerUp(sheetDialog);
      expect(onCloseSheet).toHaveBeenCalled();
    }

    // CitySearch empty results, Clear, and error alert in Hindi
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Bad query', { status: 400 }))
    );
    render(
      <CitySearch selectedCity={HI_PROFILE.city} language="hi" onSelectCity={vi.fn()} />
    );
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'UnknownCity' } });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/शहर खोजने में समस्या आई/i);
    });

    const clearBtn = screen.getByRole('button', { name: /खोज साफ़ करें/i });
    fireEvent.click(clearBtn);
    expect(input).toHaveValue('');
  });

  it('covers assistantApi timeouts/retries/Hindi errors and AskResultPanel + PhotoResultPanel variants', async () => {
    const { postAskQuestion, postPhotoCheckApi } =
      await import('../../components/assistant/assistantApi.ts');
    const { AskResultPanel } =
      await import('../../components/assistant/AskSubcomponents.tsx');
    const { PhotoResultPanel } =
      await import('../../components/assistant/PhotoResultPanel.tsx');
    const { naqi, weather } = makeNaqiAndWeatherFixtures();

    const { AskRequestSchema } = await import('../../lib/ask/schema.ts');
    const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
      const parsed = AskRequestSchema.safeParse(JSON.parse(String(init?.body ?? '{}')));
      expect(parsed.success).toBe(true);
      return new Response(
        JSON.stringify({
          answer: 'Keep windows shut.',
          verdict: 'no',
          why: 'NAQI is Poor.',
          dataUsed: ['NAQI'],
          disclaimer: 'Advisory only',
          source: 'fallback',
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal('fetch', fetchSpy);
    const validRes = await postAskQuestion({
      question: 'Should I open windows?',
      profile: DEFAULT_PROFILE,
      naqi,
      weather,
    });
    expect(validRes.verdict).toBe('no');

    // Ask 500 -> fallback Hindi message without JSON body
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('oops', { status: 502 }))
    );
    await expect(
      postAskQuestion({ question: 'Mask?', profile: HI_PROFILE, naqi, weather })
    ).rejects.toThrow(/HTTP 502/);

    // Ask AbortError timeout branch
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('Aborted', 'AbortError');
      })
    );
    await expect(
      postAskQuestion({ question: 'Mask?', profile: DEFAULT_PROFILE, naqi, weather })
    ).rejects.toThrow(/timed out/i);

    // PhotoCheck AbortError + HTTP 500 Hindi branch
    const stripped = {
      mimeType: 'image/jpeg' as const,
      imageBase64: '/9j/mock',
      byteSize: 1024,
      previewUrl: 'blob:1',
    };
    await expect(
      postPhotoCheckApi({
        stripped,
        sceneHint: 'sky',
        naqi: null,
        hasPurifier: false,
        language: 'hi',
      })
    ).rejects.toThrow(/समय सीमा/);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('fail', { status: 500 }))
    );
    await expect(
      postPhotoCheckApi({
        stripped,
        sceneHint: 'room',
        naqi,
        hasPurifier: true,
        language: 'en',
      })
    ).rejects.toThrow(/HTTP 500/);

    render(
      <div>
        <AskResultPanel
          result={{
            answer: 'Yes walk',
            verdict: 'yes',
            why: 'Good air',
            dataUsed: ['NAQI 42'],
            disclaimer: 'Advisory only',
            source: 'fallback',
          }}
          hi={false}
        />
        <AskResultPanel
          result={{
            answer: 'सावधानी',
            verdict: 'caution',
            why: 'मध्यम हवा',
            bestTime: 'आज 14:00',
            dataUsed: ['NAQI 150'],
            disclaimer: 'केवल सलाह',
            source: 'gemini',
          }}
          hi
        />
        <PhotoResultPanel
          result={{
            observations: ['Clear horizon'],
            purifierPlacement: 'Near bed',
            ventilationTip: 'Open briefly',
            confidence: 'high',
            disclaimer: 'Not a sensor',
            source: 'fallback',
          }}
          hi={false}
        />
        <PhotoResultPanel
          result={{
            observations: ['धुंध'],
            purifierPlacement: 'बिस्तर के पास',
            ventilationTip: 'बंद रखें',
            confidence: 'low',
            disclaimer: 'माप नहीं',
            source: 'gemini',
          }}
          hi
        />
      </div>
    );
    expect(screen.getByText('Confidence: High')).toBeInTheDocument();
    expect(screen.getByText('विश्वसनीयता: सीमित')).toBeInTheDocument();
  });

  it('covers useDashboardController edge paths (editable input skip, R key, language fade timeout, share fail/hi)', async () => {
    const { renderHook } = await import('@testing-library/react');
    const { useGlobalShortcuts, useLanguageFade, usePlanProgress, useShareAirCard } =
      await import('../../hooks/useDashboardController.ts');
    const { naqi, scrubbed, theme } = makeNaqiAndWeatherFixtures();

    const onRefresh = vi.fn();
    renderHook(() =>
      useGlobalShortcuts({
        prefersReducedMotion: false,
        onFocusCitySearch: vi.fn(),
        onRefresh,
        onStepHour: vi.fn(),
        onToggleShortcuts: vi.fn(),
      })
    );
    const inp = document.createElement('input');
    document.body.appendChild(inp);
    fireEvent.keyDown(inp, { key: 'r' });
    fireEvent.keyDown(window, { key: 'R', metaKey: true });
    expect(onRefresh).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'R' });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    inp.remove();

    const setLang = vi.fn();
    const { result: fade } = renderHook(() => useLanguageFade('en', false, setLang));
    fade.current.handleLanguageChange('en');
    fade.current.handleLanguageChange('hi');
    await waitFor(() => expect(setLang).toHaveBeenCalledWith('hi'));

    const { rerender } = renderHook(
      ({ city }: { city: string }) => usePlanProgress(city, SAMPLE_ADVICE),
      { initialProps: { city: 'Delhi' } }
    );
    rerender({ city: 'Jaipur' });

    const { result: shareHi } = renderHook(() =>
      useShareAirCard({
        profile: HI_PROFILE,
        naqi,
        scrubbed,
        advice: null,
        theme,
        lastUpdated: null,
      })
    );
    await shareHi.current.handleShareCard();
    await waitFor(() => expect(shareHi.current.shareNotice).toBeTruthy());
  });

  it('covers ErrorBoundary recovery, HeroHeaderBar states, ScrubberSubcomponents edge states, CitySearch empty/outside click, and PhotoCheckCard strip errors', async () => {
    const { ErrorBoundary } = await import('../../components/ErrorBoundary.tsx');
    const { HeroHeaderBar } = await import('../../components/hero/HeroHeaderBar.tsx');
    const {
      ScrubberHeader,
      ScrubberLiveFooter,
      ScrubberWindowLegend,
      buildScrubberAnnouncement,
    } = await import('../../components/scrubber/ScrubberSubcomponents.tsx');
    const { naqi } = makeNaqiAndWeatherFixtures();

    expect(buildScrubberAnnouncement(null, false)).toBe('');

    const spyErr = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Broken: React.FC = () => {
      throw new Error('boom');
    };
    const { unmount: unmountErr } = render(
      <ErrorBoundary language="hi">
        <Broken />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/कुछ अनपेक्षित समस्या/);
    fireEvent.click(screen.getByRole('button', { name: /ऐप रीलोड करें/ }));
    spyErr.mockRestore();
    unmountErr();

    const firstPoint = { ...naqi.forwardHourly[0]!, naqi: null, pm2_5: null, pm10: null };
    const onResetToNow = vi.fn();
    const { unmount: unmountHeader } = render(
      <div>
        <HeroHeaderBar
          city={{
            id: 1,
            name: 'Jaipur',
            latitude: 26.9,
            longitude: 75.8,
          }}
          naqi={{ ...naqi, basis: 'rolling_24h' }}
          scrubbed={null}
          scrubbedDayLabel="Today"
          loading={false}
          isOfflineData
          formattedUpdated="10:30"
          sharing
          shareNotice="Air card saved"
          hi={false}
          onRefresh={vi.fn()}
          onShareCard={vi.fn()}
        />
        <ScrubberHeader
          activeIndex={0}
          hi={false}
          onResetToNow={onResetToNow}
          onOpenDetails={vi.fn()}
        />
        <ScrubberWindowLegend
          cleanestWindow={null}
          worstWindow={null}
          category="Good"
          hi={false}
        />
        <ScrubberLiveFooter
          activePoint={firstPoint}
          scrubbed={null}
          announcement="Live"
          hi={false}
        />
      </div>
    );
    expect(screen.getByText('Rolling 24h avg')).toBeInTheDocument();
    expect(screen.getByText('Air card saved')).toBeInTheDocument();
    unmountHeader();

    // CitySearch empty result, query < 2 reset, outside mousedown close, focus reopen
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              results: [
                {
                  id: 99,
                  name: 'Kota',
                  latitude: 25.2,
                  longitude: 75.8,
                  country: 'India',
                  country_code: 'IN',
                },
              ],
            }),
            { status: 200 }
          )
      )
    );
    const { unmount } = render(
      <CitySearch
        selectedCity={DEFAULT_PROFILE.city}
        language="en"
        onSelectCity={vi.fn()}
      />
    );
    const combobox = screen.getByRole('combobox');
    fireEvent.change(combobox, { target: { value: 'Kot' } });
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Kota/ })).toBeInTheDocument();
    });
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.focus(combobox);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(combobox, { key: 'ArrowUp' });
    fireEvent.keyDown(combobox, { key: 'Escape' });
    fireEvent.change(combobox, { target: { value: 'K' } });
    unmount();

    // PhotoCheckCard invalid file + decode/exif error paths in Hindi
    const exifMod = await import('../../lib/vision/exifStrip.ts');
    const validateSpy = vi
      .spyOn(exifMod, 'validatePhotoFile')
      .mockReturnValueOnce({ valid: false })
      .mockReturnValue({ valid: true });
    vi.spyOn(exifMod, 'stripExifFromImage').mockRejectedValue('non-error-failure');
    const { unmount: unmountPhoto } = render(
      <PhotoCheckCard
        profile={HI_PROFILE}
        naqi={null}
        theme={makeNaqiAndWeatherFixtures().theme}
      />
    );
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const fakeFile = new File(['abc'], 'sky.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [fakeFile] } });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/अमान्य फ़ोटो/);
    });
    fireEvent.change(fileInput, { target: { files: [fakeFile] } });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/फ़ोटो प्रोसेस करने में समस्या/);
    });
    validateSpy.mockRestore();
    unmountPhoto();
  });
});
