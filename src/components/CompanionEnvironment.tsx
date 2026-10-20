import React from 'react';
import { RoomEnvironment3D } from './room/RoomEnvironment3D';
import { CompanionState, CompanionEmotion } from '../lib/companionPersonality';

import { VisemeFrame } from '../lib/phonemeLipSync';

interface CompanionEnvironmentProps {
  companionState: CompanionState;
  companionEmotion: CompanionEmotion;
  visemeMouthOpen: number;
  visemeFrame?: VisemeFrame | null;
  companionModelUrl?: string | null;
  roomModelUrl?: string | null;
  onStartInteraction?: () => void;
  currentSpeechText?: string | null;
}

export const CompanionEnvironment: React.FC<CompanionEnvironmentProps> = ({
  companionState,
  companionEmotion,
  visemeMouthOpen,
  visemeFrame,
  companionModelUrl,
  roomModelUrl,
  onStartInteraction,
  currentSpeechText = null,
}) => {
  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden select-none">
      {/* Full-screen 3D Room N & Companion Environment */}
      <RoomEnvironment3D
        companionState={companionState}
        companionEmotion={companionEmotion}
        visemeMouthOpen={visemeMouthOpen}
        visemeFrame={visemeFrame}
        companionModelUrl={companionModelUrl}
        roomModelUrl={roomModelUrl}
        onCompanionClick={onStartInteraction}
        currentSpeechText={currentSpeechText}
        className="w-full h-full"
      />
    </div>
  );
};
