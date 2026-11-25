import React, { useId, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { APP_CONFIG } from '../lib/config.ts';
import { MEDICAL_DISCLAIMER } from '../lib/shared/domain.ts';
import type {
  AskResponse,
  NaqiResult,
  ThemeTokens,
  UserProfile,
  WeatherData,
} from '../types/index.ts';
import { postAskQuestion } from './assistant/assistantApi.ts';
import { AskFormControls, AskResultPanel } from './assistant/AskSubcomponents.tsx';

interface AskVayuMitraProps {
  profile: UserProfile;
  naqi: NaqiResult | null;
  weather: WeatherData | null;
  theme?: ThemeTokens;
}

const AskHeading: React.FC<{ hi: boolean }> = ({ hi }) => (
  <div className="flex items-center gap-2.5">
    <HelpCircle className="w-5 h-5 shrink-0 vm-accent-text" aria-hidden="true" />
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
);

const AskVayuMitra: React.FC<AskVayuMitraProps> = ({ profile, naqi, weather }) => {
  const hi = profile.language === 'hi';
  const inputId = useId();
  const errorId = useId();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultState, setResultState] = useState<{
    cityId: number;
    data: AskResponse | null;
  }>({
    cityId: profile.city.id,
    data: null,
  });
  const result = resultState.cityId === profile.city.id ? resultState.data : null;

  const submitQuestion = async (rawQuestion: string) => {
    const trimmed = rawQuestion.trim();
    if (!naqi || !weather || trimmed.length < APP_CONFIG.minQuestionLength || loading)
      return;
    setQuestion(trimmed);
    setLoading(true);
    setError(null);
    try {
      const data = await postAskQuestion({ question: trimmed, profile, naqi, weather });
      setResultState({ cityId: profile.city.id, data });
    } catch (err) {
      const fallback = hi ? 'उत्तर लाने में समस्या हुई।' : 'Unable to fetch grounded answer.';
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      aria-label={hi ? 'वायुमित्र से पूछें' : 'Ask VayuMitra'}
      className="vm-glass-card rounded-[24px] p-5 sm:p-6 space-y-4"
    >
      <AskHeading hi={hi} />
      <AskFormControls
        inputId={inputId}
        errorId={errorId}
        question={question}
        disabled={!naqi}
        loading={loading}
        hasError={Boolean(error)}
        hi={hi}
        onChangeQuestion={setQuestion}
        onSelectSuggestion={(text) => void submitQuestion(text)}
        onSubmit={(e) => {
          e.preventDefault();
          void submitQuestion(question);
        }}
      />
      <p className="text-xs text-slate-300">{MEDICAL_DISCLAIMER[profile.language]}</p>
      <div aria-live="polite" className="space-y-3">
        {error && (
          <div
            id={errorId}
            role="alert"
            className="rounded-xl bg-rose-950/75 border border-rose-300/35 px-4 py-3 text-xs text-rose-100"
          >
            {error}
          </div>
        )}
        {result && <AskResultPanel result={result} hi={hi} />}
      </div>
    </section>
  );
};

export default React.memo(AskVayuMitra);
