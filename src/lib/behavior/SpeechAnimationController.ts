import * as THREE from 'three';
import { CompanionEmotion, CompanionState } from '../companionPersonality';
import { SpeechGestureSample, SpeechUtteranceContext } from './types';

export class SpeechAnimationController {
  private activeContext: SpeechUtteranceContext | null = null;
  private speechTime = 0;
  private gestureWeight = 0;
  private currentStyle: 'SHORT' | 'MEDIUM' | 'EXPLANATORY' | 'REST' = 'REST';
  private gestureSeed = 0;

  // Output arm rotation offsets
  private leftUpperArmOffset = new THREE.Vector3(0, 0, 0);
  private leftLowerArmOffset = new THREE.Vector3(0, 0, 0);
  private leftHandOffset = new THREE.Vector3(0, 0, 0);

  private rightUpperArmOffset = new THREE.Vector3(0, 0, 0);
  private rightLowerArmOffset = new THREE.Vector3(0, 0, 0);
  private rightHandOffset = new THREE.Vector3(0, 0, 0);

  public onSpeechStart(text: string): void {
    const wordCount = (text.match(/\S+/gu) || []).length;
    this.speechTime = 0;
    this.gestureSeed = Math.random();

    let style: 'SHORT' | 'MEDIUM' | 'EXPLANATORY' = 'MEDIUM';
    if (wordCount <= 4) {
      style = 'SHORT';
    } else if (wordCount > 10) {
      style = 'EXPLANATORY';
    }

    this.currentStyle = style;
    this.activeContext = {
      text,
      wordCount,
      estimatedDurationSeconds: Math.max(1.2, wordCount * 0.38),
      speechStartTime: performance.now(),
      isArabic: /[\u0600-\u06FF]/.test(text),
    };
  }

  public onSpeechEnd(): void {
    this.activeContext = null;
    this.currentStyle = 'REST';
  }

  public update(
    dt: number,
    state: CompanionState,
    emotion: CompanionEmotion,
    emotionIntensity: number,
    visemeMouthOpen: number
  ): SpeechGestureSample {
    const isSpeaking = state === 'SPEAKING' || Boolean(this.activeContext);
    const targetWeight = isSpeaking ? 1.0 : 0.0;
    this.gestureWeight = THREE.MathUtils.damp(this.gestureWeight, targetWeight, 4.5, dt);

    if (isSpeaking) {
      this.speechTime += dt;
    }

    const t = this.speechTime;
    // Conversational rhythm cadences for speech
    const speechCadence = Math.sin(t * 3.8) * 0.02 * (0.4 + visemeMouthOpen * 0.6);

    // Keep arm and hand offsets strictly zero so speech never moves or raises hands
    this.rightUpperArmOffset.set(0, 0, 0);
    this.rightLowerArmOffset.set(0, 0, 0);
    this.rightHandOffset.set(0, 0, 0);

    this.leftUpperArmOffset.set(0, 0, 0);
    this.leftLowerArmOffset.set(0, 0, 0);
    this.leftHandOffset.set(0, 0, 0);

    return {
      leftArm: {
        upperArm: this.leftUpperArmOffset.clone(),
        lowerArm: this.leftLowerArmOffset.clone(),
        hand: this.leftHandOffset.clone(),
      },
      rightArm: {
        upperArm: this.rightUpperArmOffset.clone(),
        lowerArm: this.rightLowerArmOffset.clone(),
        hand: this.rightHandOffset.clone(),
      },
      torsoAccent: new THREE.Vector3(
        speechCadence * 0.15 * this.gestureWeight,
        0,
        0
      ),
      headAccent: new THREE.Vector3(
        Math.sin(t * 3.8) * 0.015 * this.gestureWeight,
        0,
        0
      ),
      activeGestureName: this.currentStyle,
      weight: this.gestureWeight,
    };
  }
}
