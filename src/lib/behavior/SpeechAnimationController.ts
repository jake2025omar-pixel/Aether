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

    // Target arm rotations based on style and timing
    const t = this.speechTime;
    let targetRUpperX = 0;
    let targetRUpperY = 0;
    let targetRUpperZ = 0;
    let targetRLowerY = 0;
    let targetRHandX = 0;

    let targetLUpperX = 0;
    let targetLUpperY = 0;
    let targetLUpperZ = 0;
    let targetLLowerY = 0;
    let targetLHandX = 0;

    // Emotion Energy Scale
    let energy = 1.0;
    if (emotion === 'HAPPY' || emotion === 'CURIOUS') {
      energy = 1.25;
    } else if (emotion === 'SAD') {
      energy = 0.35;
    } else if (emotion === 'ANGRY') {
      energy = 1.3;
    } else if (emotion === 'AFFECTIONATE') {
      energy = 0.75;
    }

    if (this.currentStyle === 'SHORT') {
      // Short response: subtle right hand palm opening
      const wave = Math.sin(Math.min(t * 3.5, Math.PI));
      targetRUpperX = 0.06 * wave * energy;
      targetRUpperZ = -0.04 * wave * energy;
      targetRLowerY = 0.08 * wave;
      targetRHandX = 0.05 * wave;
    } else if (this.currentStyle === 'MEDIUM') {
      // Conversational one-handed phrasing gesture with cadence beat
      const phraseEnvelope = Math.sin(Math.min(t * 1.8, Math.PI));
      const cadence = Math.sin(t * 4.2) * 0.025 * visemeMouthOpen;

      targetRUpperX = (0.09 * phraseEnvelope + cadence) * energy;
      targetRUpperY = -0.05 * phraseEnvelope;
      targetRUpperZ = -0.06 * phraseEnvelope * energy;
      targetRLowerY = 0.12 * phraseEnvelope;
      targetRHandX = 0.08 * phraseEnvelope;

      // Subtle sympathetic micro-motion on left arm
      targetLUpperZ = 0.02 * phraseEnvelope;
    } else if (this.currentStyle === 'EXPLANATORY') {
      // Long explanation: Alternating natural gestures
      // Phase 1 (0 to 3s): Right hand leads
      // Phase 2 (3 to 6s): Both hands open in explanation
      // Phase 3 (6s+): Relaxed conversational pulses
      const cadence = Math.sin(t * 3.8) * 0.03 * (0.4 + visemeMouthOpen * 0.6);

      if (t < 3.2) {
        const p1 = Math.sin((t / 3.2) * Math.PI);
        targetRUpperX = (0.12 * p1 + cadence) * energy;
        targetRUpperZ = -0.08 * p1 * energy;
        targetRLowerY = 0.15 * p1;
        targetRHandX = 0.09 * p1;
      } else if (t < 7.0) {
        const p2 = Math.sin(((t - 3.2) / 3.8) * Math.PI);
        // Both hands slightly open in explanation
        targetRUpperX = (0.08 * p2 + cadence) * energy;
        targetRUpperZ = -0.06 * p2;
        targetRLowerY = 0.10 * p2;

        targetLUpperX = (0.07 * p2 - cadence * 0.5) * energy;
        targetLUpperZ = 0.05 * p2;
        targetLLowerY = -0.10 * p2;
      } else {
        // Sustained gentle speaking cadence
        const p3 = 0.5 + 0.5 * Math.sin(t * 1.5);
        targetRUpperX = (0.06 * p3 + cadence) * energy;
        targetRUpperZ = -0.04 * p3;
      }
    }

    // Apply smooth springs
    this.rightUpperArmOffset.x = THREE.MathUtils.damp(
      this.rightUpperArmOffset.x,
      targetRUpperX * this.gestureWeight,
      5.0,
      dt
    );
    this.rightUpperArmOffset.y = THREE.MathUtils.damp(
      this.rightUpperArmOffset.y,
      targetRUpperY * this.gestureWeight,
      5.0,
      dt
    );
    this.rightUpperArmOffset.z = THREE.MathUtils.damp(
      this.rightUpperArmOffset.z,
      targetRUpperZ * this.gestureWeight,
      5.0,
      dt
    );
    this.rightLowerArmOffset.y = THREE.MathUtils.damp(
      this.rightLowerArmOffset.y,
      targetRLowerY * this.gestureWeight,
      5.0,
      dt
    );
    this.rightHandOffset.x = THREE.MathUtils.damp(
      this.rightHandOffset.x,
      targetRHandX * this.gestureWeight,
      5.0,
      dt
    );

    this.leftUpperArmOffset.x = THREE.MathUtils.damp(
      this.leftUpperArmOffset.x,
      targetLUpperX * this.gestureWeight,
      5.0,
      dt
    );
    this.leftUpperArmOffset.y = THREE.MathUtils.damp(
      this.leftUpperArmOffset.y,
      targetLUpperY * this.gestureWeight,
      5.0,
      dt
    );
    this.leftUpperArmOffset.z = THREE.MathUtils.damp(
      this.leftUpperArmOffset.z,
      targetLUpperZ * this.gestureWeight,
      5.0,
      dt
    );
    this.leftLowerArmOffset.y = THREE.MathUtils.damp(
      this.leftLowerArmOffset.y,
      targetLLowerY * this.gestureWeight,
      5.0,
      dt
    );
    this.leftHandOffset.x = THREE.MathUtils.damp(
      this.leftHandOffset.x,
      targetLHandX * this.gestureWeight,
      5.0,
      dt
    );

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
        targetRUpperX * 0.15 * this.gestureWeight,
        0,
        -targetRUpperZ * 0.1 * this.gestureWeight
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
