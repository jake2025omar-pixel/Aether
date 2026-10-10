import { CompanionEmotion, CompanionState } from '../companionPersonality';
import { MicroMovementSample } from './types';

export class MicroMovementController {
  private timer = 0;
  private nextActionCooldown = 8.0;

  // Active micro action state
  private activeAction: 'NONE' | 'SHOULDER_ADJUST' | 'FINGER_TWITCH' | 'BROW_TWITCH' | 'MOUTH_RELAX' = 'NONE';
  private actionProgress = 0;
  private actionDuration = 1.0;

  private shoulderValue = 0;
  private leftFingerValue = 0;
  private rightFingerValue = 0;
  private browValue = 0;
  private mouthValue = 0;

  constructor() {
    this.nextActionCooldown = 6.0 + Math.random() * 8.0;
  }

  public update(
    dt: number,
    emotion: CompanionEmotion,
    state: CompanionState
  ): MicroMovementSample {
    this.timer += dt;

    if (this.activeAction === 'NONE') {
      if (this.timer >= this.nextActionCooldown && state !== 'SPEAKING') {
        this.timer = 0;
        this.nextActionCooldown = 7.0 + Math.random() * 12.0;

        // Choose random micro action based on state
        const rand = Math.random();
        if (rand < 0.35) {
          this.activeAction = 'FINGER_TWITCH';
          this.actionDuration = 0.8 + Math.random() * 0.4;
        } else if (rand < 0.65) {
          this.activeAction = 'SHOULDER_ADJUST';
          this.actionDuration = 1.2 + Math.random() * 0.5;
        } else if (rand < 0.85) {
          this.activeAction = 'BROW_TWITCH';
          this.actionDuration = 0.5 + Math.random() * 0.3;
        } else {
          this.activeAction = 'MOUTH_RELAX';
          this.actionDuration = 0.9;
        }
        this.actionProgress = 0;
      }
    } else {
      this.actionProgress += dt;
      const t = this.actionProgress / this.actionDuration;

      if (t >= 1.0) {
        this.activeAction = 'NONE';
        this.shoulderValue = 0;
        this.leftFingerValue = 0;
        this.rightFingerValue = 0;
        this.browValue = 0;
        this.mouthValue = 0;
      } else {
        // Bell-curve envelope
        const envelope = Math.sin(t * Math.PI);

        switch (this.activeAction) {
          case 'SHOULDER_ADJUST':
            this.shoulderValue = envelope * 0.012;
            break;
          case 'FINGER_TWITCH':
            this.rightFingerValue = envelope * 0.04;
            this.leftFingerValue = envelope * 0.02;
            break;
          case 'BROW_TWITCH':
            this.browValue = envelope * 0.03;
            break;
          case 'MOUTH_RELAX':
            this.mouthValue = envelope * 0.02;
            break;
        }
      }
    }

    return {
      leftHandFingers: this.leftFingerValue,
      rightHandFingers: this.rightFingerValue,
      shoulderTwitch: this.shoulderValue,
      browTwitch: this.browValue,
      mouthMicroTwitch: this.mouthValue,
    };
  }
}
