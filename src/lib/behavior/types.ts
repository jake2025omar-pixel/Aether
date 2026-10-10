import * as THREE from 'three';
import { CompanionEmotion, CompanionState } from '../companionPersonality';

export type HumanBehaviorState =
  | 'IDLE_WAITING'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'EMOTIONAL_REACTING'
  | 'RECOVERING';

export interface RespirationSample {
  /** 0 (empty) to 1 (full inhale) */
  lungVolume: number;
  /** Derivative of volume: positive = inhaling, negative = exhaling */
  respirationVelocity: number;
  /** Chest lift in radians/meters */
  chestExpansion: number;
  /** Clavicle/shoulder lift */
  shoulderLift: number;
  /** Spine curve change from breathing */
  spineExpansion: number;
  /** Neck pitch adjustment */
  neckTension: number;
  /** Inhale gasp flag */
  isGasp: boolean;
  /** Natural sigh flag */
  isSigh: boolean;
}

export interface EyeBehaviorSample {
  /** Gaze vector offset in normalized eye space */
  gazeOffset: THREE.Vector2;
  /** Left eye blink weight (0 to 1) */
  leftBlink: number;
  /** Right eye blink weight (0 to 1) */
  rightBlink: number;
  /** Eyelid squint / smile tension */
  squint: number;
  /** Saccade active flag */
  isSaccading: boolean;
  /** Pupillary / attention focus factor */
  attentionFocus: number;
}

export interface PostureSample {
  /** Weight shift factor: -1 (left leg) to +1 (right leg) */
  weightShift: number;
  /** Hip tilt in radians (Roll Z) */
  hipTiltZ: number;
  /** Hip yaw in radians (Turn Y) */
  hipYawY: number;
  /** Spine compensation (Roll Z and Pitch X) */
  spineCurve: THREE.Vector3;
  /** Chest compensation */
  chestOrientation: THREE.Vector3;
  /** Left shoulder position/rotation offset */
  leftShoulderOffset: THREE.Vector3;
  /** Right shoulder position/rotation offset */
  rightShoulderOffset: THREE.Vector3;
  /** Subtle full-body organic sway */
  bodySway: THREE.Vector3;
}

export interface HeadBehaviorSample {
  /** Rotation offset: Pitch (X), Yaw (Y), Roll (Z) */
  rotation: THREE.Vector3;
  /** Position translation offset */
  translation: THREE.Vector3;
  /** Nodding intensity active */
  isNodding: boolean;
  /** Listening tilt active */
  isTilted: boolean;
}

export interface SpeechGestureSample {
  /** Left arm rotation offsets */
  leftArm: {
    upperArm: THREE.Vector3;
    lowerArm: THREE.Vector3;
    hand: THREE.Vector3;
  };
  /** Right arm rotation offsets */
  rightArm: {
    upperArm: THREE.Vector3;
    lowerArm: THREE.Vector3;
    hand: THREE.Vector3;
  };
  /** Torso gesture accent */
  torsoAccent: THREE.Vector3;
  /** Head verbal cadence accent */
  headAccent: THREE.Vector3;
  /** Active gesture style name */
  activeGestureName: string;
  /** Gesture blend weight */
  weight: number;
}

export interface MicroMovementSample {
  /** Subtle finger movement/twitches */
  leftHandFingers: number;
  rightHandFingers: number;
  /** Small shoulder twitch / shrug */
  shoulderTwitch: number;
  /** Small brow twitch */
  browTwitch: number;
  /** Lip micro-relax / suppress */
  mouthMicroTwitch: number;
}

export interface HumanBehaviorFrame {
  timestamp: number;
  deltaTime: number;
  emotion: CompanionEmotion;
  targetEmotion: CompanionEmotion;
  emotionIntensity: number;
  conversationState: CompanionState;
  respiration: RespirationSample;
  eye: EyeBehaviorSample;
  posture: PostureSample;
  head: HeadBehaviorSample;
  speech: SpeechGestureSample;
  micro: MicroMovementSample;
  /** Synthesized look-at target vector in world space */
  lookAtTarget: THREE.Vector3;
}

export interface SpeechUtteranceContext {
  text: string;
  wordCount: number;
  estimatedDurationSeconds: number;
  speechStartTime: number;
  isArabic: boolean;
}
