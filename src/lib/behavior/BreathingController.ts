import * as THREE from 'three';
import { CompanionEmotion, CompanionState } from '../companionPersonality';
import { RespirationSample } from './types';

export class BreathingController {
  private phaseTime: number = 0;
  private currentCycleDuration: number = 4.0;
  private lungVolume: number = 0;
  private prevVolume: number = 0;
  private isSighing: boolean = false;
  private sighProgress: number = 0;
  private isGasping: boolean = false;
  private gaspProgress: number = 0;
  private timeSinceLastSigh: number = 0;
  private nextSighCooldown: number = 25.0;

  // Speech breathing state
  private speechInhaleArmed: boolean = false;
  private speechInhaleProgress: number = 0;

  constructor() {
    this.currentCycleDuration = 3.8 + Math.random() * 0.6;
    this.nextSighCooldown = 20.0 + Math.random() * 30.0;
  }

  /**
   * Signals that a speech utterance is about to begin.
   * Triggers a subtle, natural preparatory inhale.
   */
  public prepareSpeechInhale(): void {
    this.speechInhaleArmed = true;
    this.speechInhaleProgress = 0;
  }

  /**
   * Triggers a natural sigh (e.g. after relief, sadness, or long idle)
   */
  public triggerSigh(): void {
    if (!this.isSighing && !this.isGasping) {
      this.isSighing = true;
      this.sighProgress = 0;
    }
  }

  /**
   * Triggers a sharp gasp (e.g. upon sudden surprise or shock)
   */
  public triggerGasp(): void {
    this.isGasping = true;
    this.gaspProgress = 0;
  }

