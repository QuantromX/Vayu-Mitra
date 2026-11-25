import type React from 'react';
import type { StrippedPhotoPayload } from '../../lib/vision/exifStrip.ts';
import type { PhotoCheckConfidence, PhotoCheckResponse } from '../../types/index.ts';

function confidenceLabel(confidence: PhotoCheckConfidence, hi: boolean): string {
  if (confidence === 'high') return hi ? 'विश्वसनीयता: उच्च' : 'Confidence: High';
  if (confidence === 'medium') return hi ? 'विश्वसनीयता: मध्यम' : 'Confidence: Medium';
  return hi ? 'विश्वसनीयता: सीमित' : 'Confidence: Low';
}

function getSourceLabel(source: PhotoCheckResponse['source'], hi: boolean): string {
  if (source === 'gemini') return hi ? 'Gemini Vision द्वारा' : 'Gemini Vision';
  return hi ? 'ऑफ़लाइन परामर्श' : 'Offline advisory fallback';
}

export const PhotoPreviewBox: React.FC<{
  stripped: StrippedPhotoPayload;
  hi: boolean;
}> = ({ stripped, hi }) => (
  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-2xl bg-slate-950/55 border border-white/15 p-3">
    <img
      src={stripped.previewUrl}
      width={96}
      height={96}
      alt={
        hi
          ? 'EXIF-मुक्त अपलोड की गई फ़ोटो का पूर्वावलोकन'
          : 'Preview of locally EXIF-stripped photo'
      }
      className="w-24 h-24 object-cover rounded-xl border border-white/20 shrink-0"
    />
    <div className="space-y-1 text-xs text-slate-200">
      <div className="font-semibold text-white">
        {hi
          ? 'जांच के लिए तैयार (EXIF और लोकेशन टैग हटा दिए गए)'
          : 'Ready to inspect (EXIF & GPS metadata stripped locally)'}
      </div>
      <div className="font-mono-tabular text-slate-300">
        {stripped.mimeType} · {Math.max(1, Math.round(stripped.byteSize / 1024))} KB
      </div>
    </div>
  </div>
);

export const PhotoResultPanel: React.FC<{ result: PhotoCheckResponse; hi: boolean }> = ({
  result,
  hi,
}) => (
  <div
    data-testid="photo-check-result"
    className="rounded-2xl bg-slate-950/65 border border-white/20 p-4 space-y-3"
  >
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="px-2.5 py-1 rounded-lg bg-white/15 border border-white/20 text-xs font-semibold text-white">
        {confidenceLabel(result.confidence, hi)}
      </span>
      <span className="text-xs text-slate-300">{getSourceLabel(result.source, hi)}</span>
    </div>

    <div>
      <h3 className="text-xs font-semibold text-slate-200 mb-1.5">
        {hi ? 'दृश्य अवलोकन' : 'Visual observations'}
      </h3>
      <ul className="list-disc pl-5 space-y-1 text-sm text-white">
        {result.observations.map((obs, idx) => (
          <li key={idx}>{obs}</li>
        ))}
      </ul>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10">
      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
        <div className="text-xs font-semibold text-slate-200 mb-1">
          {hi ? 'प्यूरीफायर / कमरा सुझाव' : 'Purifier / room placement'}
        </div>
        <p className="text-xs text-slate-100 leading-relaxed">
          {result.purifierPlacement}
        </p>
      </div>
      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
        <div className="text-xs font-semibold text-slate-200 mb-1">
          {hi ? 'वेंटिलेशन सुझाव' : 'Ventilation guidance'}
        </div>
        <p className="text-xs text-slate-100 leading-relaxed">{result.ventilationTip}</p>
      </div>
    </div>

    <p className="text-xs text-amber-200 leading-relaxed">{result.disclaimer}</p>
  </div>
);
