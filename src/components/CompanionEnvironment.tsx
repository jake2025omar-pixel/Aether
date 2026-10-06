import React from 'react';
import { RoomEnvironment3D } from './room/RoomEnvironment3D';
import { CompanionState, CompanionEmotion } from '../lib/companionPersonality';

interface CompanionEnvironmentProps {
  companionState: CompanionState;
  companionEmotion: CompanionEmotion;
  visemeMouthOpen: number;
  companionModelUrl?: string | null;
  onStartInteraction?: () => void;
}

export const CompanionEnvironment: React.FC<CompanionEnvironmentProps> = ({
  companionState,
  companionEmotion,
  visemeMouthOpen,
  companionModelUrl,
  onStartInteraction,
}) => {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden select-none">
      {/* Full-screen 3D Room N & Companion Environment */}
      <RoomEnvironment3D
        companionState={companionState}
        companionEmotion={companionEmotion}
        visemeMouthOpen={visemeMouthOpen}
        companionModelUrl={companionModelUrl}
        onCompanionClick={onStartInteraction}
        className="w-full h-full"
      />
    </div>
  );
};
