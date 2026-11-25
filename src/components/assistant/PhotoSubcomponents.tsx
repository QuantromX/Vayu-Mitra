import type React from 'react';
import { Camera, Loader2, ShieldCheck, Trash2, Wind } from 'lucide-react';
import type { StrippedPhotoPayload } from '../../lib/vision/exifStrip.ts';
import type { PhotoSceneHint, ThemeTokens } from '../../types/index.ts';

export { PhotoPreviewBox, PhotoResultPanel } from './PhotoResultPanel.tsx';

const SCENE_OPTIONS: ReadonlyArray<{ id: PhotoSceneHint; en: string; hi: string }> = [
  { id: 'auto', en: 'Auto', hi: 'स्वतः' },
  { id: 'room', en: 'Room', hi: 'कमरा' },
  { id: 'sky', en: 'Sky', hi: 'आसमान' },
];

function getUploadButtonLabel(preparing: boolean, hi: boolean): string {
  if (preparing) return hi ? 'EXIF हटाया जा रहा है...' : 'Stripping EXIF...';
  return hi ? 'फ़ोटो चुनें / खींचें (≤ 4 MB)' : 'Upload or take photo (≤ 4 MB)';
}

function getAnalyzeButtonLabel(analyzing: boolean, hi: boolean): string {
  if (analyzing) return hi ? 'जांच हो रही है...' : 'Analyzing...';
  return hi ? 'फ़ोटो जांचें' : 'Check photo';
}

export const PhotoHeaderBanner: React.FC<{ theme?: ThemeTokens; hi: boolean }> = ({
  hi,
}) => (
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div className="flex items-center gap-2.5">
      <Camera className="w-5 h-5 shrink-0 vm-accent-text" aria-hidden="true" />
      <div>
        <h2 className="font-display text-lg font-semibold text-white">
          {hi ? 'फ़ोटो जांच (कमरा या आसमान)' : 'Photo Check (Room or Sky)'}
        </h2>
        <p className="text-xs text-slate-300">
          {hi
            ? 'प्यूरीफायर रखने की जगह, वेंटिलेशन या बाहरी धुंध का परामर्श अनुमान — यह सेंसर माप नहीं है।'
            : 'Visual advisory cues for purifier placement, ventilation, or sky haze — not an air sensor measurement.'}
        </p>
      </div>
    </div>

    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/60 border border-white/15 text-xs text-slate-200">
      <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" aria-hidden="true" />
      <span>
        {hi
          ? 'EXIF डेटा ब्राउज़र में हटता है · फ़ोटो सेव नहीं होती'
          : 'EXIF stripped locally · Never stored'}
      </span>
    </span>
  </div>
);

const PhotoActionButtons: React.FC<{
  fileInputId: string;
  errorId: string;
  error: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  preparing: boolean;
  analyzing: boolean;
  stripped: StrippedPhotoPayload | null;
  hi: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAnalyze: () => void;
  onClear: () => void;
}> = ({
  fileInputId,
  errorId,
  error,
  fileInputRef,
  preparing,
  analyzing,
  stripped,
  hi,
  onFileChange,
  onAnalyze,
  onClear,
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <label
      htmlFor={fileInputId}
      className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-950/70 border border-white/25 text-xs font-semibold text-white hover:bg-white/15 inline-flex items-center gap-2 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-white"
    >
      <Camera className="w-4 h-4" aria-hidden="true" />
      <span>{getUploadButtonLabel(preparing, hi)}</span>
    </label>
    <input
      ref={fileInputRef}
      id={fileInputId}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      capture="environment"
      aria-invalid={Boolean(error)}
      aria-describedby={error ? errorId : undefined}
      onChange={onFileChange}
      className="sr-only"
    />

    {stripped && (
      <>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={analyzing}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-white text-slate-950 text-xs font-semibold inline-flex items-center gap-2 hover:bg-slate-100 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {analyzing ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Wind className="w-4 h-4" aria-hidden="true" />
          )}
          <span>{getAnalyzeButtonLabel(analyzing, hi)}</span>
        </button>

        <button
          type="button"
          onClick={onClear}
          aria-label={hi ? 'फ़ोटो हटाएँ' : 'Clear selected photo'}
          className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl bg-slate-950/60 border border-white/20 text-slate-200 hover:text-white hover:bg-white/15 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </>
    )}
  </div>
);

export const PhotoUploadToolbar: React.FC<{
  sceneHint: PhotoSceneHint;
  onChangeSceneHint: (hint: PhotoSceneHint) => void;
  fileInputId: string;
  errorId: string;
  error: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  preparing: boolean;
  analyzing: boolean;
  stripped: StrippedPhotoPayload | null;
  hi: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAnalyze: () => void;
  onClear: () => void;
}> = (props) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <div
      role="group"
      aria-label={props.hi ? 'फ़ोटो दृश्य प्रकार' : 'Photo scene type'}
      className="inline-flex p-1 rounded-xl bg-slate-950/60 border border-white/15 self-start"
    >
      {SCENE_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          aria-pressed={props.sceneHint === opt.id}
          onClick={() => props.onChangeSceneHint(opt.id)}
          className={`min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
            props.sceneHint === opt.id
              ? 'bg-white text-slate-950'
              : 'text-slate-200 hover:text-white'
          }`}
        >
          {props.hi ? opt.hi : opt.en}
        </button>
      ))}
    </div>

    <PhotoActionButtons
      fileInputId={props.fileInputId}
      errorId={props.errorId}
      error={props.error}
      fileInputRef={props.fileInputRef}
      preparing={props.preparing}
      analyzing={props.analyzing}
      stripped={props.stripped}
      hi={props.hi}
      onFileChange={props.onFileChange}
      onAnalyze={props.onAnalyze}
      onClear={props.onClear}
    />
  </div>
);
