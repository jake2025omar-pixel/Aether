import * as THREE from 'three';
import { CompanionEmotion, CompanionState } from '../companionPersonality';
import { EyeBehaviorSample } from './types';

export class EyeBehaviorController {
  // Saccade dynamics
  private currentGaze = new THREE.Vector2(0, 0);
  private targetGaze = new THREE.Vector2(0, 0);
  private saccadeTimer = 0;
  private nextSaccadeInterval = 0.35;

  // Thinking gaze aversion
  private isAvertingGaze = false;
  private aversionDuration = 1.8;
  private aversionTimer = 0;
  private aversionDirection = new THREE.Vector2(-0.25, 0.18); // default glance up & left

  // Blinking mechanics
  private blinkTimer = 0;
  private nextBlinkInterval = 3.6;
  private isBlinking = false;
  private blinkProgress = 0;
  private isDoubleBlink = false;
  private doubleBlinkCount = 0;

  constructor() {
    this.scheduleNextBlink('NEUTRAL', 'IDLE');
    this.scheduleNextSaccade('NEUTRAL', 'IDLE');
  }

  private scheduleNextBlink(emotion: CompanionEmotion, state: CompanionState): void {
    // Human average: 14 blinks/minute (every 3 to 6 seconds)
    // Excited/Confused/Thinking increases frequency; intense listening decreases frequency
    let meanInterval = 4.2;
    if (state === 'THINKING' || emotion === 'CONFUSED') {
      meanInterval = 2.4;
    } else if (state === 'LISTENING') {
      meanInterval = 5.2; // Attentive focus
    } else if (emotion === 'SAD') {
      meanInterval = 4.8;
    } else if (emotion === 'ANGRY') {
      meanInterval = 6.0; // Fixed glare
    }

    // Organic variance
    this.nextBlinkInterval = meanInterval * (0.65 + Math.random() * 0.7);
    this.blinkTimer = 0;
    // 15% probability of a human double-blink
    this.isDoubleBlink = Math.random() < 0.15;
    this.doubleBlinkCount = 0;
  }

  private scheduleNextSaccade(emotion: CompanionEmotion, state: CompanionState): void {
    // Micro-saccades occur 2 to 4 times per second
    const interval = state === 'THINKING' ? 0.45 : 0.22 + Math.random() * 0.35;
    this.nextSaccadeInterval = interval;
    this.saccadeTimer = 0;

    if (!this.isAvertingGaze) {
      // Small micro-fixation tremor around origin (normalized screen coordinates)
      const magnitude = state === 'LISTENING' ? 0.025 : 0.055;
      const angle = Math.random() * Math.PI * 2;
      this.targetGaze.set(Math.cos(angle) * magnitude, Math.sin(angle) * magnitude * 0.6);
    }
  }

  public update(
    dt: number,
    emotion: CompanionEmotion,
    emotionIntensity: number,
    state: CompanionState
  ): EyeBehaviorSample {
    // 1. Gaze Aversion Logic for Thinking or Shyness
    if (state === 'THINKING') {
      if (!this.isAvertingGaze) {
        this.isAvertingGaze = true;
        this.aversionTimer = 0;
        this.aversionDuration = 1.2 + Math.random() * 1.4;
        // Looking up-left or down-right (classic human cognitive recall saccade)
        const signX = Math.random() > 0.4 ? -1 : 1;
        const signY = Math.random() > 0.3 ? 1 : -0.7;
        this.aversionDirection.set(
          signX * (0.18 + Math.random() * 0.12),
          signY * (0.12 + Math.random() * 0.10)
        );
      } else {
        this.aversionTimer += dt;
        if (this.aversionTimer >= this.aversionDuration) {
          // Re-engage gaze after thinking phase
          this.isAvertingGaze = false;
          this.targetGaze.set(0, 0);
        } else {
          this.targetGaze.copy(this.aversionDirection);
        }
      }
    } else {
      if (this.isAvertingGaze) {
        this.isAvertingGaze = false;
        this.targetGaze.set(0, 0);
      }
    }

    // 2. Micro-Saccade Processing
    this.saccadeTimer += dt;
    if (this.saccadeTimer >= this.nextSaccadeInterval) {
      this.scheduleNextSaccade(emotion, state);
    }

    // High-speed spring/lerp for saccades (eyes jump quickly, damping ~35)
    this.currentGaze.x = THREE.MathUtils.damp(this.currentGaze.x, this.targetGaze.x, 32, dt);
    this.currentGaze.y = THREE.MathUtils.damp(this.currentGaze.y, this.targetGaze.y, 32, dt);

    // 3. Blinking Physics
    this.blinkTimer += dt;
    let blinkValue = 0;

    if (!this.isBlinking && this.blinkTimer >= this.nextBlinkInterval) {
      this.isBlinking = true;
      this.blinkProgress = 0;
    }

    if (this.isBlinking) {
      // Real human blink takes ~220ms:
      // Fast closing: ~70ms
      // Minimal hold: ~25ms
      // Slower opening: ~125ms
      this.blinkProgress += dt * 4.6;

      if (this.blinkProgress < 0.35) {
        // Closing phase
        const t = this.blinkProgress / 0.35;
        blinkValue = Math.sin(t * (Math.PI / 2));
      } else if (this.blinkProgress < 0.45) {
        // Closed apex
        blinkValue = 1.0;
      } else if (this.blinkProgress < 1.0) {
        // Opening phase
        const t = (this.blinkProgress - 0.45) / 0.55;
        blinkValue = Math.cos(t * (Math.PI / 2));
      } else {
        // Blink finished
        if (this.isDoubleBlink && this.doubleBlinkCount === 0) {
          // Trigger second rapid blink
          this.doubleBlinkCount = 1;
          this.blinkProgress = 0;
          this.blinkTimer = 0;
        } else {
          this.isBlinking = false;
          blinkValue = 0;
          this.scheduleNextBlink(emotion, state);
        }
      }
    }

    // 4. Squint / Expression Eyelid Weight
    let squint = 0;
    if (emotion === 'HAPPY' || emotion === 'AFFECTIONATE') {
      squint = 0.18 + emotionIntensity * 0.22;
    } else if (emotion === 'ANGRY' || emotion === 'GENTLY_ANNOYED') {
      squint = 0.25 * emotionIntensity;
    }

    // 5. Emotional gaze biases (e.g. sadness lowers gaze, surprise widens eyes)
    const emotionalGazeOffset = this.currentGaze.clone();
    if (emotion === 'SAD' || emotion === 'EMPATHETIC') {
      emotionalGazeOffset.y -= 0.12 * emotionIntensity;
    } else if (emotion === 'SURPRISED') {
      emotionalGazeOffset.y += 0.05 * emotionIntensity;
    }

    return {
      gazeOffset: emotionalGazeOffset,
      leftBlink: THREE.MathUtils.clamp(blinkValue, 0, 1),
      rightBlink: THREE.MathUtils.clamp(blinkValue, 0, 1),
      squint,
      isSaccading: this.saccadeTimer < 0.06,
      attentionFocus: state === 'LISTENING' ? 1.0 : state === 'THINKING' ? 0.4 : 0.8,
    };
  }
}
