import * as THREE from 'three';
import { CompanionEmotion, CompanionState } from '../companionPersonality';
import { BreathingController } from './BreathingController';
import { EyeBehaviorController } from './EyeBehaviorController';
import { PostureController } from './PostureController';
import { HeadMotionController } from './HeadMotionController';
import { SpeechAnimationController } from './SpeechAnimationController';
import { MicroMovementController } from './MicroMovementController';
import { EmotionController } from './EmotionController';
import { HumanBehaviorFrame } from './types';

export class HumanBehaviorController {
  private breathing = new BreathingController();
  private eye = new EyeBehaviorController();
  private posture = new PostureController();
  private head = new HeadMotionController();
  private speech = new SpeechAnimationController();
  private micro = new MicroMovementController();
  private emotionCtrl = new EmotionController();

  private currentState: CompanionState = 'IDLE';
  private synthesizedLookAt = new THREE.Vector3(0, 1.45, 3.4);

  public setEmotion(emotion: CompanionEmotion, intensity = 0.7): void {
    this.emotionCtrl.setEmotion(emotion, intensity);
    if (emotion === 'SURPRISED') {
      this.breathing.triggerGasp();
    }
  }

  public setState(state: CompanionState): void {
    if (state === this.currentState) return;
    const prevState = this.currentState;
    this.currentState = state;

    if (state === 'SPEAKING' && prevState !== 'SPEAKING') {
      this.breathing.prepareSpeechInhale();
    } else if (state === 'LISTENING' && prevState === 'SPEAKING') {
      this.breathing.triggerSigh();
    }
  }

  public onSpeechStart(text: string): void {
    this.breathing.prepareSpeechInhale();
    this.speech.onSpeechStart(text);
  }

  public onSpeechEnd(): void {
    this.speech.onSpeechEnd();
  }

  public update(
    dt: number,
    elapsedTime: number,
    targetCameraPos: THREE.Vector3,
    avatarRootPos: THREE.Vector3,
    visemeMouthOpen: number
  ): HumanBehaviorFrame {
    // 1. Update Emotional State with momentum
    const emotionSnap = this.emotionCtrl.update(dt);
    const emotion = emotionSnap.currentEmotion;
    const intensity = emotionSnap.intensity;

    // 2. Compute Direction to Camera/User in local avatar space
    const dirToCam = new THREE.Vector3()
      .copy(targetCameraPos)
      .sub(avatarRootPos)
      .normalize();

    // 3. Update Individual Micro-Behaviors
    const isSpeaking = this.currentState === 'SPEAKING' || visemeMouthOpen > 0.05;

    const respiration = this.breathing.update(
      dt,
      emotion,
      intensity,
      this.currentState,
      isSpeaking
    );

    const eyeSample = this.eye.update(
      dt,
      emotion,
      intensity,
      this.currentState
    );

    const postureSample = this.posture.update(
      dt,
      elapsedTime,
      emotion,
      intensity,
      this.currentState
    );

    const headSample = this.head.update(
      dt,
      elapsedTime,
      emotion,
      intensity,
      this.currentState,
      visemeMouthOpen,
      dirToCam
    );

    const speechSample = this.speech.update(
      dt,
      this.currentState,
      emotion,
      intensity,
      visemeMouthOpen
    );

    const microSample = this.micro.update(
      dt,
      emotion,
      this.currentState
    );

    // 4. Synthesize Dynamic 3D Look-At Target (incorporating eye saccades & aversion)
    // Offset camera position by gaze saccade in world space
    this.synthesizedLookAt.copy(targetCameraPos);
    this.synthesizedLookAt.x += eyeSample.gazeOffset.x * 0.45;
    this.synthesizedLookAt.y += eyeSample.gazeOffset.y * 0.45;

    return {
      timestamp: elapsedTime,
      deltaTime: dt,
      emotion,
      targetEmotion: emotionSnap.targetEmotion,
      emotionIntensity: intensity,
      conversationState: this.currentState,
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
