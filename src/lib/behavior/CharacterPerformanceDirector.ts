import * as THREE from 'three';
import { CompanionEmotion, CompanionState } from '../companionPersonality';
import { BreathingController } from './BreathingController';
import { EyeBehaviorController } from './EyeBehaviorController';
import { PostureController } from './PostureController';
import { HeadMotionController } from './HeadMotionController';
import { SpeechAnimationController } from './SpeechAnimationController';
import { MicroMovementController } from './MicroMovementController';
import { EmotionController } from './EmotionController';
import { FingerHandController, DualHandFingerSample, HandPosePreset } from './FingerHandController';
import { LocomotionController, LocomotionSample } from './LocomotionController';
import { FacialPerformanceEngine, FacialPerformanceSample, AnimeExpressionStyle } from './FacialPerformanceEngine';
import { FullBodyActionDirector, FullBodyActionSample, FullBodyActionType } from './FullBodyActionDirector';
import { VisemeFrame } from '../phonemeLipSync';

export interface UnifiedPerformanceFrame {
  timestamp: number;
  deltaTime: number;

  // Emotional Performance
  emotion: CompanionEmotion;
  targetEmotion: CompanionEmotion;
  emotionIntensity: number;
  conversationState: CompanionState;

  // Facial Performance (Presets & Direct Anime Morphs)
  facial: FacialPerformanceSample;

  // Finger & Hand Articulation (30 Bones)
  hands: DualHandFingerSample;

  // Autonomous Locomotion & Navigation (Legs, Feet, Pelvis, World Position)
  locomotion: LocomotionSample;

  // Full-Body Choreographed Actions
  action: FullBodyActionSample;

  // Physiological Micro-Systems
  respiration: ReturnType<BreathingController['update']>;
  eye: ReturnType<EyeBehaviorController['update']>;
  posture: ReturnType<PostureController['update']>;
  head: ReturnType<HeadMotionController['update']>;
  speech: ReturnType<SpeechAnimationController['update']>;
  micro: ReturnType<MicroMovementController['update']>;

  // Dynamic Look-At Target (incorporating saccades & emotional aversion)
  lookAtTarget: THREE.Vector3;
}

export class CharacterPerformanceDirector {
  // Subsystems
  public readonly breathing = new BreathingController();
  public readonly eye = new EyeBehaviorController();
  public readonly posture = new PostureController();
  public readonly head = new HeadMotionController();
  public readonly speech = new SpeechAnimationController();
  public readonly micro = new MicroMovementController();
  public readonly emotionCtrl = new EmotionController();
  public readonly hands = new FingerHandController();
  public readonly locomotion = new LocomotionController();
  public readonly facial = new FacialPerformanceEngine();
  public readonly actionDirector = new FullBodyActionDirector();

  private currentState: CompanionState = 'IDLE';
  private synthesizedLookAt = new THREE.Vector3(0, 1.45, 3.4);

  public setEmotion(emotion: CompanionEmotion, intensity = 0.7): void {
    this.emotionCtrl.setEmotion(emotion, intensity);
    // Spontaneously and clearly execute the character's movement and performance for each emotion
    switch (emotion) {
      case 'HAPPY':
        this.facial.triggerExpressionStyle('LAUGHTER_BURST', 2.8);
        break;

      case 'AFFECTIONATE':
        this.facial.triggerExpressionStyle('AFFECTIONATE_TENDER', 3.5);
        break;

      case 'ROMANTIC':
        this.facial.triggerExpressionStyle('AFFECTIONATE_TENDER', 3.8);
        break;

      case 'SHY':
        this.facial.triggerExpressionStyle('SHY_BLUSH_LOOK_AWAY', 3.2);
        break;

      case 'SURPRISED':
        this.breathing.triggerGasp();
        this.facial.triggerExpressionStyle('SURPRISE_EYE_WIDEN', 2.5);
        break;

      case 'THINKING':
        this.facial.triggerExpressionStyle('THOUGHTFUL_PURSE', 3.2);
        break;

      case 'CONFUSED':
        this.facial.triggerExpressionStyle('MISCHIEVOUS_SMIRK', 2.6);
        break;

      case 'CURIOUS':
        this.facial.triggerExpressionStyle('SURPRISE_EYE_WIDEN', 2.4);
        break;

      case 'EMPATHETIC':
        this.facial.triggerExpressionStyle('AFFECTIONATE_TENDER', 3.2);
        break;

      case 'SAD':
        this.breathing.triggerSigh();
        this.facial.triggerExpressionStyle('SLEEPY_DROOP', 3.0);
        break;

      case 'GENTLY_ANNOYED':
        this.facial.triggerExpressionStyle('POUT_ANNORD', 2.8);
        break;

      case 'ANGRY':
        this.facial.triggerExpressionStyle('POUT_ANNORD', 3.0);
        break;

      case 'NEUTRAL':
      default:
        this.facial.triggerExpressionStyle('NATURAL', 2.0);
        break;
    }
  }

  public setState(state: CompanionState): void {
    if (state === this.currentState) return;
    const prevState = this.currentState;
    this.currentState = state;

    if (state === 'SPEAKING' && prevState !== 'SPEAKING') {
      this.breathing.prepareSpeechInhale();
      // If currently walking, smoothly slow down to converse with presence
      this.locomotion.stop();
    } else if (state === 'LISTENING' && prevState === 'SPEAKING') {
      this.breathing.triggerSigh();
    } else if (state === 'THINKING') {
      this.facial.triggerExpressionStyle('THOUGHTFUL_PURSE', 3.0);
    }
  }

