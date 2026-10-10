import * as THREE from 'three';
import { CompanionEmotion, CompanionState } from '../companionPersonality';
import { PostureSample } from './types';

export class PostureController {
  private currentWeightShift = 0.4; // -1 (left hip) to +1 (right hip)
  private targetWeightShift = 0.4;
  private weightShiftTimer = 0;
  private nextWeightShiftDuration = 18.0;

  // Smoothed anatomical rotations
  private hipTilt = 0;
  private spineLeanX = 0;
  private spineLeanZ = 0;
  private chestRollZ = 0;
  private chestPitchX = 0;

  constructor() {
    this.scheduleNextWeightShift();
  }

  private scheduleNextWeightShift(): void {
    // Alternate weight between left and right foot with natural variation
    const newSign = this.targetWeightShift >= 0 ? -1 : 1;
    this.targetWeightShift = newSign * (0.35 + Math.random() * 0.45);
    this.nextWeightShiftDuration = 14.0 + Math.random() * 18.0;
    this.weightShiftTimer = 0;
  }

  public update(
    dt: number,
    elapsedTime: number,
    emotion: CompanionEmotion,
    emotionIntensity: number,
    state: CompanionState
  ): PostureSample {
    // 1. Weight Shift Cycle (Contrapposto)
    this.weightShiftTimer += dt;
    if (this.weightShiftTimer >= this.nextWeightShiftDuration) {
      this.scheduleNextWeightShift();
    }

    // Slowly damp weight shift across 3-4 seconds
    this.currentWeightShift = THREE.MathUtils.damp(
      this.currentWeightShift,
      this.targetWeightShift,
      1.2,
      dt
    );

    // 2. Anatomical Contrapposto Math
    // Hip roll tilts based on weight-bearing leg (~0.04 rad max)
    const targetHipTilt = this.currentWeightShift * 0.038;
    this.hipTilt = THREE.MathUtils.damp(this.hipTilt, targetHipTilt, 2.0, dt);

    // Hip yaw turns slightly towards the relaxed foot
    const hipYawY = -this.currentWeightShift * 0.025;

    // 3. Spinal Compensation (S-curve)
    // Spine counter-rotates against hip tilt
    const targetSpineRollZ = -this.hipTilt * 0.85;
    // Chest rolls back slightly to keep head aligned
    const targetChestRollZ = this.hipTilt * 0.45;

    // Emotional Postural Biases
    let targetSpinePitchX = 0;
    let targetChestPitchX = 0;

    switch (emotion) {
      case 'SAD':
      case 'EMPATHETIC':
        // Slumped spine, shoulders forward
        targetSpinePitchX = 0.035 * emotionIntensity;
        targetChestPitchX = 0.025 * emotionIntensity;
        break;
      case 'HAPPY':
      case 'AFFECTIONATE':
        // Open, upright posture
        targetSpinePitchX = -0.015 * emotionIntensity;
        targetChestPitchX = -0.02 * emotionIntensity;
        break;
      case 'ANGRY':
      case 'GENTLY_ANNOYED':
        // Tense, slightly forward and rigid
        targetSpinePitchX = 0.025 * emotionIntensity;
        targetChestPitchX = 0.01 * emotionIntensity;
        break;
      case 'CONFUSED':
      case 'THINKING':
        targetSpinePitchX = 0.01;
        break;
      default:
        targetSpinePitchX = 0;
        targetChestPitchX = 0;
        break;
    }

    if (state === 'LISTENING') {
      // Attentive forward lean towards the user
      targetSpinePitchX += 0.025;
      targetChestPitchX += 0.015;
    }

    this.spineLeanX = THREE.MathUtils.damp(this.spineLeanX, targetSpinePitchX, 2.5, dt);
    this.spineLeanZ = THREE.MathUtils.damp(this.spineLeanZ, targetSpineRollZ, 2.0, dt);
    this.chestRollZ = THREE.MathUtils.damp(this.chestRollZ, targetChestRollZ, 2.0, dt);
    this.chestPitchX = THREE.MathUtils.damp(this.chestPitchX, targetChestPitchX, 2.5, dt);

    // 4. Involuntary Multi-frequency Postural Sway (Living human inverted pendulum)
    const swayX =
      Math.sin(elapsedTime * 0.73) * 0.005 +
      Math.sin(elapsedTime * 0.31 + 1.2) * 0.003;
    const swayZ =
      Math.sin(elapsedTime * 0.52 + 0.4) * 0.004 +
      Math.sin(elapsedTime * 0.19 + 2.1) * 0.002;
    const swayY = Math.sin(elapsedTime * 1.1) * 0.001;

    // 5. Shoulder offsets derived from Contrapposto weight
    // When weight is on right (+), right shoulder drops slightly (-Y), left shoulder is slightly elevated (+Y)
    const shoulderDeltaY = -this.currentWeightShift * 0.008;
    const leftShoulderOffset = new THREE.Vector3(-0.002, -shoulderDeltaY, 0);
    const rightShoulderOffset = new THREE.Vector3(0.002, shoulderDeltaY, 0);

    return {
      weightShift: this.currentWeightShift,
      hipTiltZ: this.hipTilt,
      hipYawY,
      spineCurve: new THREE.Vector3(this.spineLeanX, 0, this.spineLeanZ),
      chestOrientation: new THREE.Vector3(this.chestPitchX, 0, this.chestRollZ),
      leftShoulderOffset,
      rightShoulderOffset,
      bodySway: new THREE.Vector3(swayX, swayY, swayZ),
    };
  }
}
