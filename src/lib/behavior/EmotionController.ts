import * as THREE from 'three';
import { CompanionEmotion } from '../companionPersonality';

export interface EmotionSnapshot {
  currentEmotion: CompanionEmotion;
  targetEmotion: CompanionEmotion;
  intensity: number;
  previousEmotion: CompanionEmotion;
  transitionProgress: number;
}

export class EmotionController {
  private currentEmotion: CompanionEmotion = 'NEUTRAL';
  private targetEmotion: CompanionEmotion = 'NEUTRAL';
  private previousEmotion: CompanionEmotion = 'NEUTRAL';

  private currentIntensity = 0.5;
  private targetIntensity = 0.5;
  private transitionProgress = 1.0;
  private transitionDuration = 1.2;

  // Emotional Memory (decay towards calm equilibrium)
  private timeInCurrentEmotion = 0;

  public setEmotion(emotion: CompanionEmotion, targetIntensity = 0.7): void {
    if (emotion === this.targetEmotion) {
      this.targetIntensity = THREE.MathUtils.clamp(targetIntensity, 0.1, 1.0);
      return;
    }

    this.previousEmotion = this.currentEmotion;
    this.targetEmotion = emotion;
    this.targetIntensity = THREE.MathUtils.clamp(targetIntensity, 0.1, 1.0);
    this.transitionProgress = 0;
    this.timeInCurrentEmotion = 0;

    // Transition duration depends on emotional distance
    // Switching from Happy to Angry takes longer than Neutral to Happy
    const isOpposite =
      (this.previousEmotion === 'HAPPY' && emotion === 'ANGRY') ||
      (this.previousEmotion === 'ANGRY' && emotion === 'HAPPY');
    this.transitionDuration = isOpposite ? 1.8 : 1.1;
  }

  public update(dt: number): EmotionSnapshot {
    this.timeInCurrentEmotion += dt;

    if (this.transitionProgress < 1.0) {
      this.transitionProgress += dt / this.transitionDuration;
      if (this.transitionProgress >= 1.0) {
        this.transitionProgress = 1.0;
        this.currentEmotion = this.targetEmotion;
      }
    }

    // Natural decay of peak emotional intensity towards calm baseline (0.35)
    // Over 25-40 seconds
    if (this.timeInCurrentEmotion > 10.0 && this.targetIntensity > 0.4) {
      this.targetIntensity = THREE.MathUtils.damp(this.targetIntensity, 0.4, 0.1, dt);
    }

    this.currentIntensity = THREE.MathUtils.damp(
      this.currentIntensity,
      this.targetIntensity,
      3.0,
      dt
    );

    return {
      currentEmotion: this.currentEmotion,
      targetEmotion: this.targetEmotion,
      intensity: this.currentIntensity,
      previousEmotion: this.previousEmotion,
      transitionProgress: this.transitionProgress,
    };
  }
}
