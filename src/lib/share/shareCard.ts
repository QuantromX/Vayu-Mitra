import type {
  AdviceResponse,
  Language,
  ShareCardSpec,
  ThemeTokens,
} from '../../types/index.ts';
import { renderShareCardBlob } from './canvasRenderer.ts';

export { renderShareCardBlob };

function collectCandidateActions(advice: AdviceResponse | null, hi: boolean): string[] {
  const actions: string[] = [];
  if (advice) {
    if (advice.outdoor[0]?.action) actions.push(advice.outdoor[0].action);
    if (advice.indoor[0]?.action) actions.push(advice.indoor[0].action);
    if (actions.length < 2 && advice.routine[0]?.action) {
      actions.push(advice.routine[0].action);
    }
  }
  if (actions.length === 0) {
    actions.push(
      hi
        ? 'कम प्रदूषण वाले समय में बाहरी काम निपटाएँ।'
        : 'Shift outdoor errands to the lower-pollution window ahead.',
      hi ? 'पीक धुंध के घंटों में खिड़कियाँ बंद रखें।' : 'Keep windows closed during peak haze hours.'
    );
  }
  return actions.slice(0, 2);
}

/**
 * Builds deterministic 1080x1350 Share Air Card data grounded in the active city,
 * scrubbed/live NAQI, verdict, top 2 actions, theme tokens, and alt text.
 */
export function buildShareCardSpec(params: {
  cityName: string;
  admin1?: string;
  aqi: number;
  categoryLabel: string;
  verdictLabel: string;
  verdictHeadline: string;
  advice: AdviceResponse | null;
  theme: ThemeTokens;
  updatedLabel: string;
  language: Language;
}): ShareCardSpec {
  const hi = params.language === 'hi';
  const cityTitle = params.admin1
    ? `${params.cityName}, ${params.admin1}`
    : params.cityName;
  const topActions = collectCandidateActions(params.advice, hi);
  const attribution = hi
    ? 'डेटा: Open-Meteo · भारत NAQI-शैली अनुमान'
    : 'Data: Open-Meteo · India NAQI-style estimate';
  const altText = hi
    ? `${cityTitle} के लिए वायुमित्र एयर कार्ड: NAQI ${params.aqi} (${params.categoryLabel}), निष्कर्ष: ${params.verdictLabel} — ${params.verdictHeadline}`
    : `VayuMitra Air Card for ${cityTitle}: NAQI ${params.aqi} (${params.categoryLabel}), Verdict: ${params.verdictLabel} — ${params.verdictHeadline}`;

  return {
    width: 1080,
    height: 1350,
    cityTitle,
    aqi: params.aqi,
    categoryLabel: params.categoryLabel,
    verdictLabel: params.verdictLabel,
    verdictHeadline: params.verdictHeadline,
    topActions,
    attribution,
    updatedLabel: params.updatedLabel,
    altText,
    theme: params.theme,
  };
}

/**
 * Lazy-callable share flow: renders 1080x1350 Air Card PNG and triggers Web Share API
 * with automatic PNG download fallback.
 */
export async function shareOrDownloadAirCard(
  spec: ShareCardSpec
): Promise<'shared' | 'downloaded'> {
  const blob = await renderShareCardBlob(spec);
  const slug = spec.cityTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const filename = `vayumitra-${slug}-${spec.aqi}.png`;
  const file = new File([blob], filename, { type: 'image/png' });

  const canWebShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] });

  if (canWebShare) {
    try {
      await navigator.share({
        title: `VayuMitra · ${spec.cityTitle}`,
        text: spec.altText,
        files: [file],
      });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'shared';
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  return 'downloaded';
}