  public update(
    dt: number,
    emotion: CompanionEmotion,
    emotionIntensity: number,
    state: CompanionState,
    speechActive: boolean
  ): RespirationSample {
    this.timeSinceLastSigh += dt;

    // Determine target cycle duration and depth based on emotion
    let baseCycleDuration = 4.2; // ~14 breaths per minute
    let depthMultiplier = 1.0;
    let shoulderMultiplier = 1.0;

    switch (emotion) {
      case 'CALM' as any:
      case 'NEUTRAL':
        baseCycleDuration = 4.4;
        depthMultiplier = 0.95;
        break;
      case 'HAPPY':
      case 'AFFECTIONATE':
        baseCycleDuration = 3.6;
        depthMultiplier = 1.1;
        break;
      case 'SAD':
      case 'EMPATHETIC':
        baseCycleDuration = 5.2; // slow, heavy
        depthMultiplier = 1.25;
        shoulderMultiplier = 0.75;
        // Sadness has higher probability of sighs
        if (this.timeSinceLastSigh > this.nextSighCooldown * 0.6 && Math.random() < 0.003) {
          this.triggerSigh();
        }
        break;
      case 'ANGRY':
      case 'GENTLY_ANNOYED':
        baseCycleDuration = 2.8; // fast, tense
        depthMultiplier = 1.35;
        shoulderMultiplier = 1.4;
        break;
      case 'SURPRISED':
        baseCycleDuration = 2.4;
        depthMultiplier = 1.4;
        break;
      case 'THINKING':
      case 'CONFUSED':
      case 'CURIOUS':
        baseCycleDuration = 3.9;
        depthMultiplier = 0.9;
        break;
    }

    // High intensity increases rate and depth
    baseCycleDuration *= 1.0 - emotionIntensity * 0.2;
    depthMultiplier *= 1.0 + emotionIntensity * 0.3;

    // Conversational state adjustments
    if (state === 'LISTENING') {
      // Slightly calmer, attentive breathing
      baseCycleDuration *= 1.1;
      depthMultiplier *= 0.85;
    } else if (state === 'SPEAKING' || speechActive) {
      // Speech breathing: faster exhales during speech
      baseCycleDuration = 3.2;
      depthMultiplier = 1.15;
    }

    // Occasional spontaneous sigh during long idle
    if (this.timeSinceLastSigh > this.nextSighCooldown && state === 'IDLE' && !this.isSighing) {
      this.triggerSigh();
      this.timeSinceLastSigh = 0;
      this.nextSighCooldown = 25.0 + Math.random() * 35.0;
    }

    // Process Preparatory Speech Inhale
    if (this.speechInhaleArmed) {
      this.speechInhaleProgress += dt * 3.5; // ~0.3s quick intake
      if (this.speechInhaleProgress >= 1.0) {
        this.speechInhaleArmed = false;
        this.lungVolume = 0.85;
      } else {
        const t = this.speechInhaleProgress;
        this.lungVolume = THREE.MathUtils.lerp(this.lungVolume, 0.85, t);
      }
    } else if (this.isGasping) {
      // Sharp gasp: rapid inhale (0.2s), hold (0.5s), slow release
      this.gaspProgress += dt;
      if (this.gaspProgress < 0.25) {
        this.lungVolume = THREE.MathUtils.lerp(0.2, 0.95, this.gaspProgress / 0.25);
      } else if (this.gaspProgress < 0.8) {
        this.lungVolume = 0.95;
      } else if (this.gaspProgress < 1.8) {
        const t = (this.gaspProgress - 0.8) / 1.0;
        this.lungVolume = THREE.MathUtils.lerp(0.95, 0.1, t * t);
      } else {
        this.isGasping = false;
        this.phaseTime = 0;
      }
    } else if (this.isSighing) {
      // Deep sigh: expansive inhale (1.8s) -> long releasing exhale with shoulder drop (2.5s)
      this.sighProgress += dt;
      const totalSigh = 4.2;
      if (this.sighProgress < 1.7) {
        const t = this.sighProgress / 1.7;
        const curve = Math.sin(t * (Math.PI / 2));
        this.lungVolume = 0.3 + 0.7 * curve; // Up to 1.0
      } else if (this.sighProgress < totalSigh) {
        const t = (this.sighProgress - 1.7) / (totalSigh - 1.7);
        // Ease out quadratic falling to near 0
        this.lungVolume = 1.0 - Math.pow(t, 1.8) * 0.95;
      } else {
        this.isSighing = false;
        this.phaseTime = 0;
      }
    } else {
      // Standard continuous physiological respiration cycle
      this.phaseTime += dt;
      if (this.phaseTime >= this.currentCycleDuration) {
        this.phaseTime = 0;
        // Subtle organic variation per cycle (+/- 12%)
        this.currentCycleDuration = baseCycleDuration * (0.88 + Math.random() * 0.24);
      }

      const cycleNorm = this.phaseTime / Math.max(this.currentCycleDuration, 0.5);

      // Human breathing curve:
      // 0.00 -> 0.40 : Inhale (smooth S-curve up)
      // 0.40 -> 0.48 : Inhale turnaround pause
      // 0.48 -> 0.84 : Exhale (smooth relaxation down)
      // 0.84 -> 1.00 : Rest pause (lungs at resting functional capacity)
      if (cycleNorm < 0.40) {
        const t = cycleNorm / 0.40;
        this.lungVolume = 0.15 + 0.85 * (t * t * (3 - 2 * t));
      } else if (cycleNorm < 0.48) {
        this.lungVolume = 1.0;
      } else if (cycleNorm < 0.84) {
        const t = (cycleNorm - 0.48) / 0.36;
        // Relaxation has slightly faster initial falloff
        this.lungVolume = 1.0 - 0.85 * (1 - Math.cos(t * Math.PI)) / 2;
      } else {
        this.lungVolume = 0.15;
      }
    }

    const respirationVelocity = (this.lungVolume - this.prevVolume) / Math.max(dt, 0.001);
    this.prevVolume = this.lungVolume;

    // Compute anatomic biomechanical offsets
    const volume = this.lungVolume * depthMultiplier;

    // 1. Chest Expansion: Pitch up slightly (ribcage lift) and scale
    const chestExpansion = (volume - 0.15) * 0.024;

    // 2. Clavicle / Shoulder lift: Follows chest inhale with a tiny lag
    const shoulderLift = (volume - 0.15) * 0.018 * shoulderMultiplier;

    // 3. Spine Curvature: Lower spine extends slightly on inhale
    const spineExpansion = (volume - 0.15) * 0.012;

    // 4. Neck tension / subtle extension
    const neckTension = (volume - 0.15) * 0.005;

    return {
      lungVolume: this.lungVolume,
      respirationVelocity,
      chestExpansion,
      shoulderLift,
      spineExpansion,
      neckTension,
      isGasp: this.isGasping,
      isSigh: this.isSighing,
    };
  }
}
