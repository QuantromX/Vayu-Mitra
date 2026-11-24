import React, { useId, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  Send,
  ShieldAlert,
} from 'lucide-react';
import type {
  AskResponse,
  AskVerdict,
  NaqiResult,
  ThemeTokens,
  UserProfile,
  WeatherData,
} from '../types';

interface AskVayuMitraProps {
  profile: UserProfile;
  naqi: NaqiResult | null;
  weather: WeatherData | null;
  theme: ThemeTokens;
}

const SUGGESTED_QUESTIONS: ReadonlyArray<{ en: string; hi: string }> = [
  {
    en: 'Can kids play cricket outside after 4 PM?',
    hi: 'क्या बच्चे शाम 4 बजे के बाद बाहर खेल सकते हैं?',
  },
  {
    en: 'Should I open balcony windows right now?',
    hi: 'क्या मुझे अभी बालकनी की खिड़कियाँ खोलनी चाहिए?',
  },
  {
    en: 'Best hour in the next 24h for a brisk walk?',
    hi: 'अगले 24 घंटों में तेज़ सैर का सबसे बेहतर समय कौन सा है?',
  },
  {
    en: 'Do I need an N95 mask for my commute today?',
    hi: 'क्या आज सफ़र के लिए मुझे N95 मास्क पहनना जरूरी है?',
  },
];

function VerdictChip({
  verdict,
  hi,
}: {
  verdict: AskVerdict;
  hi: boolean;
}) {
  if (verdict === 'yes') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-400 text-slate-950">
        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{hi ? 'हाँ · सुरक्षित' : 'YES'}</span>
      </span>
    );
  }
  if (verdict === 'caution') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-300 text-slate-950">
        <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{hi ? 'सावधानी' : 'CAUTION'}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-rose-400 text-slate-950">
      <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
      <span>{hi ? 'नहीं · टालें' : 'NO'}</span>
    </span>
  );
}

/**
 * Interactive grounded Q&A panel ("Ask VayuMitra") sending the user's question plus live NAQI,
 * forward hourly forecast, weather, and household profile to POST /api/ask.
 */
