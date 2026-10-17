import * as THREE from 'three';
import { CompanionEmotion, CompanionState } from '../companionPersonality';

export type AnimeExpressionStyle =
  | 'NATURAL'
  | 'PLAYFUL_WINK'
  | 'MISCHIEVOUS_SMIRK'
  | 'SHY_BLUSH_LOOK_AWAY'
  | 'SURPRISE_EYE_WIDEN'
  | 'LAUGHTER_BURST'
  | 'AFFECTIONATE_TENDER'
  | 'THOUGHTFUL_PURSE'
  | 'POUT_ANNORD'
  | 'SLEEPY_DROOP';

export interface FacialPerformanceSample {
  vrmPresets: {
    happy: number;
    angry: number;
    sad: number;
    relaxed: number;
    surprised: number;
    blink: number;
    blinkLeft: number;
    blinkRight: number;
    aa: number;
    ih: number;
    ou: number;
    ee: number;
    oh: number;
  };
  directMorphs: Record<string, number>;
  activeStyle: AnimeExpressionStyle;
  gazeAversion: THREE.Vector2;
  pupilDilation: number;
}

export class FacialPerformanceEngine {
  private currentStyle: AnimeExpressionStyle = 'NATURAL';
  private styleTimer = 0;
  private styleDuration = 0;

  // Smoothed output weights
  private vrmPresets = {
    happy: 0,
    angry: 0,
    sad: 0,
    relaxed: 0,
    surprised: 0,
    blink: 0,
    blinkLeft: 0,
    blinkRight: 0,
    aa: 0,
    ih: 0,
    ou: 0,
    ee: 0,
    oh: 0,
  };

  private directMorphs: Record<string, number> = {
    Fcl_BRW_Joy: 0,
    Fcl_BRW_Sorrow: 0,
    Fcl_BRW_Surprised: 0,
    Fcl_BRW_Angry: 0,
    Fcl_BRW_Fun: 0,
    Fcl_EYE_Close_L: 0,
    Fcl_EYE_Close_R: 0,
    Fcl_EYE_Spread: 0,
    Fcl_EYE_Joy_L: 0,
    Fcl_EYE_Joy_R: 0,
    Fcl_EYE_Sorrow: 0,
    Fcl_EYE_Angry: 0,
    Fcl_MTH_SkinFung_R: 0,
    Fcl_MTH_SkinFung_L: 0,
    Fcl_MTH_Fun: 0,
    Fcl_MTH_Joy: 0,
    Fcl_MTH_Sorrow: 0,
    Fcl_MTH_Surprised: 0,
    Fcl_MTH_Small: 0,
    Fcl_MTH_A: 0,
    Fcl_MTH_I: 0,
    Fcl_MTH_U: 0,
    Fcl_MTH_E: 0,
    Fcl_MTH_O: 0,
  };

  // Vowel cycling cadence for multi-phoneme speech
  private speechVowelPhase = 0;

  public triggerExpressionStyle(style: AnimeExpressionStyle, duration = 3.5): void {
    this.currentStyle = style;
    this.styleDuration = duration;
    this.styleTimer = 0;
  }

