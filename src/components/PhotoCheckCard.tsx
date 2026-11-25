import React, { useEffect, useId, useRef, useState } from 'react';
import { MEDICAL_DISCLAIMER } from '../lib/shared/domain.ts';
import {
  stripExifFromImage,
  validatePhotoFile,
  type StrippedPhotoPayload,
} from '../lib/vision/exifStrip.ts';
import type {
  NaqiResult,
  PhotoCheckResponse,
  PhotoSceneHint,
  ThemeTokens,
  UserProfile,
} from '../types/index.ts';
import { postPhotoCheckApi } from './assistant/assistantApi.ts';
import {
  PhotoHeaderBanner,
  PhotoPreviewBox,
  PhotoResultPanel,
  PhotoUploadToolbar,
} from './assistant/PhotoSubcomponents.tsx';

interface PhotoCheckCardProps {
  profile: UserProfile;
  naqi: NaqiResult | null;
  theme: ThemeTokens;
}

async function processSelectedPhoto(params: {
  e: React.ChangeEvent<HTMLInputElement>;
  hi: boolean;
  prevPreviewUrl?: string;
  setPreparing: (v: boolean) => void;
  setError: (msg: string | null) => void;
  setResult: (res: PhotoCheckResponse | null) => void;
  setStripped: (payload: StrippedPhotoPayload | null) => void;
}) {
  const { e, hi, prevPreviewUrl, setPreparing, setError, setResult, setStripped } =
    params;
  const file = e.target.files?.[0];
  if (!file) return;
  setError(null);
  setResult(null);

  const check = validatePhotoFile(file);
  if (!check.valid) {
    setError(hi ? (check.errorHi ?? 'अमान्य फ़ोटो') : (check.errorEn ?? 'Invalid image'));
    e.target.value = '';
    return;
  }
  setPreparing(true);
  try {
    const clean = await stripExifFromImage(file);
    if (prevPreviewUrl) URL.revokeObjectURL(prevPreviewUrl);
    setStripped(clean);
  } catch (err) {
    const fallback = hi
      ? 'फ़ोटो प्रोसेस करने में समस्या हुई।'
      : 'Could not prepare image locally.';
    setError(err instanceof Error ? err.message : fallback);
  } finally {
    setPreparing(false);
  }
}

function usePhotoCheckController(
  profile: UserProfile,
  naqi: NaqiResult | null,
  fileInputRef: React.RefObject<HTMLInputElement | null>
) {
  const hi = profile.language === 'hi';
  const [sceneHint, setSceneHint] = useState<PhotoSceneHint>('auto');
  const [stripped, setStripped] = useState<StrippedPhotoPayload | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PhotoCheckResponse | null>(null);

  useEffect(() => {
    return () => {
      if (stripped?.previewUrl) URL.revokeObjectURL(stripped.previewUrl);
    };
  }, [stripped]);

  const handleClear = () => {
    if (stripped?.previewUrl) URL.revokeObjectURL(stripped.previewUrl);
    setStripped(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAnalyze = async () => {
    if (!stripped || analyzing) return;
    setAnalyzing(true);
    setError(null);
    try {
      const data = await postPhotoCheckApi({
        stripped,
        sceneHint,
        naqi,
        hasPurifier: profile.hasPurifier,
        language: profile.language,
      });
      setResult(data);
    } catch (err) {
      const fallback = hi
        ? 'फ़ोटो विश्लेषण पूरा नहीं हो सका।'
        : 'Could not complete photo check.';
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setAnalyzing(false);
    }
  };

  return {
    sceneHint,
    setSceneHint,
    stripped,
    preparing,
    analyzing,
    error,
    result,
    handleClear,
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      processSelectedPhoto({
        e,
        hi,
        prevPreviewUrl: stripped?.previewUrl,
        setPreparing,
        setError,
        setResult,
        setStripped,
      }),
    handleAnalyze,
  };
}

const PhotoCheckCard: React.FC<PhotoCheckCardProps> = ({ profile, naqi, theme }) => {
  const hi = profile.language === 'hi';
  const fileInputId = useId();
  const errorId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ctrl = usePhotoCheckController(profile, naqi, fileInputRef);

  return (
    <section
      aria-label={hi ? 'फ़ोटो जांच — कमरा या आसमान' : 'Photo Check — Room or Sky'}
      className="vm-glass-card rounded-[24px] p-5 sm:p-6 space-y-4"
    >
      <PhotoHeaderBanner theme={theme} hi={hi} />
      <PhotoUploadToolbar
        sceneHint={ctrl.sceneHint}
        onChangeSceneHint={ctrl.setSceneHint}
        fileInputId={fileInputId}
        errorId={errorId}
        error={ctrl.error}
        fileInputRef={fileInputRef}
        preparing={ctrl.preparing}
        analyzing={ctrl.analyzing}
        stripped={ctrl.stripped}
        hi={hi}
        onFileChange={(e) => void ctrl.handleFileChange(e)}
        onAnalyze={() => void ctrl.handleAnalyze()}
        onClear={ctrl.handleClear}
      />
      {ctrl.stripped && <PhotoPreviewBox stripped={ctrl.stripped} hi={hi} />}
      <p className="text-xs text-slate-300">{MEDICAL_DISCLAIMER[profile.language]}</p>
      <div aria-live="polite" className="space-y-3">
        {ctrl.error && (
          <div
            id={errorId}
            role="alert"
            className="rounded-xl bg-rose-950/75 border border-rose-300/35 px-4 py-3 text-xs text-rose-100"
          >
            {ctrl.error}
          </div>
        )}
        {ctrl.result && <PhotoResultPanel result={ctrl.result} hi={hi} />}
      </div>
    </section>
  );
};

export default React.memo(PhotoCheckCard);
