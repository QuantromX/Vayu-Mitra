import { describe, expect, it } from 'vitest';
import {
  computeHazeOpacity,
  resolveThemeTokens,
  selectWeatherScene,
} from '../theme/theme.ts';
import type { NaqiCategory } from '../../types/index.ts';

describe('Theme & Atmospheric Scene Engine', () => {
  it('maps each NAQI category to a distinct palette and non-color badge icon', () => {
    const categories: NaqiCategory[] = [
      'Good',
      'Satisfactory',
      'Moderate',
      'Poor',
      'Very Poor',
      'Severe',
    ];

    const accents = new Set<string>();
    const icons = new Set<string>();

    for (const category of categories) {
      const tokens = resolveThemeTokens({
        category,
        weatherCode: 0,
        isDay: true,
        pm25: 35,
        humidityPct: 50,
        windSpeedKmh: 10,
      });
      expect(tokens.category).toBe(category);
      expect(tokens.scrim).toContain('rgba(');
      accents.add(tokens.accent);
      icons.add(tokens.badgeIcon);
    }

    expect(accents.size).toBe(6);
    expect(icons.size).toBe(6);
  });

  it('selects weather scenes from weather_code, humidity, and wind speed', () => {
    // Clear (0-1)
    expect(selectWeatherScene({ weatherCode: 0, humidityPct: 45, windSpeedKmh: 12 })).toBe('clear');
    expect(selectWeatherScene({ weatherCode: 1, humidityPct: 60, windSpeedKmh: 8 })).toBe('clear');

    // Cloudy (2-3)
    expect(selectWeatherScene({ weatherCode: 2, humidityPct: 55, windSpeedKmh: 10 })).toBe('cloudy');
    expect(selectWeatherScene({ weatherCode: 3, humidityPct: 70, windSpeedKmh: 7 })).toBe('cloudy');

    // Fog: weather_code 45, 48 OR (humidity > 85 && wind < 5)
    expect(selectWeatherScene({ weatherCode: 45, humidityPct: 60, windSpeedKmh: 10 })).toBe('fog');
    expect(selectWeatherScene({ weatherCode: 48, humidityPct: 70, windSpeedKmh: 10 })).toBe('fog');
    expect(selectWeatherScene({ weatherCode: 1, humidityPct: 88, windSpeedKmh: 4 })).toBe('fog');
    expect(selectWeatherScene({ weatherCode: 1, humidityPct: 88, windSpeedKmh: 8 })).toBe('clear');

    // Rain (51-67, 80-82)
    expect(selectWeatherScene({ weatherCode: 51, humidityPct: 90, windSpeedKmh: 3 })).toBe('rain');
    expect(selectWeatherScene({ weatherCode: 63, humidityPct: 85, windSpeedKmh: 14 })).toBe('rain');
    expect(selectWeatherScene({ weatherCode: 80, humidityPct: 80, windSpeedKmh: 18 })).toBe('rain');

    // Thunder (95+)
    expect(selectWeatherScene({ weatherCode: 95, humidityPct: 90, windSpeedKmh: 25 })).toBe('thunder');
    expect(selectWeatherScene({ weatherCode: 99, humidityPct: 92, windSpeedKmh: 30 })).toBe('thunder');
  });

  it('tracks day vs night via is_day, scales haze opacity with PM2.5, and dims sun in smog', () => {
    expect(computeHazeOpacity(5)).toBe(0.08);
    expect(computeHazeOpacity(130)).toBeGreaterThan(0.45);
    expect(computeHazeOpacity(300)).toBe(0.9);

    const clearDay = resolveThemeTokens({
      category: 'Good',
      weatherCode: 0,
      isDay: true,
      pm25: 18,
    });
    const clearNight = resolveThemeTokens({
      category: 'Good',
      weatherCode: 0,
      isDay: false,
      pm25: 18,
    });
    const smogDay = resolveThemeTokens({
      category: 'Very Poor',
      weatherCode: 0,
      isDay: true,
      pm25: 180,
    });

    expect(clearDay.isDay).toBe(true);
    expect(clearDay.sunColor).toBe('#fef08a');
    expect(clearNight.isDay).toBe(false);
    expect(clearNight.skyTop).toBe('#070b17');
    expect(clearNight.sunColor).toBe('#e2e8f0');
    expect(smogDay.sunColor).toBe('#ea580c');
    expect(smogDay.hazeOpacity).toBeGreaterThan(clearDay.hazeOpacity);
  });
});
