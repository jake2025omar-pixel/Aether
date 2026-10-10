import * as THREE from 'three';
import { CompanionEmotion, CompanionState } from '../companionPersonality';
import { HeadBehaviorSample } from './types';

export class HeadMotionController {
  private currentRotation = new THREE.Vector3(0, 0, 0);
  private targetRotation = new THREE.Vector3(0, 0, 0);

  // Listening nod mechanics
  private isNodding = false;
  private nodProgress = 0;
  private nodCycles = 1;
  private nodTimer = 0;
  private nextNodCooldown = 4.5;

  constructor() {
    this.nextNodCooldown = 3.5 + Math.random() * 4.0;
  }

  public triggerNod(cycles = 1): void {
    if (!this.isNodding) {
      this.isNodding = true;
      this.nodProgress = 0;
      this.nodCycles = cycles;
    }
  }

  public update(
    dt: number,
    elapsedTime: number,
    emotion: CompanionEmotion,
    emotionIntensity: number,
    state: CompanionState,
    speechViseme: number,
    targetLookDir?: THREE.Vector3 | null
  ): HeadBehaviorSample {
    // 1. Organic Base Micro-Sway (Multi-sinusoid wandering so head is never frozen)
    const organicYaw =
      Math.sin(elapsedTime * 0.47) * 0.015 +
      Math.sin(elapsedTime * 0.19 + 0.8) * 0.01;
    const organicPitch =
      Math.sin(elapsedTime * 0.61 + 1.2) * 0.012 +
      Math.sin(elapsedTime * 0.28) * 0.008;
    const organicRoll =
      Math.sin(elapsedTime * 0.35 + 2.3) * 0.008;

    let targetPitch = organicPitch;
    let targetYaw = organicYaw;
    let targetRoll = organicRoll;

    // 2. Camera tracking influence (Look towards user)
    if (targetLookDir) {
      targetYaw += THREE.MathUtils.clamp(targetLookDir.x * 0.18, -0.16, 0.16);
      targetPitch += THREE.MathUtils.clamp(-targetLookDir.y * 0.09, -0.10, 0.10);
    }

    // 3. Emotional & Conversational Postures
    switch (emotion) {
      case 'CONFUSED':
      case 'CURIOUS':
        // Inquisitive lateral head tilt
        targetRoll += 0.075 * (0.8 + emotionIntensity * 0.4);
        targetYaw += 0.03;
        targetPitch -= 0.02;
        break;
      case 'THINKING':
        // Cognitive head tilt & slight look up or down
        targetPitch += 0.045;
        targetRoll -= 0.04;
        targetYaw += 0.05;
        break;
      case 'SAD':
      case 'EMPATHETIC':
        // Downcast head, gentle tilt
        targetPitch += 0.05 * emotionIntensity;
        targetRoll += 0.035;
        break;
      case 'HAPPY':
      case 'AFFECTIONATE':
        // Warm, open slight tilt
        targetRoll -= 0.04 * emotionIntensity;
        targetPitch -= 0.02;
        break;
      case 'ANGRY':
      case 'GENTLY_ANNOYED':
        // Firm, controlled forward orientation
        targetRoll = 0;
        targetPitch += 0.02;
        break;
    }

    // 4. Listening Behavior: Intermittent natural nodding
    if (state === 'LISTENING') {
      this.nodTimer += dt;
      if (this.nodTimer >= this.nextNodCooldown && !this.isNodding) {
        this.triggerNod(Math.random() < 0.4 ? 2 : 1);
        this.nodTimer = 0;
        this.nextNodCooldown = 4.0 + Math.random() * 5.0;
      }
      // Attentive slight head tilt
      targetRoll += 0.03;
    }

    // Execute active nod pulses
    if (this.isNodding) {
      this.nodProgress += dt * 3.8;
      const totalProgress = this.nodProgress / this.nodCycles;
      if (totalProgress >= 1.0) {
        this.isNodding = false;
      } else {
        // Natural decaying sine nod: pitch down then return
        const phase = this.nodProgress * Math.PI * 2;
        const decay = 1.0 - totalProgress;
        const nodAngle = Math.sin(phase) * 0.038 * decay;
        targetPitch += Math.max(0, nodAngle); // Mostly downward nodding
      }
    }

    // 5. Speech Cadence Accents: Verbal rhythm dips
    if (state === 'SPEAKING' && speechViseme > 0.05) {
      const speechNod = Math.sin(elapsedTime * 7.5) * 0.015 * speechViseme;
      targetPitch += speechNod;
      targetYaw += Math.sin(elapsedTime * 3.2) * 0.01 * speechViseme;
    }

    // Critically damped spring towards target
    this.currentRotation.x = THREE.MathUtils.damp(this.currentRotation.x, targetPitch, 4.5, dt);
    this.currentRotation.y = THREE.MathUtils.damp(this.currentRotation.y, targetYaw, 4.0, dt);
    this.currentRotation.z = THREE.MathUtils.damp(this.currentRotation.z, targetRoll, 4.0, dt);

    return {
      rotation: this.currentRotation.clone(),
      translation: new THREE.Vector3(0, 0, 0),
      isNodding: this.isNodding,
      isTilted: Math.abs(this.currentRotation.z) > 0.04,
    };
  }
}
