import { CompanionEmotion, CompanionState } from '../companionPersonality';
import { MicroMovementSample } from './types';

/**
 * Small involuntary-looking offsets are intentionally disabled by default.
 * Finger and facial micro-actions must come from an explicit emotion, speech
 * gesture, or choreographed action so the avatar never fidgets without cause.
 */
export class MicroMovementController {
  public update(
    _dt: number,
    _emotion: CompanionEmotion,
    _state: CompanionState
  ): MicroMovementSample {
    return {
      leftHandFingers: 0,
      rightHandFingers: 0,
      shoulderTwitch: 0,
      browTwitch: 0,
      mouthMicroTwitch: 0,
    };
  }
}