  public onSpeechStart(text: string): void {
    this.breathing.prepareSpeechInhale();
    this.speech.onSpeechStart(text);
    this.locomotion.stop();
  }

  public onSpeechEnd(): void {
    this.speech.onSpeechEnd();
  }

  public triggerAction(type: FullBodyActionType, force = true): boolean {
    return this.actionDirector.triggerAction(type, force);
  }

  public triggerFacialStyle(style: AnimeExpressionStyle, duration = 3.5): void {
    this.facial.triggerExpressionStyle(style, duration);
  }

  public navigateTo(target: THREE.Vector3, faceYaw?: number): void {
    this.locomotion.navigateTo(target, faceYaw);
  }

  public setAutonomousNavigation(enabled: boolean): void {
    this.locomotion.setAutonomousNavigation(enabled);
  }

  public update(
    dt: number,
    elapsedTime: number,
    targetCameraPos: THREE.Vector3,
    avatarRootPos: THREE.Vector3,
    visemeMouthOpen: number,
    visemeFrame?: VisemeFrame | null
  ): UnifiedPerformanceFrame {
    const frameDelta = Math.min(Math.max(dt, 0), 0.05);

    // 1. Emotion Engine with Momentum
    const emotionSnap = this.emotionCtrl.update(frameDelta);
    const emotion = emotionSnap.currentEmotion;
    const intensity = emotionSnap.intensity;

    // 2. Camera Direction Vector
    const dirToCam = new THREE.Vector3()
      .copy(targetCameraPos)
      .sub(avatarRootPos)
      .normalize();

    // 3. Respiration & Breathing
    const isSpeaking = this.currentState === 'SPEAKING' || visemeMouthOpen > 0.05;
    const respiration = this.breathing.update(
      frameDelta,
      emotion,
      intensity,
      this.currentState,
      isSpeaking
    );

    // 4. Eye Micro-Saccades & Blink
    const eyeSample = this.eye.update(
      frameDelta,
      emotion,
      intensity,
      this.currentState
    );

    // 5. Posture & Contrapposto Weight Transfer
    const postureSample = this.posture.update(
      frameDelta,
      elapsedTime,
      emotion,
      intensity,
      this.currentState
    );

    // 6. Head Kinematics & Attentive Nods
    const headSample = this.head.update(
      frameDelta,
      elapsedTime,
      emotion,
      intensity,
      this.currentState,
      visemeMouthOpen,
      dirToCam
    );

    // 7. Conversational Speech Gestures
    const speechSample = this.speech.update(
      frameDelta,
      this.currentState,
      emotion,
      intensity,
      visemeMouthOpen
    );

    // 8. Micro-Movements & Biological Noise
    const microSample = this.micro.update(
      frameDelta,
      emotion,
      this.currentState
    );

    // 9. Autonomous Locomotion & Room Navigation
    const isHighPriority = this.actionDirector.getActiveAction() !== null || isSpeaking;
    const locomotionSample = this.locomotion.update(frameDelta, isHighPriority);

    // 10. Choreographed Full-Body Actions
    const actionSample = this.actionDirector.update(
      frameDelta,
      elapsedTime,
      this.currentState,
      emotion,
      isSpeaking,
      locomotionSample.isMoving
    );

    // If an action dictates an expressive facial style, synchronize it
    if (actionSample.isActionActive && actionSample.offsets.facialStyle !== 'NATURAL') {
      this.facial.triggerExpressionStyle(actionSample.offsets.facialStyle, 1.5);
    }

    // 11. Advanced Anime Facial Acting & Visemes
    const facialSample = this.facial.update(
      frameDelta,
      elapsedTime,
      emotion,
      intensity,
      this.currentState,
      visemeMouthOpen,
      eyeSample.leftBlink,
      eyeSample.squint,
      visemeFrame
    );

    // 12. Hand & Finger Articulation Layering
    // Speech itself never forces a repeated hand gesture; context actions own that layer.
    let leftHandPose: HandPosePreset = 'RELAXED';
    let rightHandPose: HandPosePreset = 'RELAXED';
    if (actionSample.activeAction) {
      leftHandPose = actionSample.offsets.leftHandPose;
      rightHandPose = actionSample.offsets.rightHandPose;
    }

    this.hands.setLeftPose(leftHandPose, 5.5);
    this.hands.setRightPose(rightHandPose, 5.5);
    const handSample = this.hands.update(frameDelta, elapsedTime);

    // 13. Dynamic Look-At Synthesis
    this.synthesizedLookAt.copy(targetCameraPos);
    this.synthesizedLookAt.x += (eyeSample.gazeOffset.x + facialSample.gazeAversion.x) * 0.45;
    this.synthesizedLookAt.y += (eyeSample.gazeOffset.y + facialSample.gazeAversion.y) * 0.45;

    return {
      timestamp: elapsedTime,
      deltaTime: frameDelta,
      emotion,
      targetEmotion: emotionSnap.targetEmotion,
      emotionIntensity: intensity,
      conversationState: this.currentState,
      facial: facialSample,
      hands: handSample,
      locomotion: locomotionSample,
      action: actionSample,
      respiration,
      eye: eyeSample,
      posture: postureSample,
      head: headSample,
      speech: speechSample,
      micro: microSample,
      lookAtTarget: this.synthesizedLookAt.clone(),
    };
  }
}
