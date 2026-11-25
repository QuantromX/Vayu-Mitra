import type React from 'react';
import { useReducedMotion } from 'motion/react';
import type { PlanProgress } from '../../lib/advice/progress.ts';
import type { AdviceResponse, Language, ThemeTokens } from '../../types/index.ts';
import { AdviceCardsColumns } from './AdviceCategoryCards.tsx';
import { PlanProgressRing } from './AdvicePrimitives.tsx';
import { AdviceCardsSkeleton } from './VerdictSkeleton.tsx';

export interface AdviceCardsGridProps {
  advice: AdviceResponse | null;
  loading: boolean;
  revealStage: number;
  language: Language;
  theme: ThemeTokens;
  completedIds?: string[];
  planProgress?: PlanProgress;
  onToggleDone?: (actionId: string) => void;
}

export const AdviceCardsGrid: React.FC<AdviceCardsGridProps> = ({
  advice,
  loading,
  revealStage,
  language,
  theme,
  completedIds = [],
  planProgress,
  onToggleDone,
}) => {
  const prefersReducedMotion = Boolean(useReducedMotion());

  if (loading && !advice) return <AdviceCardsSkeleton />;
  if (!advice) return null;

  return (
    <div className="space-y-4">
      {planProgress && planProgress.total > 0 && (
        <PlanProgressRing progress={planProgress} theme={theme} language={language} />
      )}
      <AdviceCardsColumns
        advice={advice}
        doneSet={new Set(completedIds)}
        language={language}
        prefersReducedMotion={prefersReducedMotion}
        revealStage={revealStage}
        onToggleDone={onToggleDone}
      />
      <p className="text-xs text-slate-300 px-1 leading-relaxed">{advice.disclaimer}</p>
    </div>
  );
};
