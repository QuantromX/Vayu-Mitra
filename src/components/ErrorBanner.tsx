import type React from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import type { Language } from '../types/index.ts';

interface ErrorBannerProps {
  message: string;
  language: Language;
  isOfflineData?: boolean;
  offlineSavedAt?: string | null;
  onRetry: () => void;
}

function formatSavedTime(offlineSavedAt: string | null): string | null {
  if (!offlineSavedAt || Number.isNaN(Date.parse(offlineSavedAt))) return null;
  const formatted = new Date(offlineSavedAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
  return `${formatted} IST`;
}

function getErrorHeading(
  isOfflineData: boolean,
  browserOffline: boolean,
  hi: boolean
): string {
  if (isOfflineData) {
    return hi ? 'सहेजा गया अंतिम डेटा दिखाया जा रहा है' : 'Showing last saved snapshot';
  }
  if (browserOffline) {
    return hi ? 'आप अभी ऑफ़लाइन हैं' : 'You appear to be offline';
  }
  return hi ? 'लाइव डेटा लोड नहीं हो सका' : 'Could not fetch live air quality data';
}

function getErrorBody(params: {
  isOfflineData: boolean;
  browserOffline: boolean;
  savedLabel: string | null;
  message: string;
  hi: boolean;
}): string {
  const { isOfflineData, browserOffline, savedLabel, message, hi } = params;
  if (isOfflineData) {
    const suffix = savedLabel ? ` from ${savedLabel}` : '';
    return hi
      ? `लाइव नेटवर्क अनुपलब्ध है — ${savedLabel ?? 'पिछला'} डेटा दिखाया जा रहा है।`
      : `Live Open-Meteo is unreachable (${message}). Displaying your last saved readings${suffix}.`;
  }
  if (browserOffline) {
    return hi
      ? 'इंटरनेट कनेक्शन जाँचें और फिर से प्रयास करें।'
      : 'Check your internet connection and tap Retry to fetch live Open-Meteo readings.';
  }
  return message;
}

const ErrorCloudIllustration: React.FC<{ isOfflineData: boolean }> = ({
  isOfflineData,
}) => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 56 56"
    className="w-12 h-12 shrink-0"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="28" cy="28" r="26" fill="rgba(255,255,255,0.08)" />
    <path
      d="M17 36 H39 C43 36 46 33 46 29.5 C46 26.3 43.7 23.7 40.6 23.2 C39.5 18.8 35.6 15.6 30.8 15.6 C25.8 15.6 21.6 19.2 20.8 24 C17.4 24.4 14.8 27.2 14.8 30.6 C14.8 33.6 17.2 36 17 36 Z"
      fill="rgba(254, 205, 211, 0.25)"
      stroke={isOfflineData ? '#fcd34d' : '#fda4af'}
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <line
      x1="28"
      y1="23"
      x2="28"
      y2="29"
      stroke="#fff1f2"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    <circle cx="28" cy="32.5" r="1.4" fill="#fff1f2" />
  </svg>
);

/**
 * Accessible error & offline banner with retry button and last-known snapshot indicator.
 */
export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message,
  language,
  isOfflineData = false,
  offlineSavedAt = null,
  onRetry,
}) => {
  const hi = language === 'hi';
  const browserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const showOffline = isOfflineData || browserOffline;
  const savedLabel = formatSavedTime(offlineSavedAt);
  const heading = getErrorHeading(isOfflineData, browserOffline, hi);
  const body = getErrorBody({ isOfflineData, browserOffline, savedLabel, message, hi });
  const toneClass = isOfflineData
    ? 'border-amber-300/40 bg-amber-950/75 text-amber-50'
    : 'border-rose-300/40 bg-rose-950/75 text-rose-50';

  return (
    <div
      role="alert"
      className={`vm-glass-card rounded-[24px] p-5 border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${toneClass}`}
    >
      <div className="flex items-start gap-3.5 min-w-0">
        <ErrorCloudIllustration isOfflineData={isOfflineData} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {showOffline && (
              <span
                data-testid="offline-badge"
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-300 text-slate-950 text-xs font-bold shrink-0"
              >
                <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{hi ? 'ऑफ़लाइन' : 'Offline'}</span>
              </span>
            )}
            <h2 className="text-sm font-semibold">{heading}</h2>
          </div>
          <p className="text-xs text-slate-200 mt-1 leading-relaxed">{body}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onRetry}
        className="min-h-[44px] px-4 py-2 rounded-xl bg-white text-slate-950 text-xs font-semibold inline-flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{hi ? 'फिर से कोशिश करें' : 'Retry'}</span>
      </button>
    </div>
  );
};
