import type React from 'react';
import { DelhiLandmark } from './DelhiLandmark.tsx';
import { GenericLandmark } from './GenericLandmark.tsx';
import { KolkataLandmark } from './KolkataLandmark.tsx';
import { LucknowLandmark } from './LucknowLandmark.tsx';
import { MumbaiLandmark } from './MumbaiLandmark.tsx';
import { resolveCitySkyline, type SkylineCityKey } from './skylinePalette.ts';

export type { SkylineCityKey };
export { resolveCitySkyline };

export const LandmarkMidLayer: React.FC<{ cityKey: SkylineCityKey }> = ({ cityKey }) => {
  switch (cityKey) {
    case 'delhi':
      return <DelhiLandmark />;
    case 'mumbai':
      return <MumbaiLandmark />;
    case 'lucknow':
      return <LucknowLandmark />;
    case 'kolkata':
      return <KolkataLandmark />;
    default:
      return <GenericLandmark />;
  }
};
