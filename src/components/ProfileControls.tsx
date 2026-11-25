import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import type {
  CityLocation,
  HouseholdGroup,
  LifestyleMode,
  UserProfile,
} from '../types/index.ts';
import { ProfileExpandedPanel } from './profile/ProfileExpandedPanel.tsx';
import { ProfileActionsBar, ProfileSummaryChips } from './profile/ProfileSummaryBar.tsx';

interface ProfileControlsProps {
  profile: UserProfile;
  activeSampleId: string | null;
  isOpen: boolean;
  onToggleOpen: () => void;
  onSelectCity: (city: CityLocation) => void;
  onToggleHousehold: (group: HouseholdGroup) => void;
  onChangeLifestyle: (lifestyle: LifestyleMode) => void;
  onChangePurifier: (hasPurifier: boolean) => void;
  onApplySample: (sampleId: string) => void;
  cityInputRef?: React.RefObject<HTMLInputElement | null>;
}

function useMenuOutsideDismiss(
  open: boolean,
  menuRef: React.RefObject<HTMLDivElement | null>,
  onClose: () => void
): void {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        menuRef.current &&
        e.target instanceof Node &&
        !menuRef.current.contains(e.target)
      ) {
        onClose();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, menuRef, onClose]);
}

export const ProfileControls: React.FC<ProfileControlsProps> = ({
  profile,
  activeSampleId,
  isOpen,
  onToggleOpen,
  onSelectCity,
  onToggleHousehold,
  onChangeLifestyle,
  onChangePurifier,
  onApplySample,
  cityInputRef,
}) => {
  const hi = profile.language === 'hi';
  const [sampleMenuOpen, setSampleMenuOpen] = useState(false);
  const sampleMenuRef = useRef<HTMLDivElement>(null);

  useMenuOutsideDismiss(sampleMenuOpen, sampleMenuRef, () => setSampleMenuOpen(false));

  return (
    <section
      aria-label={hi ? 'परिवार प्रोफ़ाइल संपादन' : 'Edit household profile'}
      className="vm-glass-card rounded-2xl p-4 sm:p-5 relative z-20"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <ProfileSummaryChips profile={profile} hi={hi} />

        <ProfileActionsBar
          activeSampleId={activeSampleId}
          sampleMenuOpen={sampleMenuOpen}
          isOpen={isOpen}
          hi={hi}
          sampleMenuRef={sampleMenuRef}
          onToggleSampleMenu={() => setSampleMenuOpen((prev) => !prev)}
          onApplySample={(id) => {
            onApplySample(id);
            setSampleMenuOpen(false);
          }}
          onToggleOpen={onToggleOpen}
        />
      </div>

      {isOpen && (
        <ProfileExpandedPanel
          profile={profile}
          activeSampleId={activeSampleId}
          onSelectCity={onSelectCity}
          onToggleHousehold={onToggleHousehold}
          onChangeLifestyle={onChangeLifestyle}
          onChangePurifier={onChangePurifier}
          onApplySample={onApplySample}
          cityInputRef={cityInputRef}
        />
      )}
    </section>
  );
};
