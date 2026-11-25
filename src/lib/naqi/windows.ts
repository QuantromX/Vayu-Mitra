import type {
  HourWindow,
  HourlyPollutantPoint,
  WindowDayLabel,
} from '../../types/index.ts';

function addOneHourLabel(hourLabel: string): { hour: string; wrappedDay: boolean } {
  const hr = Number(hourLabel.slice(0, 2));
  if (!Number.isFinite(hr)) return { hour: hourLabel, wrappedDay: false };
  const next = (hr + 1) % 24;
  return {
    hour: `${String(next).padStart(2, '0')}:00`,
    wrappedDay: hr === 23,
  };
}

function buildWindowCandidate(
  slice: HourlyPollutantPoint[],
  startIndex: number,
  effectiveSize: number
): HourWindow | null {
  if (slice.some((pt) => pt.naqi === null || pt.pm2_5 === null)) return null;
  const first = slice[0];
  const last = slice[slice.length - 1];
  if (!first || !last) return null;

  const avgNaqi = Math.round(
    slice.reduce((acc, pt) => acc + (pt.naqi ?? 0), 0) / effectiveSize
  );
  const avgPm25 = Math.round(
    slice.reduce((acc, pt) => acc + (pt.pm2_5 ?? 0), 0) / effectiveSize
  );
  const endBoundary = addOneHourLabel(last.hourLabel);
  const endDayLabel: WindowDayLabel =
    endBoundary.wrappedDay && last.dayLabel === 'Today' ? 'Tomorrow' : last.dayLabel;

  return {
    startHour: first.hourLabel,
    endHour: endBoundary.hour,
    dayLabel: first.dayLabel,
    endDayLabel,
    startIndex,
    endIndex: startIndex + effectiveSize - 1,
    avgNaqi,
    avgPm25,
  };
}

/**
 * Finds the cleanest and worst contiguous 3-hour windows strictly from a forward-looking
 * hourly slice (current hour onward up to +24h), labeling each window Today or Tomorrow.
 */
export function computeForwardCleanestAndWorstWindows(
  forwardHourly: HourlyPollutantPoint[],
  windowSize = 3
): { cleanestWindow: HourWindow | null; worstWindow: HourWindow | null } {
  const effectiveSize = Math.min(windowSize, forwardHourly.length);
  if (effectiveSize < 1) {
    return { cleanestWindow: null, worstWindow: null };
  }

  let cleanestWindow: HourWindow | null = null;
  let worstWindow: HourWindow | null = null;

  for (let i = 0; i <= forwardHourly.length - effectiveSize; i++) {
    const candidate = buildWindowCandidate(
      forwardHourly.slice(i, i + effectiveSize),
      i,
      effectiveSize
    );
    if (!candidate) continue;

    if (!cleanestWindow || candidate.avgNaqi < cleanestWindow.avgNaqi) {
      cleanestWindow = candidate;
    }
    if (!worstWindow || candidate.avgNaqi > worstWindow.avgNaqi) {
      worstWindow = candidate;
    }
  }

  return { cleanestWindow, worstWindow };
}
