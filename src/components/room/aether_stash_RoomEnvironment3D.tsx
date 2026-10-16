import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CompanionRig } from './CompanionRig';
import { applyNeonWorld3SpatialLayout } from './neonWorld3Layout';
import { CompanionState, CompanionEmotion, COMPANION_DISPLAY_NAME } from '../../lib/companionPersonality';
import { dispose3DResource, loadWeb3DAsset } from '@/Aether/3D/Preview/AssetPreviewLoader';
import { Mic, Volume2, Sparkles, Brain } from 'lucide-react';

export interface RoomEnvironment3DProps {
  companionState: CompanionState;
  companionEmotion: CompanionEmotion;
  visemeMouthOpen: number;
  companionModelUrl?: string | null;
  roomModelUrl?: string | null;
  onCompanionClick?: () => void;
  className?: string;
}

export const StashRoomEnvironment3D: React.FC<RoomEnvironment3DProps> = ({
  companionState,
  companionEmotion,
  visemeMouthOpen,
  companionModelUrl,
  roomModelUrl,
  onCompanionClick,
  className = '',
}) => {
  return null;
};
