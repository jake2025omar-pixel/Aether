import * as THREE from 'three';
import { HandPosePreset } from './FingerHandController';
import { AnimeExpressionStyle } from './FacialPerformanceEngine';
import { CompanionEmotion, CompanionState } from '../companionPersonality';

export type FullBodyActionType =
  | 'HEAD_SCRATCH'
  | 'FRIENDLY_WAVE'
  | 'EXPRESSIVE_SHRUG'
  | 'LAUGH_REACTION'
  | 'THINKING_CONTEMPLATION'
  | 'AFFECTIONATE_REACH'
  | 'SURPRISED_RECOIL'
  | 'CONFIDENT_HIP_REST'
  | 'EXPLANATORY_GESTURE';

export interface ActionJointOffsets {
  leftUpperArm: THREE.Vector3;
  leftLowerArm: THREE.Vector3;
  leftHand: THREE.Vector3;
  leftHandPose: HandPosePreset;

  rightUpperArm: THREE.Vector3;
  rightLowerArm: THREE.Vector3;
  rightHand: THREE.Vector3;
  rightHandPose: HandPosePreset;

  head: THREE.Vector3;
  torso: THREE.Vector3;
  shoulders: { leftZ: number; rightZ: number };
  facialStyle: AnimeExpressionStyle;
}

export interface FullBodyActionSample {
  activeAction: FullBodyActionType | null;
  progress: number;
  weight: number;
  isActionActive: boolean;
  offsets: ActionJointOffsets;
}

interface ActionDefinition {
  type: FullBodyActionType;
  duration: number;
  cooldownSeconds: number;
  compute: (phase: number, time: number) => ActionJointOffsets;
}

const DEFAULT_OFFSETS: ActionJointOffsets = {
  leftUpperArm: new THREE.Vector3(),
  leftLowerArm: new THREE.Vector3(),
  leftHand: new THREE.Vector3(),
  leftHandPose: 'RELAXED',

  rightUpperArm: new THREE.Vector3(),
  rightLowerArm: new THREE.Vector3(),
  rightHand: new THREE.Vector3(),
  rightHandPose: 'RELAXED',

  head: new THREE.Vector3(),
  torso: new THREE.Vector3(),
  shoulders: { leftZ: 0, rightZ: 0 },
  facialStyle: 'NATURAL',
};

// Smooth bell curve envelope for preparation -> peak -> recovery
function bellCurve(t: number): number {
  return Math.sin(Math.max(0, Math.min(1, t)) * Math.PI);
}

export class FullBodyActionDirector {
  private currentAction: FullBodyActionType | null = null;
  private actionTimer = 0;
  private actionDuration = 3.0;
  private actionWeight = 0;

  // History & Cooldowns
  private actionHistory: Array<{ type: FullBodyActionType; timestamp: number }> = [];
  private readonly cooldowns: Record<FullBodyActionType, number> = {
    HEAD_SCRATCH: 16,
    FRIENDLY_WAVE: 12,
    EXPRESSIVE_SHRUG: 14,
    LAUGH_REACTION: 15,
    THINKING_CONTEMPLATION: 18,
    AFFECTIONATE_REACH: 14,
    SURPRISED_RECOIL: 16,
    CONFIDENT_HIP_REST: 20,
    EXPLANATORY_GESTURE: 10,
  };

  public triggerAction(type: FullBodyActionType, force = false): boolean {
    const now = performance.now() / 1000;

    if (!force) {
      // Check cooldown
      const lastEntry = this.actionHistory.slice().reverse().find((item) => item.type === type);
      if (lastEntry && now - lastEntry.timestamp < this.cooldowns[type]) {
        return false; // Still on cooldown
      }
    }

    this.currentAction = type;
    this.actionTimer = 0;

    switch (type) {
      case 'HEAD_SCRATCH':
        this.actionDuration = 3.8;
        break;
      case 'FRIENDLY_WAVE':
        this.actionDuration = 3.2;
        break;
      case 'EXPRESSIVE_SHRUG':
        this.actionDuration = 2.6;
        break;
      case 'LAUGH_REACTION':
        this.actionDuration = 3.5;
        break;
      case 'THINKING_CONTEMPLATION':
        this.actionDuration = 4.2;
        break;
      case 'AFFECTIONATE_REACH':
        this.actionDuration = 3.6;
        break;
      case 'SURPRISED_RECOIL':
        this.actionDuration = 2.8;
        break;
      case 'CONFIDENT_HIP_REST':
        this.actionDuration = 4.5;
        break;
      case 'EXPLANATORY_GESTURE':
        this.actionDuration = 3.0;
        break;
    }

    this.actionHistory.push({ type, timestamp: now });
    if (this.actionHistory.length > 20) {
      this.actionHistory.shift();
    }

    return true;
  }

