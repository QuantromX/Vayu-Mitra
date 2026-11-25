import type React from 'react';
import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Shield } from 'lucide-react';
import { triggerHapticTap } from '../../lib/advice/progress.ts';
import { MEDICAL_DISCLAIMER } from '../../lib/shared/domain.ts';
import type { AdviceResponse, Language, ThemeTokens } from '../../types/index.ts';
import { WhyExpander } from './ActionRow.tsx';
import { VerdictSkeleton } from './VerdictSkeleton.tsx';

function getSourceBadgeText(source: AdviceResponse['source'], hi: boolean): string {
  if (source === 'gemini') return hi ? 'Gemini द्वारा सलाह' : 'Advice by Gemini';
  return hi ? 'ऑफ़लाइन नियम-आधारित सलाह' : 'Offline rule-based advice';
}

function getMaskHeadingText(recommended: boolean, maskType: string, hi: boolean): string {
  if (recommended) return hi ? `आवश्यक (${maskType})` : `Recommended (${maskType})`;
  return hi ? `वैकल्पिक (${maskType})` : `Optional (${maskType})`;
}

function resolveVerdictMotionAnim(prefersReducedMotion: boolean, revealStage: number) {
  if (prefersReducedMotion) return undefined;
  return revealStage >= 1 ? { opacity: 1, y: 0 } : { opacity: 0.45, y: 4 };
}

const AdviceNoticeBanner: React.FC<{
  errorNotice: string;
  hi: boolean;
  onRetryAdvice: () => void;
}> = ({ errorNotice, hi, onRetryAdvice }) => (
  <div
    role="status"
    className="rounded-2xl bg-amber-950/75 border border-amber-300/30 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-100"
  >
    <span>{errorNotice}</span>
    <button
      type="button"
      onClick={onRetryAdvice}
      className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      {hi ? 'पुनः प्रयास करें' : 'Retry Gemini'}
    </button>
  </div>
);

/**
 * Today's Verdict & Mask Guidance card rendered below the Time Scrubber / Hero.
 */
export const VerdictAndMaskCard: React.FC<{
  advice: AdviceResponse | null;
  loading: boolean;
  revealStage: number;
  language: Language;
  theme?: ThemeTokens;
  errorNotice: string | null;
  onRetryAdvice: () => void;
}> = ({ advice, loading, revealStage, language, errorNotice, onRetryAdvice }) => {
  const hi = language === 'hi';
  const prefersReducedMotion = Boolean(useReducedMotion());
  const [maskWhyOpen, setMaskWhyOpen] = useState(false);

  if (loading && !advice) return <VerdictSkeleton language={language} />;
  if (!advice) return null;

  return (
    <div className="space-y-3">
      {errorNotice && (
        <AdviceNoticeBanner
          errorNotice={errorNotice}
          hi={hi}
          onRetryAdvice={onRetryAdvice}
        />
      )}

      <motion.section
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
        animate={resolveVerdictMotionAnim(prefersReducedMotion, revealStage)}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        aria-label={
          hi ? 'आज का निष्कर्ष और मास्क मार्गदर्शन' : "Today's Verdict and Mask Guidance"
        }
        className="vm-glass-card rounded-[24px] p-5 sm:p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-200">
            {hi ? 'आज का निष्कर्ष' : "Today's Verdict"}
          </span>
          <span className="text-xs text-slate-300" data-testid="advice-source-badge">
            {getSourceBadgeText(advice.source, hi)}
          </span>
        </div>

        <div className="space-y-1.5">
          <h2 className="font-display text-xl font-semibold text-white text-balance">
            {advice.verdict.headline}
          </h2>
          <p className="text-sm text-slate-200 leading-relaxed max-w-3xl">
            {advice.verdict.summary}
          </p>
        </div>

        <div
          className={`pt-4 border-t border-white/15 transition-all duration-200 ${
            maskWhyOpen
              ? 'rounded-2xl bg-white/[0.05] p-3 -mx-3 ring-1 ring-white/25'
              : ''
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-slate-950/65 border border-white/20 vm-accent-text">
              <Shield className="w-4 h-4" aria-hidden="true" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">
                {hi ? 'मास्क मार्गदर्शन:' : 'Mask guidance:'}{' '}
                {getMaskHeadingText(advice.mask.recommended, advice.mask.type, hi)}
              </div>
              <WhyExpander
                id="why-mask"
                why={advice.mask.why}
                language={language}
                open={maskWhyOpen}
                onToggle={() => {
                  triggerHapticTap(8);
                  setMaskWhyOpen((prev) => !prev);
                }}
              />
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-300 pt-2 border-t border-white/10 leading-relaxed">
          {MEDICAL_DISCLAIMER[language]}
        </p>
      </motion.section>
    </div>
  );
};
