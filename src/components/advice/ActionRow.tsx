import type React from 'react';
import { useState } from 'react';
import { Check, ChevronDown, Info } from 'lucide-react';
import { triggerHapticTap } from '../../lib/advice/progress.ts';
import type { Language } from '../../types/index.ts';

export const WhyExpander: React.FC<{
  id: string;
  why: string;
  language: Language;
  open: boolean;
  onToggle: () => void;
}> = ({ id, why, language, open, onToggle }) => {
  const hi = language === 'hi';
  return (
    <div className="mt-1.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="min-h-[44px] px-3 py-1.5 -ml-3 rounded-xl inline-flex items-center gap-1.5 text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>{hi ? 'यह सलाह क्यों?' : 'Why this?'}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      <div className="vm-disclosure-grid" data-open={open ? 'true' : 'false'}>
        <div className="vm-disclosure-inner">
          <p
            id={id}
            className="mt-1.5 text-xs text-slate-100 leading-relaxed bg-slate-950/60 border border-white/15 rounded-xl p-3"
          >
            {why}
          </p>
        </div>
      </div>
    </div>
  );
};

function getDoneButtonAriaLabel(done: boolean, hi: boolean): string {
  if (done)
    return hi ? 'कार्य पूर्ण चिह्नित (हटाने के लिए टैप करें)' : 'Marked done (tap to undo)';
  return hi ? 'कार्य पूर्ण चिह्नित करें' : 'Mark action done';
}

export const ActionRow: React.FC<{
  actionId: string;
  sectionIcon: React.ReactNode;
  action: string;
  chip?: string;
  why: string;
  done: boolean;
  language: Language;
  onToggleDone?: (actionId: string) => void;
}> = ({ actionId, sectionIcon, action, chip, why, done, language, onToggleDone }) => {
  const [whyOpen, setWhyOpen] = useState(false);
  const hi = language === 'hi';

  return (
    <li
      className={`rounded-2xl transition-all duration-200 ${
        whyOpen ? 'bg-white/[0.06] ring-1 ring-white/30 p-3 -mx-2' : 'py-1'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className="w-9 h-9 rounded-xl bg-slate-950/55 border border-white/15 flex items-center justify-center shrink-0 mt-0.5 vm-accent-text"
          aria-hidden="true"
        >
          {sectionIcon}
        </span>

        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium leading-snug transition-colors ${
              done ? 'line-through text-slate-300' : 'text-white'
            }`}
          >
            {action}
          </p>
          {chip && (
            <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-lg bg-white/10 border border-white/15 text-xs font-mono-tabular text-slate-200">
              {chip}
            </span>
          )}
          <WhyExpander
            id={`why-${actionId}`}
            why={why}
            language={language}
            open={whyOpen}
            onToggle={() => {
              triggerHapticTap(8);
              setWhyOpen((prev) => !prev);
            }}
          />
        </div>

        {onToggleDone && (
          <button
            type="button"
            aria-pressed={done}
            aria-label={getDoneButtonAriaLabel(done, hi)}
            onClick={() => {
              triggerHapticTap(12);
              onToggleDone(actionId);
            }}
            className={`min-h-[44px] min-w-[44px] rounded-xl border inline-flex items-center justify-center shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              done
                ? 'border-transparent vm-accent-pill'
                : 'bg-slate-950/50 border-white/25 text-slate-200 hover:bg-white/15 hover:text-white'
            }`}
          >
            <Check className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  );
};