  public interrupt(): void {
    if (this.currentAction) {
      this.currentAction = null;
      this.actionTimer = 0;
    }
  }

  public getActiveAction(): FullBodyActionType | null {
    return this.currentAction;
  }

  public update(
    dt: number,
    time: number,
    _state: CompanionState,
    _emotion: CompanionEmotion,
    _isSpeaking: boolean,
    _isWalking: boolean
  ): FullBodyActionSample {
    const frameDelta = Math.min(Math.max(dt, 0), 0.05);
    if (this.currentAction) {
      this.actionTimer += frameDelta;
      const progress = Math.min(1.0, this.actionTimer / this.actionDuration);

      // Smooth weight envelope
      const targetWeight = bellCurve(progress);
      this.actionWeight = THREE.MathUtils.damp(this.actionWeight, targetWeight, 6.0, frameDelta);

      if (progress >= 1.0) {
        this.currentAction = null;
        this.actionTimer = 0;
      }

      const offsets = this.computeActionOffsets(this.currentAction || 'FRIENDLY_WAVE', progress, time);

      return {
        activeAction: this.currentAction,
        progress,
        weight: this.actionWeight,
        isActionActive: true,
        offsets,
      };
    } else {
      this.actionWeight = THREE.MathUtils.damp(this.actionWeight, 0, 7.0, frameDelta);
      return {
        activeAction: null,
        progress: 0,
        weight: this.actionWeight,
        isActionActive: false,
        offsets: { ...DEFAULT_OFFSETS },
      };
    }
  }

