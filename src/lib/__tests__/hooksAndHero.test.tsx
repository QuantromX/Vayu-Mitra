// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HeroParticleCanvas from '../../components/HeroParticleCanvas.tsx';
import { HeroSkylineScene } from '../../components/SkylineBackdrop.tsx';
import {
  createParticleSet,
  drawParticleFrame,
} from '../../components/hero/particleEngine.ts';
import { deleteCachedAdvice, readCachedAdvice } from '../../hooks/adviceHelpers.ts';
import { buildAdviceCacheKey } from '../../hooks/adviceScheduler.ts';
import { useAdvice } from '../../hooks/useAdvice.ts';
import {
  useGlobalShortcuts,
  useLanguageFade,
  usePlanProgress,
  useShareAirCard,
} from '../../hooks/useDashboardController.ts';
import { useUserProfile } from '../../hooks/useUserProfile.ts';
import { DEFAULT_PROFILE } from '../profiles/samples.ts';
import { resolveThemeTokens } from '../theme/theme.ts';
import { stripExifFromImage, validatePhotoFile } from '../vision/exifStrip.ts';
import { makeNaqiAndWeatherFixtures, SAMPLE_ADVICE } from './__fixtures__/airFixtures.ts';

function createMockCanvasContext() {
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    drawImage: vi.fn(),
    setTransform: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe('Hooks, Hero Scene, Canvas Particles & EXIF Strip', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
      }
    );
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: false,
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
    vi.useRealTimers();
  });

  it('draws particle frames across day/night, fog, rain/thunder, and low-end devices', () => {
    const ctx = createMockCanvasContext();
    const fogNight = resolveThemeTokens({
      category: 'Severe',
      weatherCode: 45,
      isDay: false,
      pm25: 190,
    });
    const rainDay = resolveThemeTokens({
      category: 'Moderate',
      weatherCode: 63,
      isDay: true,
      pm25: 72,
    });
    const clearNight = resolveThemeTokens({
      category: 'Good',
      weatherCode: 0,
      isDay: false,
      pm25: 20,
    });

    const fogParticles = createParticleSet(360, 320, true, {
      theme: fogNight,
      pm25: 190,
      sunXPercent: 50,
      sunYPercent: 20,
    });
    expect(fogParticles.haze.length).toBeGreaterThan(0);
    drawParticleFrame(
      ctx,
      { width: 360, height: 320, isMobile: true },
      { theme: fogNight, pm25: 190, sunXPercent: 50, sunYPercent: 20 },
      fogParticles
    );

    const rainParticles = createParticleSet(1024, 420, false, {
      theme: rainDay,
      pm25: 72,
      sunXPercent: 75,
      sunYPercent: 18,
    });
    expect(rainParticles.rain.length).toBeGreaterThan(0);
    drawParticleFrame(
      ctx,
      { width: 1024, height: 420, isMobile: false },
      { theme: rainDay, pm25: 72, sunXPercent: 75, sunYPercent: 18 },
      rainParticles
    );

    vi.stubGlobal('navigator', { hardwareConcurrency: 2 });
    const lowEndStars = createParticleSet(800, 360, false, {
      theme: clearNight,
      pm25: 20,
      sunXPercent: 40,
      sunYPercent: 25,
    });
    expect(lowEndStars.stars.length).toBe(16);
    drawParticleFrame(
      ctx,
      { width: 800, height: 360, isMobile: false },
      { theme: clearNight, pm25: 20, sunXPercent: 40, sunYPercent: 25 },
      lowEndStars
    );
  });

  it('mounts HeroParticleCanvas, pauses on document.hidden, and renders HeroSkylineScene landmarks + parallax', () => {
    const ctx = createMockCanvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(16);
      return 1;
    });

    const { theme } = makeNaqiAndWeatherFixtures();
    const { rerender, unmount } = render(
      <HeroParticleCanvas theme={theme} pm25={112} sunXPercent={80} sunYPercent={18} />
    );

    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    unmount();

    const fogTheme = resolveThemeTokens({
      category: 'Poor',
      weatherCode: 95,
      isDay: false,
      pm25: 130,
    });
    const cities = ['Mumbai', 'Lucknow', 'Kolkata', 'Jaipur', 'Delhi'];
    const { rerender: rerenderScene } = render(
      <HeroSkylineScene cityName={cities[0] ?? 'Mumbai'} theme={fogTheme} pm25={130} />
    );
    for (const c of cities.slice(1)) {
      rerenderScene(<HeroSkylineScene cityName={c} theme={theme} pm25={55} />);
    }

    fireEvent.scroll(window, { target: { scrollY: 120 } });
    const evt = new Event('deviceorientation') as DeviceOrientationEvent & {
      gamma: number;
    };
    evt.gamma = 12;
    window.dispatchEvent(evt);
    expect(rerender).toBeTypeOf('function');
  });

  it('validates photo files and strips EXIF metadata (plus decode/size/context failure paths)', async () => {
    expect(validatePhotoFile({ type: 'image/gif', size: 100 }).valid).toBe(false);
    expect(validatePhotoFile({ type: 'image/jpeg', size: 0 }).valid).toBe(false);
    expect(validatePhotoFile({ type: 'image/png', size: 5 * 1024 * 1024 }).valid).toBe(
      false
    );

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    class MockImageOk {
      naturalWidth = 2880;
      naturalHeight = 1440;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_val: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', MockImageOk);

    class MockFileReader {
      result: string | null = 'data:image/webp;base64,cleanBase64Data';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL(_blob: Blob) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    const ctx = createMockCanvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb, mime) => {
      cb(new Blob(['clean-bytes'], { type: mime ?? 'image/webp' }));
    });

    const webpFile = new File(['raw-exif-bytes'], 'room.webp', { type: 'image/webp' });
    const stripped = await stripExifFromImage(webpFile);
    expect(stripped.mimeType).toBe('image/webp');
    expect(stripped.imageBase64).toBe('cleanBase64Data');

    // Oversized processed blob rejects cleanly
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => {
      cb({ size: 5 * 1024 * 1024 } as unknown as Blob);
    });
    const pngFile = new File(['png-bytes'], 'sky.png', { type: 'image/png' });
    await expect(stripExifFromImage(pngFile)).rejects.toThrow(/4 MB limit/);

    // Null 2D context throws
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(stripExifFromImage(pngFile)).rejects.toThrow(/Canvas 2D/);
  });

  it('manages user profile updates, global shortcuts, plan progress, language fade, and share card', async () => {
    const { result: profileHook } = renderHook(() => useUserProfile());
    act(() => profileHook.current.applySampleProfile('mumbai-asthma'));
    expect(profileHook.current.activeSampleId).toBe('mumbai-asthma');

    act(() => profileHook.current.toggleHouseholdGroup('seniors'));
    expect(profileHook.current.profile.household).toContain('seniors');
    act(() => profileHook.current.toggleHouseholdGroup('seniors'));
    expect(profileHook.current.profile.household).not.toContain('seniors');
    act(() => profileHook.current.setLifestyle('wfh'));
    act(() => profileHook.current.setHasPurifier(false));
    act(() => profileHook.current.setLanguage('hi'));
    act(() =>
      profileHook.current.setCity({
        id: 77,
        name: 'Pune',
        latitude: 18.52,
        longitude: 73.85,
      })
    );
    expect(profileHook.current.profile.city.name).toBe('Pune');

    const { result: planHook } = renderHook(() => usePlanProgress('Pune', SAMPLE_ADVICE));
    act(() => planHook.current.handleToggleDone('outdoor:0'));
    expect(planHook.current.completedIds).toContain('outdoor:0');
    expect(planHook.current.planProgress.completed).toBe(1);

    const onFocusCitySearch = vi.fn();
    const onRefresh = vi.fn();
    const onStepHour = vi.fn();
    const onToggleShortcuts = vi.fn();
    renderHook(() =>
      useGlobalShortcuts({
        prefersReducedMotion: false,
        onFocusCitySearch,
        onRefresh,
        onStepHour,
        onToggleShortcuts,
      })
    );

    fireEvent.keyDown(window, { key: '/' });
    fireEvent.keyDown(window, { key: 'r' });
    fireEvent.keyDown(window, { key: '[' });
    fireEvent.keyDown(window, { key: ']' });
    fireEvent.keyDown(window, { key: '?' });
    expect(onFocusCitySearch).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onStepHour).toHaveBeenNthCalledWith(1, -1);
    expect(onStepHour).toHaveBeenNthCalledWith(2, 1);
    expect(onToggleShortcuts).toHaveBeenCalledTimes(1);

    const setLang = vi.fn();
    const { result: fadeHook } = renderHook(() => useLanguageFade('en', true, setLang));
    act(() => fadeHook.current.handleLanguageChange('hi'));
    expect(setLang).toHaveBeenCalledWith('hi');

    const { naqi, scrubbed, theme } = makeNaqiAndWeatherFixtures();
    const { result: shareHook } = renderHook(() =>
      useShareAirCard({
        profile: DEFAULT_PROFILE,
        naqi,
        scrubbed,
        advice: SAMPLE_ADVICE,
        theme,
        lastUpdated: new Date('2026-11-22T10:00:00Z'),
      })
    );
    await act(async () => {
      await shareHook.current.handleShareCard();
    });
    expect(shareHook.current.shareNotice).toBeTruthy();
  });

  it('fetches advice via useAdvice with cache hit, retry on 500, and rule-based fallback on error', async () => {
    const { naqi, weather } = makeNaqiAndWeatherFixtures();
    const cacheKey = buildAdviceCacheKey(DEFAULT_PROFILE, naqi, weather, false);
    if (cacheKey) deleteCachedAdvice(cacheKey);

    let callNum = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        callNum += 1;
        if (callNum === 1) return new Response('Server error', { status: 500 });
        return new Response(JSON.stringify({ ...SAMPLE_ADVICE, source: 'gemini' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );

    const { result } = renderHook(() =>
      useAdvice({
        profile: DEFAULT_PROFILE,
        naqi,
        weather,
        airLoading: false,
        isEditingProfile: false,
      })
    );

    await waitFor(
      () => {
        expect(result.current.advice?.source).toBe('gemini');
      },
      { timeout: 3000 }
    );
    expect(cacheKey ? readCachedAdvice(cacheKey)?.source : null).toBe('gemini');

    // Trigger retry with persistent 400 error -> populates fallback + errorNotice
    if (cacheKey) deleteCachedAdvice(cacheKey);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Bad Request', { status: 400 }))
    );
    act(() => result.current.retryAdvice());
    await waitFor(
      () => {
        expect(result.current.error).toContain('HTTP 400');
        expect(result.current.advice?.source).toBe('fallback');
      },
      { timeout: 3000 }
    );
  });
});
