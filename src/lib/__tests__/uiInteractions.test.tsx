// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdviceCardsGrid,
  VerdictAndMaskCard,
  VerdictSkeleton,
} from '../../components/AdviceSection.tsx';
import AskVayuMitra from '../../components/AskVayuMitra.tsx';
import { CitySearch } from '../../components/CitySearch.tsx';
import { DataConfidenceCard } from '../../components/DataConfidenceCard.tsx';
import { HeroReadout } from '../../components/HeroReadout.tsx';
import HourlyDetailsSheet from '../../components/HourlyDetailsSheet.tsx';
import { OnboardingBanner } from '../../components/OnboardingBanner.tsx';
import PhotoCheckCard from '../../components/PhotoCheckCard.tsx';
import { ProfileControls } from '../../components/ProfileControls.tsx';
import { DEFAULT_PROFILE } from '../profiles/samples.ts';
import * as exifStrip from '../vision/exifStrip.ts';
import {
  makeNaqiAndWeatherFixtures,
  SAMPLE_ADVICE,
  SAMPLE_ASK_RESPONSE,
  SAMPLE_PHOTO_RESPONSE,
} from './__fixtures__/airFixtures.ts';

describe('Interactive UI Workflows (Ask, PhotoCheck, Profile, CitySearch, Hero, Advice, Sheets)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
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

  it('handles AskVayuMitra suggestions, custom submission, retry, and error display', async () => {
    const { naqi, weather, theme } = makeNaqiAndWeatherFixtures();
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        if (calls <= 2) {
          return new Response(JSON.stringify({ error: 'Invalid question' }), {
            status: 400,
          });
        }
        return new Response(JSON.stringify(SAMPLE_ASK_RESPONSE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );

    render(
      <AskVayuMitra
        profile={DEFAULT_PROFILE}
        naqi={naqi}
        weather={weather}
        theme={theme}
      />
    );

    const suggestionBtn = screen.getByRole('button', {
      name: /Can kids play cricket outside after 4 PM\?/i,
    });
    fireEvent.click(suggestionBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid question');
    });

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Should seniors walk at 7 AM?' } });
    fireEvent.click(screen.getByRole('button', { name: /^Ask$/i }));

    await waitFor(() => {
      expect(screen.getByTestId('ask-vayumitra-result')).toHaveTextContent(
        SAMPLE_ASK_RESPONSE.answer
      );
    });
  });

  it('handles PhotoCheckCard file validation, EXIF strip preview, analyze result, error, and clear', async () => {
    const { naqi, theme } = makeNaqiAndWeatherFixtures();
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(exifStrip, 'stripExifFromImage').mockResolvedValue({
      mimeType: 'image/jpeg',
      imageBase64: '/9j/mockedCleanData',
      byteSize: 2048,
      previewUrl: 'blob:stripped-preview',
    });

    let failPhotoApi = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        if (failPhotoApi) {
          return new Response(JSON.stringify({ error: 'Image rejected' }), {
            status: 400,
          });
        }
        return new Response(JSON.stringify(SAMPLE_PHOTO_RESPONSE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );

    render(<PhotoCheckCard profile={DEFAULT_PROFILE} naqi={naqi} theme={theme} />);

    // Scene hint toggle
    fireEvent.click(screen.getByRole('button', { name: 'Sky' }));
    expect(screen.getByRole('button', { name: 'Sky' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    // Invalid GIF triggers inline error alert
    const fileInput = screen.getByLabelText(/Upload or take photo/i) as HTMLInputElement;
    const badFile = new File(['gif'], 'bad.gif', { type: 'image/gif' });
    fireEvent.change(fileInput, { target: { files: [badFile] } });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/JPEG, PNG, or WebP/i);
    });

    // Valid JPEG loads preview, inspects cleanly, shows results, then clears
    const goodFile = new File(['jpg'], 'room.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [goodFile] } });
    await waitFor(() => {
      expect(
        screen.getByAltText(/Preview of locally EXIF-stripped photo/i)
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Check photo/i }));
    await waitFor(() => {
      expect(screen.getByTestId('photo-check-result')).toHaveTextContent(
        SAMPLE_PHOTO_RESPONSE.purifierPlacement
      );
    });

    failPhotoApi = true;
    fireEvent.click(screen.getByRole('button', { name: /Check photo/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Image rejected');
    });

    fireEvent.click(screen.getByRole('button', { name: /Clear selected photo/i }));
    expect(screen.queryByAltText(/Preview of locally EXIF-stripped photo/i)).toBeNull();
  });

  it('supports ProfileControls sample dropdown + pickers and CitySearch keyboard autocomplete', async () => {
    const onSelectCity = vi.fn();
    const onToggleHousehold = vi.fn();
    const onChangeLifestyle = vi.fn();
    const onChangePurifier = vi.fn();
    const onApplySample = vi.fn();
    const onToggleOpen = vi.fn();

    render(
      <ProfileControls
        profile={DEFAULT_PROFILE}
        activeSampleId="delhi-kids"
        isOpen
        onToggleOpen={onToggleOpen}
        onSelectCity={onSelectCity}
        onToggleHousehold={onToggleHousehold}
        onChangeLifestyle={onChangeLifestyle}
        onChangePurifier={onChangePurifier}
        onApplySample={onApplySample}
      />
    );

    // Sample dropdown open & select + outside dismissal
    fireEvent.click(screen.getByRole('button', { name: /Try a sample/i }));
    const mumbaiOption = await screen.findByRole('menuitem', { name: /Mumbai/i });
    fireEvent.click(mumbaiOption);
    expect(onApplySample).toHaveBeenCalledWith('mumbai-asthma');

    fireEvent.click(screen.getByRole('button', { name: /Try a sample/i }));
    fireEvent.pointerDown(document.body);

    fireEvent.click(screen.getByRole('button', { name: /^Seniors$/ }));
    expect(onToggleHousehold).toHaveBeenCalledWith('seniors');
    fireEvent.click(screen.getByRole('button', { name: /^Works from home$/ }));
    expect(onChangeLifestyle).toHaveBeenCalledWith('wfh');
    fireEvent.click(screen.getByRole('button', { name: /^No$/ }));
    expect(onChangePurifier).toHaveBeenCalledWith(false);

    // CitySearch autocomplete with keyboard navigation
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              results: [
                {
                  id: 1275339,
                  name: 'Mumbai',
                  admin1: 'Maharashtra',
                  latitude: 19.07,
                  longitude: 72.87,
                  country: 'India',
                  country_code: 'IN',
                },
                {
                  id: 1262180,
                  name: 'Nagpur',
                  admin1: 'Maharashtra',
                  latitude: 21.14,
                  longitude: 79.08,
                  country: 'India',
                  country_code: 'IN',
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
      )
    );

    const onCityPick = vi.fn();
    render(
      <CitySearch
        selectedCity={DEFAULT_PROFILE.city}
        language="en"
        onSelectCity={onCityPick}
      />
    );
    const combobox = screen.getAllByRole('combobox')[1];
    if (!combobox) throw new Error('Expected combobox');
    fireEvent.change(combobox, { target: { value: 'Mum' } });

    await waitFor(() => {
      expect(screen.getAllByRole('option').length).toBe(2);
    });
    fireEvent.keyDown(combobox, { key: 'ArrowDown' });
    fireEvent.keyDown(combobox, { key: 'ArrowUp' });
    fireEvent.keyDown(combobox, { key: 'Enter' });
    expect(onCityPick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Mumbai' }));
  });

  it('toggles Advice "Why this?", done checkboxes, HeroReadout ranges, DataConfidenceCard, OnboardingBanner, and HourlyDetailsSheet stepping', () => {
    const { naqi, scrubbed, theme } = makeNaqiAndWeatherFixtures();
    const onToggleDone = vi.fn();
    const onRetryAdvice = vi.fn();
    const onShareCard = vi.fn();
    const onOpenProfile = vi.fn();
    const onDismiss = vi.fn();
    const onStepHour = vi.fn();
    const onCloseSheet = vi.fn();

    render(
      <div>
        <HeroReadout
          city={DEFAULT_PROFILE.city}
          naqi={naqi}
          scrubbed={scrubbed}
          theme={theme}
          loading={false}
          lastUpdated={new Date('2026-11-22T10:00:00Z')}
          language="en"
          sharing={false}
          shareNotice={null}
          onRefresh={vi.fn()}
          onShareCard={onShareCard}
        />
        <HeroReadout
          city={DEFAULT_PROFILE.city}
          naqi={null}
          scrubbed={null}
          theme={theme}
          loading
          lastUpdated={null}
          language="hi"
          sharing={false}
          shareNotice={null}
          onRefresh={vi.fn()}
          onShareCard={vi.fn()}
        />
        <VerdictAndMaskCard
          advice={SAMPLE_ADVICE}
          loading={false}
          revealStage={3}
          language="en"
          theme={theme}
          errorNotice="Fallback notice"
          onRetryAdvice={onRetryAdvice}
        />
        <AdviceCardsGrid
          advice={SAMPLE_ADVICE}
          loading={false}
          revealStage={3}
          language="en"
          theme={theme}
          completedIds={[]}
          planProgress={{ completed: 0, total: 3, pct: 0 }}
          onToggleDone={onToggleDone}
        />
        <VerdictSkeleton language="en" />
        <DataConfidenceCard
          cityName="Delhi"
          naqi={naqi}
          lastUpdated={new Date('2026-11-22T10:00:00Z')}
          language="en"
          theme={theme}
        />
        <OnboardingBanner
          language="en"
          theme={theme}
          onOpenProfile={onOpenProfile}
          onDismiss={onDismiss}
        />
        <HourlyDetailsSheet
          open
          scrubbed={{ ...scrubbed, index: 2 }}
          totalHours={naqi.forwardHourly.length}
          theme={theme}
          language="en"
          onClose={onCloseSheet}
          onStepHour={onStepHour}
        />
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: /View NAQI category ranges/i }));
    expect(screen.getByText(/0–50/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Share Air Card/i }));
    expect(onShareCard).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Retry Gemini/i }));
    expect(onRetryAdvice).toHaveBeenCalledTimes(1);

    const whyBtns = screen.getAllByRole('button', { name: /Why this\?/i });
    if (whyBtns[0]) fireEvent.click(whyBtns[0]);

    const doneBtns = screen.getAllByRole('button', { name: /Mark action done/i });
    if (doneBtns[0]) fireEvent.click(doneBtns[0]);
    expect(onToggleDone).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('data-confidence-toggle'));
    expect(screen.getByText(/Open-Meteo Air Quality/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Open profile/i }));
    expect(onOpenProfile).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Next$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Got it/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Prev hour/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next hour/i }));
    expect(onStepHour).toHaveBeenNthCalledWith(1, -1);
    expect(onStepHour).toHaveBeenNthCalledWith(2, 1);
  });
});