  private computeActionOffsets(action: FullBodyActionType, p: number, time: number): ActionJointOffsets {
    const envelope = bellCurve(p);

    switch (action) {
      case 'HEAD_SCRATCH': {
        // Hand moves up behind head, head tilts into hand, subtle scratch oscillation
        const scratchPulse = Math.sin(time * 14.0) * 0.04 * envelope;
        return {
          ...DEFAULT_OFFSETS,
          rightUpperArm: new THREE.Vector3(0.85 * envelope, -0.65 * envelope, -0.90 * envelope),
          rightLowerArm: new THREE.Vector3(0, 1.25 * envelope, 0),
          rightHand: new THREE.Vector3(0.25 * envelope + scratchPulse, 0, 0),
          rightHandPose: 'CHIN_TOUCH',
          head: new THREE.Vector3(0.08 * envelope, -0.12 * envelope, -0.15 * envelope), // Tilts toward hand
          torso: new THREE.Vector3(0.02 * envelope, 0, 0.03 * envelope),
          shoulders: { leftZ: 0, rightZ: 0.06 * envelope },
          facialStyle: 'MISCHIEVOUS_SMIRK',
        };
      }

      case 'FRIENDLY_WAVE': {
        // Arm raises, palm faces forward, hand waves back and forth
        const waveFlutter = Math.sin(time * 8.5) * 0.28 * envelope;
        return {
          ...DEFAULT_OFFSETS,
          rightUpperArm: new THREE.Vector3(0.65 * envelope, -0.30 * envelope, -1.35 * envelope),
          rightLowerArm: new THREE.Vector3(0, 0.95 * envelope, 0),
          rightHand: new THREE.Vector3(0, waveFlutter, waveFlutter * 0.4),
          rightHandPose: 'GENTLE_WAVE',
          head: new THREE.Vector3(0.05 * envelope, 0, 0.04 * envelope),
          torso: new THREE.Vector3(-0.02 * envelope, 0, -0.02 * envelope),
          shoulders: { leftZ: 0, rightZ: 0.08 * envelope },
          facialStyle: 'PLAYFUL_WINK',
        };
      }

      case 'EXPRESSIVE_SHRUG': {
        // Both shoulders lift, hands rotate outward, head tilts
        return {
          ...DEFAULT_OFFSETS,
          leftUpperArm: new THREE.Vector3(0.12 * envelope, 0.15 * envelope, 0.20 * envelope),
          leftLowerArm: new THREE.Vector3(0, -0.45 * envelope, 0),
          leftHand: new THREE.Vector3(0.10 * envelope, 0, 0),
          leftHandPose: 'SHRUG_PALMS',

          rightUpperArm: new THREE.Vector3(0.12 * envelope, -0.15 * envelope, -0.20 * envelope),
          rightLowerArm: new THREE.Vector3(0, 0.45 * envelope, 0),
          rightHand: new THREE.Vector3(0.10 * envelope, 0, 0),
          rightHandPose: 'SHRUG_PALMS',

          head: new THREE.Vector3(-0.04 * envelope, 0, 0.08 * envelope),
          torso: new THREE.Vector3(0, 0, 0),
          shoulders: { leftZ: 0.16 * envelope, rightZ: 0.16 * envelope }, // Strong shoulder shrug
          facialStyle: 'POUT_ANNORD',
        };
      }

      case 'LAUGH_REACTION': {
        // Torso bounces, head tips, hand moves near mouth
        const laughBounce = Math.sin(time * 16.0) * 0.035 * envelope;
        return {
          ...DEFAULT_OFFSETS,
          rightUpperArm: new THREE.Vector3(0.55 * envelope, -0.35 * envelope, -0.45 * envelope),
          rightLowerArm: new THREE.Vector3(0, 0.85 * envelope, 0),
          rightHand: new THREE.Vector3(0.15 * envelope, 0, 0),
          rightHandPose: 'MOUTH_COVER',

          leftUpperArm: new THREE.Vector3(0.08 * envelope, 0, 0.05 * envelope),
          leftLowerArm: new THREE.Vector3(0, -0.15 * envelope, 0),
          leftHand: new THREE.Vector3(0, 0, 0),
          leftHandPose: 'RELAXED',

          head: new THREE.Vector3((-0.10 + laughBounce * 2) * envelope, 0, 0.05 * envelope),
          torso: new THREE.Vector3((0.06 + laughBounce) * envelope, 0, 0),
          shoulders: { leftZ: 0.08 * envelope + laughBounce, rightZ: 0.08 * envelope + laughBounce },
          facialStyle: 'LAUGHTER_BURST',
        };
      }

      case 'THINKING_CONTEMPLATION': {
        // Hand to chin, index touching cheek, head tilted up
        return {
          ...DEFAULT_OFFSETS,
          rightUpperArm: new THREE.Vector3(0.48 * envelope, -0.25 * envelope, -0.42 * envelope),
          rightLowerArm: new THREE.Vector3(0, 0.92 * envelope, 0),
          rightHand: new THREE.Vector3(0.18 * envelope, 0, 0),
          rightHandPose: 'CHIN_TOUCH',

          leftUpperArm: new THREE.Vector3(0.10 * envelope, 0.15 * envelope, 0.10 * envelope),
          leftLowerArm: new THREE.Vector3(0, -0.35 * envelope, 0),
          leftHand: new THREE.Vector3(0, 0, 0),
          leftHandPose: 'FIDGET_TAP',

          head: new THREE.Vector3(-0.12 * envelope, 0.14 * envelope, 0.08 * envelope), // Looking up-right
          torso: new THREE.Vector3(-0.03 * envelope, 0, -0.02 * envelope),
          shoulders: { leftZ: 0, rightZ: 0.04 * envelope },
          facialStyle: 'THOUGHTFUL_PURSE',
        };
      }

      case 'AFFECTIONATE_REACH': {
        // Leans gently forward, extends right arm with soft open palm toward user
        return {
          ...DEFAULT_OFFSETS,
          rightUpperArm: new THREE.Vector3(0.35 * envelope, -0.12 * envelope, -0.38 * envelope),
          rightLowerArm: new THREE.Vector3(0, 0.52 * envelope, 0),
          rightHand: new THREE.Vector3(0.08 * envelope, 0, 0),
          rightHandPose: 'OPEN_PALM',

          leftUpperArm: new THREE.Vector3(0.08 * envelope, 0, 0.05 * envelope),
          leftLowerArm: new THREE.Vector3(0, -0.12 * envelope, 0),
          leftHand: new THREE.Vector3(0, 0, 0),
          leftHandPose: 'CHEST_HEART',

          head: new THREE.Vector3(0.06 * envelope, 0, -0.08 * envelope), // Warm tilt
          torso: new THREE.Vector3(0.07 * envelope, 0, 0), // Gentle lean towards camera
          shoulders: { leftZ: 0, rightZ: 0.02 * envelope },
          facialStyle: 'AFFECTIONATE_TENDER',
        };
      }

      case 'SURPRISED_RECOIL': {
        // Torso recoils back, hands lift to chest, wide eyes
        return {
          ...DEFAULT_OFFSETS,
          leftUpperArm: new THREE.Vector3(0.32 * envelope, 0.15 * envelope, 0.18 * envelope),
          leftLowerArm: new THREE.Vector3(0, -0.55 * envelope, 0),
          leftHand: new THREE.Vector3(0.12 * envelope, 0, 0),
          leftHandPose: 'CHEST_HEART',

          rightUpperArm: new THREE.Vector3(0.32 * envelope, -0.15 * envelope, -0.18 * envelope),
          rightLowerArm: new THREE.Vector3(0, 0.55 * envelope, 0),
          rightHand: new THREE.Vector3(0.12 * envelope, 0, 0),
          rightHandPose: 'CHEST_HEART',

          head: new THREE.Vector3(-0.08 * envelope, 0, 0),
          torso: new THREE.Vector3(-0.10 * envelope, 0, 0), // Sudden lean back
          shoulders: { leftZ: 0.12 * envelope, rightZ: 0.12 * envelope },
          facialStyle: 'SURPRISE_EYE_WIDEN',
        };
      }

      case 'CONFIDENT_HIP_REST': {
        // Right hand on hip, head tilt with smirk
        return {
          ...DEFAULT_OFFSETS,
          rightUpperArm: new THREE.Vector3(0.15 * envelope, -0.22 * envelope, -0.45 * envelope),
          rightLowerArm: new THREE.Vector3(0, 0.75 * envelope, 0),
          rightHand: new THREE.Vector3(0.18 * envelope, 0, 0),
          rightHandPose: 'HIP_REST',

          leftUpperArm: new THREE.Vector3(0.05 * envelope, 0, 0.05 * envelope),
          leftLowerArm: new THREE.Vector3(0, -0.10 * envelope, 0),
          leftHand: new THREE.Vector3(0, 0, 0),
          leftHandPose: 'RELAXED',

          head: new THREE.Vector3(0.04 * envelope, -0.08 * envelope, 0.10 * envelope),
          torso: new THREE.Vector3(0, 0.03 * envelope, -0.04 * envelope),
          shoulders: { leftZ: 0, rightZ: 0.05 * envelope },
          facialStyle: 'MISCHIEVOUS_SMIRK',
        };
      }

      case 'EXPLANATORY_GESTURE': {
        // Pointing gesture with right hand while left hand supports
        return {
          ...DEFAULT_OFFSETS,
          rightUpperArm: new THREE.Vector3(0.32 * envelope, -0.15 * envelope, -0.42 * envelope),
          rightLowerArm: new THREE.Vector3(0, 0.65 * envelope, 0),
          rightHand: new THREE.Vector3(0.12 * envelope, 0, 0),
          rightHandPose: 'POINTING',

          leftUpperArm: new THREE.Vector3(0.10 * envelope, 0.10 * envelope, 0.08 * envelope),
          leftLowerArm: new THREE.Vector3(0, -0.25 * envelope, 0),
          leftHand: new THREE.Vector3(0, 0, 0),
          leftHandPose: 'PALMS_UP_QUESTION',

          head: new THREE.Vector3(0.05 * envelope, -0.06 * envelope, 0),
          torso: new THREE.Vector3(0.03 * envelope, 0, 0),
          shoulders: { leftZ: 0.03 * envelope, rightZ: 0.04 * envelope },
          facialStyle: 'NATURAL',
        };
      }

      default:
        return { ...DEFAULT_OFFSETS };
    }
  }
}
