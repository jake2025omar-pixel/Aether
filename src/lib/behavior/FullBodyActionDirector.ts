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
  | 'ROMANTIC_GESTURE'
  | 'SURPRISED_RECOIL'
  | 'CONFIDENT_HIP_REST'
  | 'EXPLANATORY_GESTURE'
  | 'CURIOUS_LEAN'
  | 'EMPATHETIC_COMFORT'
  | 'SAD_PENSIVE'
  | 'ANGRY_STANCE'
  | 'CALM_SETTLE';

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
    ROMANTIC_GESTURE: 16,
    SURPRISED_RECOIL: 16,
    CONFIDENT_HIP_REST: 20,
    EXPLANATORY_GESTURE: 10,
    CURIOUS_LEAN: 14,
    EMPATHETIC_COMFORT: 14,
    SAD_PENSIVE: 16,
    ANGRY_STANCE: 18,
    CALM_SETTLE: 12,
  };

  // Autonomous gesture scheduling
  private timeSinceLastAction = 0;
  private nextIdleActionDelay = 22.0;

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
    this.timeSinceLastAction = 0;

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
      case 'ROMANTIC_GESTURE':
        this.actionDuration = 3.8;
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
      case 'CURIOUS_LEAN':
        this.actionDuration = 3.4;
        break;
      case 'EMPATHETIC_COMFORT':
        this.actionDuration = 3.8;
        break;
      case 'SAD_PENSIVE':
        this.actionDuration = 4.0;
        break;
      case 'ANGRY_STANCE':
        this.actionDuration = 3.6;
        break;
      case 'CALM_SETTLE':
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
    state: CompanionState,
    emotion: CompanionEmotion,
    isSpeaking: boolean,
    isWalking: boolean
  ): FullBodyActionSample {
    const frameDelta = Math.min(Math.max(dt, 0), 0.05);
    this.timeSinceLastAction += frameDelta;

    // Autonomous Action Spontaneous Selection when idle
    // Restricted so unprompted arm-raising animations never occur without explicit emotion or speech
    if (!this.currentAction && !isWalking && !isSpeaking && state === 'IDLE') {
      if (this.timeSinceLastAction >= this.nextIdleActionDelay) {
        this.timeSinceLastAction = 0;
        this.nextIdleActionDelay = 42.0 + Math.random() * 30.0;
        // Living baseline: peaceful settling only; arms remain naturally resting by side
        this.triggerAction('CALM_SETTLE');
      }
    }

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
        // Head tilts into position with subtle shoulder lift; stable neutral arm and hand pose
        return {
          ...DEFAULT_OFFSETS,
          rightUpperArm: new THREE.Vector3(),
          rightLowerArm: new THREE.Vector3(),
          rightHand: new THREE.Vector3(),
          rightHandPose: 'RELAXED',
          leftUpperArm: new THREE.Vector3(),
          leftLowerArm: new THREE.Vector3(),
          leftHand: new THREE.Vector3(),
          leftHandPose: 'RELAXED',
          head: new THREE.Vector3(0.08 * envelope, -0.12 * envelope, -0.15 * envelope), // Tilts toward shoulder
          torso: new THREE.Vector3(0.02 * envelope, 0, 0.03 * envelope),
          shoulders: { leftZ: 0, rightZ: 0.06 * envelope },
          facialStyle: 'MISCHIEVOUS_SMIRK',
        };
      }

      case 'FRIENDLY_WAVE': {
        // Welcoming greeting through cheerful head nod and shoulder accent; stable neutral arm and hand pose
        return {
          ...DEFAULT_OFFSETS,
          rightUpperArm: new THREE.Vector3(),
          rightLowerArm: new THREE.Vector3(),
          rightHand: new THREE.Vector3(),
          rightHandPose: 'RELAXED',
          leftUpperArm: new THREE.Vector3(),
          leftLowerArm: new THREE.Vector3(),
          leftHand: new THREE.Vector3(),
          leftHandPose: 'RELAXED',
          head: new THREE.Vector3(0.05 * envelope, 0, 0.04 * envelope),
          torso: new THREE.Vector3(-0.02 * envelope, 0, -0.02 * envelope),
          shoulders: { leftZ: 0, rightZ: 0.04 * envelope },
          facialStyle: 'LAUGHTER_BURST',
        };
      }

      case 'EXPRESSIVE_SHRUG': {
        // Both shoulders lift, head tilts; stable neutral arm and hand pose
        return {
          ...DEFAULT_OFFSETS,
          leftUpperArm: new THREE.Vector3(),
          leftLowerArm: new THREE.Vector3(),
          leftHand: new THREE.Vector3(),
          leftHandPose: 'RELAXED',

          rightUpperArm: new THREE.Vector3(),
          rightLowerArm: new THREE.Vector3(),
          rightHand: new THREE.Vector3(),
          rightHandPose: 'RELAXED',

          head: new THREE.Vector3(-0.04 * envelope, 0, 0.08 * envelope),
          torso: new THREE.Vector3(0, 0, 0),
          shoulders: { leftZ: 0.16 * envelope, rightZ: 0.16 * envelope }, // Strong shoulder shrug
          facialStyle: 'POUT_ANNORD',
        };
      }

      case 'LAUGH_REACTION': {
        // Torso bounces, head tips, shoulders cadence; stable neutral arm and hand pose
        const laughBounce = Math.sin(time * 16.0) * 0.035 * envelope;
        return {
          ...DEFAULT_OFFSETS,
          rightUpperArm: new THREE.Vector3(),
          rightLowerArm: new THREE.Vector3(),
          rightHand: new THREE.Vector3(),
          rightHandPose: 'RELAXED',

          leftUpperArm: new THREE.Vector3(),
          leftLowerArm: new THREE.Vector3(),
          leftHand: new THREE.Vector3(),
          leftHandPose: 'RELAXED',

          head: new THREE.Vector3((-0.10 + laughBounce * 2) * envelope, 0, 0.05 * envelope),
          torso: new THREE.Vector3((0.06 + laughBounce) * envelope, 0, 0),
          shoulders: { leftZ: 0.08 * envelope + laughBounce, rightZ: 0.08 * envelope + laughBounce },
          facialStyle: 'LAUGHTER_BURST',
        };
      }

      case 'THINKING_CONTEMPLATION': {
        // Inquisitive thinking posture: thoughtful head tilt and gaze; stable neutral arm and hand pose
        return {
          ...DEFAULT_OFFSETS,
          rightUpperArm: new THREE.Vector3(),
          rightLowerArm: new THREE.Vector3(),
          rightHand: new THREE.Vector3(),
          rightHandPose: 'RELAXED',

          leftUpperArm: new THREE.Vector3(),
          leftLowerArm: new THREE.Vector3(),
          leftHand: new THREE.Vector3(),
          leftHandPose: 'RELAXED',

          head: new THREE.Vector3(-0.12 * envelope, 0.14 * envelope, 0.08 * envelope), // Looking up-right
          torso: new THREE.Vector3(-0.03 * envelope, 0, -0.02 * envelope),
          shoulders: { leftZ: 0, rightZ: 0.04 * envelope },
          facialStyle: 'THOUGHTFUL_PURSE',
        };
      }

      case 'AFFECTIONATE_REACH': {
        // Leans gently forward toward user; stable neutral arm and hand pose
        return {
          ...DEFAULT_OFFSETS,
          rightUpperArm: new THREE.Vector3(),
          rightLowerArm: new THREE.Vector3(),
          rightHand: new THREE.Vector3(),
          rightHandPose: 'RELAXED',

          leftUpperArm: new THREE.Vector3(),
          leftLowerArm: new THREE.Vector3(),
          leftHand: new THREE.Vector3(),
          leftHandPose: 'RELAXED',

          head: new THREE.Vector3(0.06 * envelope, 0, -0.08 * envelope), // Warm tilt
          torso: new THREE.Vector3(0.07 * envelope, 0, 0), // Gentle lean towards camera
          shoulders: { leftZ: 0, rightZ: 0.02 * envelope },
          facialStyle: 'AFFECTIONATE_TENDER',
        };
      }

      case 'ROMANTIC_GESTURE': {
        // Modest romantic posture: gentle head angle and warm expression; stable neutral arm and hand pose
        return {
          ...DEFAULT_OFFSETS,
          rightUpperArm: new THREE.Vector3(),
          rightLowerArm: new THREE.Vector3(),
          rightHand: new THREE.Vector3(),
          rightHandPose: 'RELAXED',

          leftUpperArm: new THREE.Vector3(),
          leftLowerArm: new THREE.Vector3(),
          leftHand: new THREE.Vector3(),
          leftHandPose: 'RELAXED',

          head: new THREE.Vector3(0.04 * envelope, -0.05 * envelope, -0.07 * envelope),
          torso: new THREE.Vector3(0.025 * envelope, 0, 0),
          shoulders: { leftZ: 0.02 * envelope, rightZ: 0.03 * envelope },
          facialStyle: 'AFFECTIONATE_TENDER',
        };
      }

      case 'SURPRISED_RECOIL': {
        // Torso recoils back, wide eyes; stable neutral arm and hand pose
        return {
          ...DEFAULT_OFFSETS,
          leftUpperArm: new THREE.Vector3(),
          leftLowerArm: new THREE.Vector3(),
          leftHand: new THREE.Vector3(),
          leftHandPose: 'RELAXED',

          rightUpperArm: new THREE.Vector3(),
          rightLowerArm: new THREE.Vector3(),
          rightHand: new THREE.Vector3(),
          rightHandPose: 'RELAXED',

          head: new THREE.Vector3(-0.08 * envelope, 0, 0),
          torso: new THREE.Vector3(-0.10 * envelope, 0, 0), // Sudden lean back
          shoulders: { leftZ: 0.12 * envelope, rightZ: 0.12 * envelope },
          facialStyle: 'SURPRISE_EYE_WIDEN',
        };
      }

      case 'CONFIDENT_HIP_REST': {
        // Confident weight shift, head tilt with smirk; stable neutral arm and hand pose
        return {
          ...DEFAULT_OFFSETS,
          rightUpperArm: new THREE.Vector3(),
          rightLowerArm: new THREE.Vector3(),
          rightHand: new THREE.Vector3(),
          rightHandPose: 'RELAXED',

          leftUpperArm: new THREE.Vector3(),
          leftLowerArm: new THREE.Vector3(),
          leftHand: new THREE.Vector3(),
          leftHandPose: 'RELAXED',

          head: new THREE.Vector3(0.04 * envelope, -0.08 * envelope, 0.10 * envelope),
          torso: new THREE.Vector3(0, 0.03 * envelope, -0.04 * envelope),
          shoulders: { leftZ: 0, rightZ: 0.05 * envelope },
          facialStyle: 'MISCHIEVOUS_SMIRK',
        };
      }

      case 'EXPLANATORY_GESTURE': {
        // Conversational head and torso phrasing; stable neutral arm and hand pose
        return {
          ...DEFAULT_OFFSETS,
          rightUpperArm: new THREE.Vector3(),
          rightLowerArm: new THREE.Vector3(),
          rightHand: new THREE.Vector3(),
          rightHandPose: 'RELAXED',

          leftUpperArm: new THREE.Vector3(),
          leftLowerArm: new THREE.Vector3(),
          leftHand: new THREE.Vector3(),
          leftHandPose: 'RELAXED',

          head: new THREE.Vector3(0.05 * envelope, -0.06 * envelope, 0),
          torso: new THREE.Vector3(0.03 * envelope, 0, 0),
          shoulders: { leftZ: 0.03 * envelope, rightZ: 0.04 * envelope },
          facialStyle: 'NATURAL',
        };
      }

      case 'CURIOUS_LEAN': {
        // Inquisitive forward lean, curious tilt; stable neutral arm and hand pose
        return {
          ...DEFAULT_OFFSETS,
          rightUpperArm: new THREE.Vector3(),
          rightLowerArm: new THREE.Vector3(),
          rightHand: new THREE.Vector3(),
          rightHandPose: 'RELAXED',

          leftUpperArm: new THREE.Vector3(),
          leftLowerArm: new THREE.Vector3(),
          leftHand: new THREE.Vector3(),
          leftHandPose: 'RELAXED',

          head: new THREE.Vector3(-0.06 * envelope, 0.08 * envelope, -0.10 * envelope),
          torso: new THREE.Vector3(0.06 * envelope, 0, 0.02 * envelope),
          shoulders: { leftZ: 0, rightZ: 0.04 * envelope },
          facialStyle: 'NATURAL',
        };
      }

      case 'EMPATHETIC_COMFORT': {
        // Compassionate forward lean, caring expression; stable neutral arm and hand pose
        return {
          ...DEFAULT_OFFSETS,
          rightUpperArm: new THREE.Vector3(),
          rightLowerArm: new THREE.Vector3(),
          rightHand: new THREE.Vector3(),
          rightHandPose: 'RELAXED',

          leftUpperArm: new THREE.Vector3(),
          leftLowerArm: new THREE.Vector3(),
          leftHand: new THREE.Vector3(),
          leftHandPose: 'RELAXED',

          head: new THREE.Vector3(0.06 * envelope, 0.02 * envelope, 0.06 * envelope),
          torso: new THREE.Vector3(0.04 * envelope, 0, 0),
          shoulders: { leftZ: -0.02 * envelope, rightZ: 0.03 * envelope },
          facialStyle: 'AFFECTIONATE_TENDER',
        };
      }

      case 'SAD_PENSIVE': {
        // Gentle downcast posture, shoulders softening downwards; stable neutral arm and hand pose
        return {
          ...DEFAULT_OFFSETS,
          rightUpperArm: new THREE.Vector3(),
          rightLowerArm: new THREE.Vector3(),
          rightHand: new THREE.Vector3(),
          rightHandPose: 'RELAXED',

          leftUpperArm: new THREE.Vector3(),
          leftLowerArm: new THREE.Vector3(),
          leftHand: new THREE.Vector3(),
          leftHandPose: 'RELAXED',

          head: new THREE.Vector3(0.12 * envelope, 0, 0.04 * envelope),
          torso: new THREE.Vector3(0.05 * envelope, 0, 0),
          shoulders: { leftZ: -0.04 * envelope, rightZ: -0.04 * envelope },
          facialStyle: 'SLEEPY_DROOP',
        };
      }

      case 'ANGRY_STANCE': {
        // Assertive firm posture, head high; stable neutral arm and hand pose
        return {
          ...DEFAULT_OFFSETS,
          rightUpperArm: new THREE.Vector3(),
          rightLowerArm: new THREE.Vector3(),
          rightHand: new THREE.Vector3(),
          rightHandPose: 'RELAXED',

          leftUpperArm: new THREE.Vector3(),
          leftLowerArm: new THREE.Vector3(),
          leftHand: new THREE.Vector3(),
          leftHandPose: 'RELAXED',

          head: new THREE.Vector3(-0.04 * envelope, 0.04 * envelope, 0),
          torso: new THREE.Vector3(-0.02 * envelope, 0, -0.02 * envelope),
          shoulders: { leftZ: 0.03 * envelope, rightZ: 0.06 * envelope },
          facialStyle: 'POUT_ANNORD',
        };
      }

      case 'CALM_SETTLE': {
        // Peaceful posture reset, hands gracefully relaxed by side
        return {
          ...DEFAULT_OFFSETS,
          rightUpperArm: new THREE.Vector3(),
          rightLowerArm: new THREE.Vector3(),
          rightHand: new THREE.Vector3(),
          rightHandPose: 'RELAXED',

          leftUpperArm: new THREE.Vector3(),
          leftLowerArm: new THREE.Vector3(),
          leftHand: new THREE.Vector3(),
          leftHandPose: 'RELAXED',

          head: new THREE.Vector3(-0.02 * envelope, 0, 0),
          torso: new THREE.Vector3(0.01 * envelope, 0, 0),
          shoulders: { leftZ: 0, rightZ: 0 },
          facialStyle: 'NATURAL',
        };
      }

      default:
        return { ...DEFAULT_OFFSETS };
    }
  }
}
