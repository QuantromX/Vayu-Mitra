import type { NaqiCategory, ThemeTokens } from '../../types/index.ts';

export interface CategoryPalette {
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  accent: string;
  accentStrong: string;
  accentContrast: string;
  surfaceGlass: string;
  surfaceElevated: string;
  borderGlass: string;
  scrim: string;
  badgeIcon: ThemeTokens['badgeIcon'];
  hazeColor: string;
}

export const CATEGORY_PALETTES: Record<NaqiCategory, CategoryPalette> = {
  Good: {
    skyTop: '#062c30',
    skyMid: '#0b4a4e',
    skyBottom: '#116d66',
    accent: '#2dd4bf',
    accentStrong: '#14b8a6',
    accentContrast: '#032320',
    surfaceGlass: 'rgba(6, 31, 35, 0.78)',
    surfaceElevated: 'rgba(10, 44, 49, 0.9)',
    borderGlass: 'rgba(153, 246, 228, 0.24)',
    scrim: 'rgba(3, 18, 20, 0.62)',
    badgeIcon: 'shield-check',
    hazeColor: 'rgba(167, 243, 208, 0.18)',
  },
  Satisfactory: {
    skyTop: '#162d1a',
    skyMid: '#244723',
    skyBottom: '#3c622b',
    accent: '#a3e635',
    accentStrong: '#84cc16',
    accentContrast: '#142605',
    surfaceGlass: 'rgba(17, 34, 19, 0.78)',
    surfaceElevated: 'rgba(26, 48, 28, 0.9)',
    borderGlass: 'rgba(217, 249, 157, 0.24)',
    scrim: 'rgba(10, 22, 12, 0.64)',
    badgeIcon: 'leaf',
    hazeColor: 'rgba(217, 249, 157, 0.2)',
  },
  Moderate: {
    skyTop: '#2e2008',
    skyMid: '#4c340e',
    skyBottom: '#714a14',
    accent: '#fbbf24',
    accentStrong: '#f59e0b',
    accentContrast: '#291702',
    surfaceGlass: 'rgba(34, 23, 8, 0.8)',
    surfaceElevated: 'rgba(49, 34, 12, 0.92)',
    borderGlass: 'rgba(253, 230, 138, 0.24)',
    scrim: 'rgba(20, 13, 4, 0.66)',
    badgeIcon: 'cloud-sun',
    hazeColor: 'rgba(252, 211, 77, 0.24)',
  },
  Poor: {
    skyTop: '#331507',
    skyMid: '#59230b',
    skyBottom: '#823410',
    accent: '#fb923c',
    accentStrong: '#f97316',
    accentContrast: '#2b0e02',
    surfaceGlass: 'rgba(38, 17, 8, 0.8)',
    surfaceElevated: 'rgba(56, 25, 11, 0.92)',
    borderGlass: 'rgba(254, 215, 170, 0.24)',
    scrim: 'rgba(22, 9, 4, 0.68)',
    badgeIcon: 'alert-triangle',
    hazeColor: 'rgba(251, 146, 60, 0.28)',
  },
  'Very Poor': {
    skyTop: '#320b10',
    skyMid: '#58121a',
    skyBottom: '#7f1d27',
    accent: '#f87171',
    accentStrong: '#ef4444',
    accentContrast: '#2b0608',
    surfaceGlass: 'rgba(38, 10, 14, 0.82)',
    surfaceElevated: 'rgba(56, 15, 21, 0.92)',
    borderGlass: 'rgba(254, 202, 202, 0.24)',
    scrim: 'rgba(22, 5, 8, 0.72)',
    badgeIcon: 'flame',
    hazeColor: 'rgba(248, 113, 113, 0.32)',
  },
  Severe: {
    skyTop: '#1e091f',
    skyMid: '#371138',
    skyBottom: '#531946',
    accent: '#e879f9',
    accentStrong: '#c026d3',
    accentContrast: '#230526',
    surfaceGlass: 'rgba(25, 9, 28, 0.84)',
    surfaceElevated: 'rgba(40, 14, 44, 0.94)',
    borderGlass: 'rgba(245, 208, 254, 0.26)',
    scrim: 'rgba(15, 4, 18, 0.74)',
    badgeIcon: 'skull',
    hazeColor: 'rgba(192, 132, 252, 0.34)',
  },
};
