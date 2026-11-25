import type React from 'react';
import { type PlanProgress } from '../../lib/advice/progress.ts';
import type { Language, ThemeTokens } from '../../types/index.ts';

export { ActionRow, WhyExpander } from './ActionRow.tsx';
export { VerdictSkeleton } from './VerdictSkeleton.tsx';

export const PlanProgressRing: React.FC<{
  progress: PlanProgress;
  theme: ThemeTokens;
  language: Language;
}> = ({ progress, theme, language }) => {
  const hi = language === 'hi';
  const r = 18;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress.pct / 100);

  return (
    <div
      className="vm-glass-card rounded-[24px] px-5 py-4 flex items-center justify-between gap-4"
      data-testid="todays-plan-progress"
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
          <svg
            width="44"
            height="44"
            viewBox="0 0 44 44"
            className="w-11 h-11 -rotate-90"
            aria-hidden="true"
            focusable="false"
          >
            <circle
              cx="22"
              cy="22"
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="4"
            />
            <circle
              cx="22"
              cy="22"
              r={r}
              fill="none"
              stroke={theme.accent}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              className="transition-[stroke-dashoffset] duration-300 ease-out"
            />
          </svg>
          <span className="absolute text-xs font-mono-tabular font-semibold text-white">
            {progress.completed}
          </span>
        </div>

        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">
            {hi ? 'आज की कार्य योजना' : "Today's plan"}
          </div>
          <div className="text-xs text-slate-200 mt-0.5">
            {hi
              ? `${progress.total} में से ${progress.completed} कदम पूरे (${progress.pct}%)`
              : `${progress.completed} of ${progress.total} actions completed (${progress.pct}%)`}
          </div>
        </div>
      </div>

      <span className="font-mono-tabular text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-950/60 border border-white/15 text-slate-100 shrink-0">
        {progress.completed}/{progress.total}
      </span>
    </div>
  );
};
