import type React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { APP_CONFIG } from '../../lib/config.ts';
import type { AskResponse, AskVerdict } from '../../types/index.ts';

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

const VerdictChip: React.FC<{ verdict: AskVerdict; hi: boolean }> = ({ verdict, hi }) => {
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
};

function getSourceLabel(source: AskResponse['source'], hi: boolean): string {
  if (source === 'gemini') return hi ? 'Gemini द्वारा' : 'Grounded Gemini';
  return hi ? 'ऑफ़लाइन नियम इंजन' : 'Offline rule engine';
}

export const AskResultPanel: React.FC<{ result: AskResponse; hi: boolean }> = ({
  result,
  hi,
}) => (
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
      <span className="text-xs text-slate-300">{getSourceLabel(result.source, hi)}</span>
    </div>
    <p className="text-sm font-medium text-white leading-snug">{result.answer}</p>
    <p className="text-xs text-slate-200 leading-relaxed">{result.why}</p>
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
);

export const AskFormControls: React.FC<{
  inputId: string;
  errorId: string;
  question: string;
  disabled: boolean;
  loading: boolean;
  hasError: boolean;
  hi: boolean;
  onChangeQuestion: (val: string) => void;
  onSelectSuggestion: (text: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}> = ({
  inputId,
  errorId,
  question,
  disabled,
  loading,
  hasError,
  hi,
  onChangeQuestion,
  onSelectSuggestion,
  onSubmit,
}) => (
  <>
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
            disabled={disabled || loading}
            onClick={() => onSelectSuggestion(text)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-950/55 border border-white/20 text-xs text-slate-100 hover:bg-white/15 hover:border-white/40 disabled:opacity-50 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {text}
          </button>
        );
      })}
    </div>

    <form
      onSubmit={onSubmit}
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
          maxLength={APP_CONFIG.maxQuestionLength}
          disabled={disabled || loading}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          onChange={(e) => onChangeQuestion(e.target.value)}
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
        disabled={
          disabled || loading || question.trim().length < APP_CONFIG.minQuestionLength
        }
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
  </>
);
