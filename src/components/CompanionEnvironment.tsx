import React from 'react';
import { AetherHeroGlass } from './ui/AetherHeroGlass';

interface CompanionEnvironmentProps {
  onStartInteraction?: () => void;
}

export const CompanionEnvironment: React.FC<CompanionEnvironmentProps> = ({
  onStartInteraction,
}) => {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none px-4">
      {/* Central Quister-style Landing Hero Surface */}
      <div className="z-10 animate-in fade-in zoom-in-95 duration-500">
        <AetherHeroGlass onClick={onStartInteraction} />
      </div>
    </div>
  );
};
