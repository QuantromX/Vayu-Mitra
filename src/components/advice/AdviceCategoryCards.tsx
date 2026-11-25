import type React from 'react';
import { motion } from 'motion/react';
import { Compass, Home, TrainFront, Users } from 'lucide-react';
import { buildActionId } from '../../lib/advice/progress.ts';
import type { AdviceResponse, Language } from '../../types/index.ts';
import { ActionRow } from './ActionRow.tsx';

export { AdviceCardsSkeleton } from './VerdictSkeleton.tsx';

function getMotionProps(
  prefersReducedMotion: boolean,
  revealStage: number,
  stage: number,
  delaySec: number
) {
  if (prefersReducedMotion) return {};
  return {
    initial: { opacity: 0, y: 14 },
    animate: revealStage >= stage ? { opacity: 1, y: 0 } : { opacity: 0.45, y: 8 },
    transition: { duration: 0.28, delay: delaySec, ease: [0.16, 1, 0.3, 1] as const },
  };
}

interface CategoryActionCardProps {
  title: string;
  ariaLabel: string;
  icon: React.ReactNode;
  sectionKey: 'outdoor' | 'indoor' | 'routine';
  items: Array<{ action: string; why: string; chip?: string }>;
  doneSet: Set<string>;
  language: Language;
  motionProps: ReturnType<typeof getMotionProps>;
  onToggleDone?: (actionId: string) => void;
}

const CategoryActionCard: React.FC<CategoryActionCardProps> = ({
  title,
  ariaLabel,
  icon,
  sectionKey,
  items,
  doneSet,
  language,
  motionProps,
  onToggleDone,
}) => (
  <motion.section
    {...motionProps}
    aria-label={ariaLabel}
    className="vm-glass-card rounded-[24px] p-5 sm:p-6 space-y-4"
  >
    <div className="flex items-center gap-2.5">
      <span className="vm-accent-text" aria-hidden="true">
        {icon}
      </span>
      <h3 className="font-display text-base font-semibold text-white">{title}</h3>
    </div>
    <ul className="space-y-3 divide-y divide-white/10">
      {items.map((item, idx) => {
        const id = buildActionId(sectionKey, idx);
        return (
          <ActionRow
            key={id}
            actionId={id}
            sectionIcon={icon}
            action={item.action}
            chip={item.chip}
            why={item.why}
            done={doneSet.has(id)}
            language={language}
            onToggleDone={onToggleDone}
          />
        );
      })}
    </ul>
  </motion.section>
);

const ForWhomCard: React.FC<{
  forWhom: AdviceResponse['forWhom'];
  motionProps: ReturnType<typeof getMotionProps>;
  hi: boolean;
}> = ({ forWhom, motionProps, hi }) => (
  <motion.section
    {...motionProps}
    aria-label={hi ? 'किसके लिए विशेष ध्यान' : 'For Whom'}
    className="vm-glass-card rounded-[24px] p-5 sm:p-6 space-y-4"
  >
    <div className="flex items-center gap-2.5">
      <Users className="w-5 h-5 vm-accent-text" aria-hidden="true" />
      <h3 className="font-display text-base font-semibold text-white">
        {hi ? 'किसके लिए विशेष ध्यान' : 'For Whom'}
      </h3>
    </div>
    <ul className="space-y-3 divide-y divide-white/10">
      {forWhom.map((entry, idx) => (
        <li key={idx} className={idx > 0 ? 'pt-3' : ''}>
          <div className="text-xs font-semibold text-slate-300">{entry.group}</div>
          <p className="text-sm text-white mt-0.5 leading-snug">{entry.advice}</p>
        </li>
      ))}
    </ul>
  </motion.section>
);

export const AdviceCardsColumns: React.FC<{
  advice: AdviceResponse;
  doneSet: Set<string>;
  language: Language;
  prefersReducedMotion: boolean;
  revealStage: number;
  onToggleDone?: (actionId: string) => void;
}> = ({ advice, doneSet, language, prefersReducedMotion, revealStage, onToggleDone }) => {
  const hi = language === 'hi';
  const windowChip = (tw?: string) =>
    tw ? `${hi ? 'समय:' : 'Window:'} ${tw}` : undefined;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <CategoryActionCard
        title={hi ? 'बाहरी गतिविधियाँ' : 'Outdoor'}
        ariaLabel={hi ? 'बाहरी गतिविधियाँ' : 'Outdoor actions'}
        icon={<Compass className="w-5 h-5" />}
        sectionKey="outdoor"
        items={advice.outdoor.map((i) => ({
          action: i.action,
          why: i.why,
          chip: windowChip(i.timeWindow),
        }))}
        doneSet={doneSet}
        language={language}
        motionProps={getMotionProps(prefersReducedMotion, revealStage, 2, 0)}
        onToggleDone={onToggleDone}
      />
      <CategoryActionCard
        title={hi ? 'घर के अंदर' : 'Indoor'}
        ariaLabel={hi ? 'घर के अंदर की हवा' : 'Indoor air actions'}
        icon={<Home className="w-5 h-5" />}
        sectionKey="indoor"
        items={advice.indoor.map((i) => ({
          action: i.action,
          why: i.why,
          chip: windowChip(i.timeWindow),
        }))}
        doneSet={doneSet}
        language={language}
        motionProps={getMotionProps(prefersReducedMotion, revealStage, 2, 0.06)}
        onToggleDone={onToggleDone}
      />
      <CategoryActionCard
        title={hi ? 'टिकाऊ दिनचर्या और यात्रा' : 'Sustainable Routine'}
        ariaLabel={hi ? 'टिकाऊ दिनचर्या और यात्रा' : 'Sustainable Routine'}
        icon={<TrainFront className="w-5 h-5" />}
        sectionKey="routine"
        items={advice.routine.map((i) => ({
          action: i.action,
          why: i.why,
          chip: i.co2Benefit || undefined,
        }))}
        doneSet={doneSet}
        language={language}
        motionProps={getMotionProps(prefersReducedMotion, revealStage, 3, 0.12)}
        onToggleDone={onToggleDone}
      />
      <ForWhomCard
        forWhom={advice.forWhom}
        motionProps={getMotionProps(prefersReducedMotion, revealStage, 4, 0.18)}
        hi={hi}
      />
    </div>
  );
};
