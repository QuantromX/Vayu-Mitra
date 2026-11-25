import type React from 'react';
import { Sparkles } from 'lucide-react';
import type { Language } from '../../types/index.ts';

export const VerdictSkeleton: React.FC<{ language: Language }> = ({ language }) => {
  const hi = language === 'hi';
  return (
    <div
      className="vm-glass-card rounded-[24px] p-5 sm:p-6 space-y-3.5"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-xs text-slate-200">
        <Sparkles className="w-4 h-4 animate-pulse" aria-hidden="true" />
        <span>
          {hi
            ? 'आपके परिवार और लाइव मौसम के अनुसार सलाह तैयार हो रही है...'
            : 'Thinking through personalized household guidance from live readings...'}
        </span>
      </div>
      <div className="h-6 w-3/4 rounded-xl vm-shimmer" />
      <div className="h-4 w-full rounded-lg vm-shimmer" />
      <div className="h-4 w-2/3 rounded-lg vm-shimmer" />
    </div>
  );
};

export const AdviceCardsSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-busy="true">
    {[0, 1, 2, 3].map((idx) => (
      <div key={idx} className="vm-glass-card rounded-[24px] p-5 space-y-3">
        <div className="h-5 w-1/3 rounded-lg vm-shimmer" />
        <div className="h-4 w-full rounded-lg vm-shimmer" />
        <div className="h-4 w-5/6 rounded-lg vm-shimmer" />
      </div>
    ))}
  </div>
);