  public update(
    dt: number,
    time: number,
    emotion: CompanionEmotion,
    emotionIntensity: number,
    state: CompanionState,
    visemeMouthOpen: number,
    eyeBlink: number,
    eyeSquint: number
  ): FacialPerformanceSample {
    const frameDelta = Math.min(Math.max(dt, 0), 0.05);

    // Track active style duration
    if (this.styleDuration > 0) {
      this.styleTimer += frameDelta;
      if (this.styleTimer >= this.styleDuration) {
        this.currentStyle = 'NATURAL';
        this.styleDuration = 0;
      }
    }

    // Target accumulators
    const targetVrm = {
      happy: 0,
      angry: 0,
      sad: 0,
      relaxed: 0,
      surprised: 0,
      blink: eyeBlink,
      blinkLeft: 0,
      blinkRight: 0,
      aa: 0,
      ih: 0,
      ou: 0,
      ee: 0,
      oh: 0,
    };

    const targetMorphs: Record<string, number> = {
      Fcl_BRW_Joy: 0,
      Fcl_BRW_Sorrow: 0,
      Fcl_BRW_Surprised: 0,
      Fcl_BRW_Angry: 0,
      Fcl_BRW_Fun: 0,
      Fcl_EYE_Close_L: 0,
      Fcl_EYE_Close_R: 0,
      Fcl_EYE_Spread: 0,
      Fcl_EYE_Joy_L: 0,
      Fcl_EYE_Joy_R: 0,
      Fcl_EYE_Sorrow: 0,
      Fcl_EYE_Angry: 0,
      Fcl_MTH_SkinFung_R: 0,
      Fcl_MTH_SkinFung_L: 0,
      Fcl_MTH_Fun: 0,
      Fcl_MTH_Joy: 0,
      Fcl_MTH_Sorrow: 0,
      Fcl_MTH_Surprised: 0,
      Fcl_MTH_Small: 0,
      Fcl_MTH_A: 0,
      Fcl_MTH_I: 0,
      Fcl_MTH_U: 0,
      Fcl_MTH_E: 0,
      Fcl_MTH_O: 0,
    };

    let gazeAversion = new THREE.Vector2(0, 0);

    // 1. Emotion Baseline Mapping
    const intensity = THREE.MathUtils.clamp(emotionIntensity, 0.2, 1.0);

    switch (emotion) {
      case 'HAPPY':
        targetVrm.happy = 0.55 * intensity;
        targetMorphs.Fcl_BRW_Joy = 0.45 * intensity;
        targetMorphs.Fcl_EYE_Joy_L = 0.35 * intensity;
        targetMorphs.Fcl_EYE_Joy_R = 0.35 * intensity;
        targetMorphs.Fcl_MTH_Joy = 0.40 * intensity;
        break;

      case 'AFFECTIONATE':
        // Warm, romantic expression: soft joyful eyes, gentle smile, slight fang smirk
        targetVrm.relaxed = 0.35 * intensity;
        targetMorphs.Fcl_BRW_Joy = 0.30 * intensity;
        targetMorphs.Fcl_EYE_Joy_L = 0.25 * intensity;
        targetMorphs.Fcl_EYE_Joy_R = 0.25 * intensity;
        targetMorphs.Fcl_MTH_Fun = 0.45 * intensity;
        targetMorphs.Fcl_MTH_SkinFung_R = 0.25 * intensity; // Subtle cute smirk
        break;

      case 'SURPRISED':
        targetVrm.surprised = 0.65 * intensity;
        targetMorphs.Fcl_BRW_Surprised = 0.70 * intensity;
        targetMorphs.Fcl_EYE_Spread = 0.60 * intensity; // Eyes widen visibly!
        targetMorphs.Fcl_MTH_Surprised = 0.45 * intensity;
        break;

      case 'SAD':
      case 'EMPATHETIC':
        targetVrm.sad = 0.50 * intensity;
        targetMorphs.Fcl_BRW_Sorrow = 0.55 * intensity;
        targetMorphs.Fcl_EYE_Sorrow = 0.40 * intensity;
        targetMorphs.Fcl_MTH_Sorrow = 0.35 * intensity;
        gazeAversion.set(0, -0.15); // Downcast eyes
        break;

      case 'ANGRY':
        targetVrm.angry = 0.60 * intensity;
        targetMorphs.Fcl_BRW_Angry = 0.65 * intensity;
        targetMorphs.Fcl_EYE_Angry = 0.45 * intensity;
        break;

      case 'GENTLY_ANNOYED':
        // Cute anime pout
        targetMorphs.Fcl_BRW_Angry = 0.25 * intensity;
        targetMorphs.Fcl_MTH_Small = 0.55 * intensity; // Pouted lips
        targetMorphs.Fcl_EYE_Close_L = 0.15;
        targetMorphs.Fcl_EYE_Close_R = 0.15;
        break;

      case 'CONFUSED':
      case 'THINKING':
        // Asymmetric eyebrow lift & inquisitive mouth purse
        targetMorphs.Fcl_BRW_Surprised = 0.35 * intensity;
        targetMorphs.Fcl_BRW_Joy = 0.15 * intensity;
        targetMorphs.Fcl_MTH_Small = 0.30 * intensity;
        gazeAversion.set(0.18, 0.20); // Looking up-right while thinking
        break;

      case 'CURIOUS':
        targetMorphs.Fcl_BRW_Fun = 0.40 * intensity;
        targetMorphs.Fcl_EYE_Spread = 0.25 * intensity;
        targetMorphs.Fcl_MTH_SkinFung_R = 0.28 * intensity;
        break;

      case 'NEUTRAL':
      default:
        targetVrm.relaxed = 0.15;
        targetMorphs.Fcl_MTH_Fun = 0.12; // Natural resting friendly expression
        break;
    }

    // 2. Active Anime Expression Style Overrides (Level C Acting)
    switch (this.currentStyle) {
      case 'PLAYFUL_WINK': {
        const winkProgress = Math.sin(Math.min((this.styleTimer / 1.6) * Math.PI, Math.PI));
        // Single-eye winking removed per explicit user requirement; keep lively joyful expression with fang smirk
        targetVrm.blinkLeft = 0;
        targetVrm.blinkRight = 0;
        targetVrm.happy = 0.40 * winkProgress;
        targetMorphs.Fcl_BRW_Fun = 0.55 * winkProgress;
        targetMorphs.Fcl_MTH_SkinFung_R = 0.65 * winkProgress; // Cheek fang smirk
        targetMorphs.Fcl_MTH_Fun = 0.45 * winkProgress;
        break;
      }

      case 'MISCHIEVOUS_SMIRK': {
        const smirkProg = Math.sin(Math.min((this.styleTimer / 2.2) * Math.PI, Math.PI));
        targetMorphs.Fcl_MTH_SkinFung_R = 0.75 * smirkProg;
        targetMorphs.Fcl_BRW_Fun = 0.45 * smirkProg;
        targetMorphs.Fcl_EYE_Joy_R = 0.35 * smirkProg;
        targetVrm.relaxed = 0.30 * smirkProg;
        break;
      }

      case 'SHY_BLUSH_LOOK_AWAY': {
        const shyProg = Math.sin(Math.min((this.styleTimer / 2.8) * Math.PI, Math.PI));
        targetMorphs.Fcl_EYE_Close_L = 0.35 * shyProg;
        targetMorphs.Fcl_EYE_Close_R = 0.35 * shyProg;
        targetMorphs.Fcl_BRW_Joy = 0.35 * shyProg;
        targetMorphs.Fcl_MTH_SkinFung_R = 0.45 * shyProg;
        gazeAversion.set(-0.25 * shyProg, -0.22 * shyProg); // Look shyly down and away
        break;
      }

      case 'SURPRISE_EYE_WIDEN': {
        const shockProg = Math.sin(Math.min((this.styleTimer / 2.0) * Math.PI, Math.PI));
        targetMorphs.Fcl_EYE_Spread = 0.85 * shockProg;
        targetMorphs.Fcl_BRW_Surprised = 0.80 * shockProg;
        targetMorphs.Fcl_MTH_Surprised = 0.60 * shockProg;
        targetVrm.surprised = 0.75 * shockProg;
        break;
      }

      case 'LAUGHTER_BURST': {
        const laughProg = Math.sin(Math.min((this.styleTimer / 3.0) * Math.PI, Math.PI));
        const laughFlutter = Math.abs(Math.sin(time * 12.0)) * 0.25;
        targetMorphs.Fcl_EYE_Joy_L = 0.85 * laughProg;
        targetMorphs.Fcl_EYE_Joy_R = 0.85 * laughProg;
        targetMorphs.Fcl_MTH_Joy = 0.80 * laughProg;
        targetMorphs.Fcl_MTH_A = (0.35 + laughFlutter) * laughProg;
        targetVrm.happy = 0.85 * laughProg;
        break;
      }

      case 'AFFECTIONATE_TENDER': {
        const tenderProg = Math.sin(Math.min((this.styleTimer / 3.5) * Math.PI, Math.PI));
        targetMorphs.Fcl_BRW_Joy = 0.40 * tenderProg;
        targetMorphs.Fcl_EYE_Joy_L = 0.30 * tenderProg;
        targetMorphs.Fcl_EYE_Joy_R = 0.30 * tenderProg;
        targetMorphs.Fcl_MTH_Fun = 0.60 * tenderProg;
        targetMorphs.Fcl_MTH_SkinFung_R = 0.35 * tenderProg;
        break;
      }

      case 'POUT_ANNORD': {
        const poutProg = Math.sin(Math.min((this.styleTimer / 2.5) * Math.PI, Math.PI));
        targetMorphs.Fcl_MTH_Small = 0.75 * poutProg;
        targetMorphs.Fcl_BRW_Angry = 0.35 * poutProg;
        break;
      }

      case 'SLEEPY_DROOP': {
        targetMorphs.Fcl_EYE_Close_L = 0.55;
        targetMorphs.Fcl_EYE_Close_R = 0.55;
        targetVrm.relaxed = 0.60;
        break;
      }

      case 'NATURAL':
      default:
        break;
    }

    // 3. Multi-Vowel Anime Speech Visemes (A, I, U, E, O)
    // Drive only mouth expression channels; never translate the jaw, head, or
    // face mesh. This keeps the lips anchored while making speech readable.
    if (visemeMouthOpen > 0.02) {
      this.speechVowelPhase = (this.speechVowelPhase + frameDelta * 7.5) % (Math.PI * 2);
      const mouthDrive = THREE.MathUtils.clamp(visemeMouthOpen * 1.25, 0, 1);
      const vA = Math.max(0, Math.sin(this.speechVowelPhase)) * mouthDrive;
      const vI = Math.max(0, Math.sin(this.speechVowelPhase + 1.25)) * mouthDrive * 0.66;
      const vO = Math.max(0, Math.sin(this.speechVowelPhase + 2.5)) * mouthDrive * 0.78;
      const vE = Math.max(0, Math.sin(this.speechVowelPhase + 3.75)) * mouthDrive * 0.58;
      const vU = Math.max(0, Math.sin(this.speechVowelPhase + 5.0)) * mouthDrive * 0.48;

      // VRM Preset Visemes
      targetVrm.aa = vA * 0.52;
      targetVrm.ih = vI * 0.42;
      targetVrm.oh = vO * 0.48;
      targetVrm.ee = vE * 0.38;
      targetVrm.ou = vU * 0.32;

      // Direct Morph Targets on Face mesh
      targetMorphs.Fcl_MTH_A = vA * 0.86;
      targetMorphs.Fcl_MTH_I = vI * 0.68;
      targetMorphs.Fcl_MTH_O = vO * 0.74;
      targetMorphs.Fcl_MTH_E = vE * 0.62;
      targetMorphs.Fcl_MTH_U = vU * 0.52;
    } else {
      this.speechVowelPhase = 0;
    }

    // 3.5 Realistic Eye Closure Decoupling:
    // When closing the eyes, smoothly suppress conflicting eyelid morphs (such as happy eye arches,
    // eye widening, or double-close morphs). This prevents mesh tearing, inverted geometry,
    // and polygon intersecting at the eyelid seams, creating realistic and clean eye closures.
    const blinkWeight = THREE.MathUtils.clamp(targetVrm.blink || 0, 0, 1);
    if (blinkWeight > 0.01) {
      const openRatio = Math.max(0, 1.0 - blinkWeight * 1.15);
      targetVrm.happy *= openRatio;
      targetVrm.surprised *= openRatio;
      targetVrm.relaxed *= openRatio;

      targetMorphs.Fcl_EYE_Joy_L = (targetMorphs.Fcl_EYE_Joy_L || 0) * openRatio;
      targetMorphs.Fcl_EYE_Joy_R = (targetMorphs.Fcl_EYE_Joy_R || 0) * openRatio;
      targetMorphs.Fcl_EYE_Spread = (targetMorphs.Fcl_EYE_Spread || 0) * openRatio;
      targetMorphs.Fcl_EYE_Surprised = (targetMorphs.Fcl_EYE_Surprised || 0) * openRatio;
      targetMorphs.Fcl_EYE_Angry = (targetMorphs.Fcl_EYE_Angry || 0) * openRatio;
      targetMorphs.Fcl_EYE_Sorrow = (targetMorphs.Fcl_EYE_Sorrow || 0) * openRatio;

      // Because VRM expression 'blink' already drives eyelid closure via Fcl_EYE_Close,
      // prevent Fcl_EYE_Close_L/R in directMorphs from double-stacking and pushing eyelids past cheeks
      targetMorphs.Fcl_EYE_Close_L = Math.max(0, (targetMorphs.Fcl_EYE_Close_L || 0) - blinkWeight);
      targetMorphs.Fcl_EYE_Close_R = Math.max(0, (targetMorphs.Fcl_EYE_Close_R || 0) - blinkWeight);
    }

    // 4. Smooth Damping to Prevent Facial Jitter or Snapping
    const dampRate = 9.0;
    for (const key of Object.keys(this.vrmPresets) as (keyof typeof this.vrmPresets)[]) {
      if (key === 'blink' || key === 'blinkLeft' || key === 'blinkRight') {
        // Blinking is computed with precise anatomical sine/cosine curve in EyeBehaviorController.
        // Applying slow damping (dampRate = 9) drags and glitches eyelid closure.
        this.vrmPresets[key] = THREE.MathUtils.clamp(targetVrm[key] || 0, 0, 1);
      } else {
        this.vrmPresets[key] = THREE.MathUtils.damp(this.vrmPresets[key], targetVrm[key], dampRate, frameDelta);
        if (targetVrm[key] === 0 && this.vrmPresets[key] < 0.005) {
          this.vrmPresets[key] = 0;
        }
      }
    }

    for (const key of Object.keys(this.directMorphs)) {
      const tgt = targetMorphs[key] || 0;
      // When closing eyes, damp eye morphs quickly so conflicting shapes don't lag or tear
      const rate = (key.startsWith('Fcl_EYE_') && blinkWeight > 0.05) ? 28.0 : dampRate;
      this.directMorphs[key] = THREE.MathUtils.damp(this.directMorphs[key], tgt, rate, frameDelta);
      if (tgt === 0 && this.directMorphs[key] < 0.005) {
        this.directMorphs[key] = 0;
      }
    }

    return {
      vrmPresets: { ...this.vrmPresets },
      directMorphs: { ...this.directMorphs },
      activeStyle: this.currentStyle,
      gazeAversion,
      pupilDilation: 1.0 + (emotion === 'AFFECTIONATE' || emotion === 'HAPPY' ? 0.12 : 0),
    };
  }
}