const AskVayuMitra: React.FC<AskVayuMitraProps> = ({
  profile,
  naqi,
  weather,
  theme,
}) => {
  const hi = profile.language === 'hi';
  const inputId = useId();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultState, setResultState] = useState<{
    cityId: number;
    data: AskResponse | null;
  }>({ cityId: profile.city.id, data: null });
  const result =
    resultState.cityId === profile.city.id ? resultState.data : null;

  const submitQuestion = async (rawQuestion: string) => {
    const trimmed = rawQuestion.trim();
    if (!naqi || !weather || trimmed.length < 3 || loading) return;

    setQuestion(trimmed);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          cityName: profile.city.name,
          aqi: naqi.aqi,
          category: naqi.category,
          dominantPollutant: naqi.dominantPollutant,
          pm25: naqi.pm25Used,
          pm10: naqi.pm10Used,
          temperatureC: weather.temperatureC,
          humidityPct: weather.humidityPct,
          windSpeedKmh: weather.windSpeedKmh,
          cleanestWindow: naqi.cleanestWindow,
          worstWindow: naqi.worstWindow,
          forwardHourly: naqi.forwardHourly.slice(0, 12).map((pt) => ({
            dayLabel: pt.dayLabel,
            hourLabel: pt.hourLabel,
            naqi: pt.naqi,
            pm2_5: pt.pm2_5,
          })),
          household: profile.household,
          lifestyle: profile.lifestyle,
          hasPurifier: profile.hasPurifier,
          language: profile.language,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          body.error ||
            (hi
              ? `सवाल का उत्तर नहीं मिल सका (HTTP ${response.status})`
              : `Could not answer question (HTTP ${response.status})`)
        );
      }

      const data = (await response.json()) as AskResponse;
      setResultState({ cityId: profile.city.id, data });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : hi
            ? 'उत्तर लाने में समस्या हुई।'
            : 'Unable to fetch grounded answer.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitQuestion(question);
  };

  return (
    <section
      aria-label={hi ? 'वायुमित्र से पूछें' : 'Ask VayuMitra'}
      className="vm-glass-card rounded-[24px] p-5 sm:p-6 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <HelpCircle
            className="w-5 h-5 shrink-0"
            style={{ color: theme.accent }}
            aria-hidden="true"
          />
          <div>
            <h2 className="font-display text-lg font-semibold text-white">
              {hi ? 'वायुमित्र से पूछें' : 'Ask VayuMitra'}
            </h2>
            <p className="text-xs text-slate-300">
              {hi
                ? 'आपके शहर के लाइव Open-Meteo डेटा और परिवार प्रोफ़ाइल पर आधारित तुरंत उत्तर'
                : 'Grounded decision answers using only your live Open-Meteo readings and household profile'}
            </p>
          </div>
        </div>
      </div>

      {/* Suggested quick-ask chips */}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={hi ? 'सुझाए गए सवाल' : 'Suggested questions'}
      >
        {SUGGESTED_QUESTIONS.map((item) => {
          const text = hi ? item.hi : item.en;
          return (
            <button
              key={item.en}
              type="button"
              disabled={!naqi || loading}
              onClick={() => void submitQuestion(text)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-950/55 border border-white/20 text-xs text-slate-100 hover:bg-white/15 hover:border-white/40 disabled:opacity-50 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {text}
            </button>
          );
        })}
      </div>

      {/* Question form */}
      <form
        onSubmit={handleFormSubmit}
        className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-end"
      >
        <div className="flex-1 min-w-0">
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-slate-200 mb-1.5"
          >
            {hi
              ? 'अपना घर या बाहरी योजना से जुड़ा सवाल लिखें'
              : 'Ask a decision question for your household'}
          </label>
          <input
            id={inputId}
            type="text"
            value={question}
            maxLength={240}
            disabled={!naqi || loading}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={
              hi
                ? 'जैसे: क्या मैं शाम 6 बजे दौड़ने जा सकता हूँ?'
                : 'e.g. Can I go for a 6 PM run near Lodhi Road?'
            }
            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-950/70 border border-white/25 text-sm text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          />
        </div>

        <button
          type="submit"
          disabled={!naqi || loading || question.trim().length < 3}
          className="min-h-[44px] px-5 py-2 rounded-xl bg-white text-slate-950 text-xs font-semibold inline-flex items-center justify-center gap-2 hover:bg-slate-100 disabled:opacity-45 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="w-4 h-4" aria-hidden="true" />
          )}
          <span>{hi ? 'पूछें' : 'Ask'}</span>
        </button>
      </form>

      {/* Accessible status & grounded result */}
      <div aria-live="polite" className="space-y-3">
        {error && (
          <div
            role="alert"
            className="rounded-xl bg-rose-950/75 border border-rose-300/35 px-4 py-3 text-xs text-rose-100"
          >
            {error}
          </div>
        )}

        {result && (
          <div
            data-testid="ask-vayumitra-result"
            className="rounded-2xl bg-slate-950/65 border border-white/20 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <VerdictChip verdict={result.verdict} hi={hi} />
                {result.bestTime && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-xs font-mono-tabular text-slate-100">
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      {hi ? 'बेहतर समय:' : 'Best time:'} {result.bestTime}
                    </span>
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-300">
                {result.source === 'gemini'
                  ? hi
                    ? 'Gemini द्वारा'
                    : 'Grounded Gemini'
                  : hi
                    ? 'ऑफ़लाइन नियम इंजन'
                    : 'Offline rule engine'}
              </span>
            </div>

            <p className="text-sm font-medium text-white leading-snug">
              {result.answer}
            </p>
            <p className="text-xs text-slate-200 leading-relaxed">
              {result.why}
            </p>

            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/10">
              <span className="text-xs text-slate-300 mr-1">
                {hi ? 'उपयोग किया गया डेटा:' : 'Data used:'}
              </span>
              {result.dataUsed.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-white/10 border border-white/15 text-xs font-mono-tabular text-slate-200"
                >
                  {tag}
                </span>
              ))}
            </div>

            <p className="text-xs text-slate-300">{result.disclaimer}</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default React.memo(AskVayuMitra);
