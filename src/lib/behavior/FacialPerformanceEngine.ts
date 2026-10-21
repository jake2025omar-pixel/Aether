import * as THREE from 'three';
import { CompanionEmotion, CompanionState } from '../companionPersonality';
import { VisemeFrame } from '../phonemeLipSync';

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
    eyeSquint: number,
    visemeFrame?: VisemeFrame | null
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

    // Keep compound full-face VRM presets (Fcl_ALL_*) zero so they never distort eyelids or collide with visemes
    targetVrm.happy = 0;
    targetVrm.relaxed = 0;
    targetVrm.surprised = 0;
    targetVrm.sad = 0;
    targetVrm.angry = 0;

    switch (emotion) {
      case 'HAPPY':
        targetMorphs.Fcl_BRW_Joy = 0.50 * intensity;
        targetMorphs.Fcl_EYE_Joy_L = 0.35 * intensity;
        targetMorphs.Fcl_EYE_Joy_R = 0.35 * intensity;
        targetMorphs.Fcl_MTH_Joy = 0.45 * intensity;
        break;

      case 'AFFECTIONATE':
        // Warm, romantic expression: soft joyful eyes, gentle smile, slight fang smirk
        targetMorphs.Fcl_BRW_Joy = 0.35 * intensity;
        targetMorphs.Fcl_EYE_Joy_L = 0.28 * intensity;
        targetMorphs.Fcl_EYE_Joy_R = 0.28 * intensity;
        targetMorphs.Fcl_MTH_Fun = 0.45 * intensity;
        targetMorphs.Fcl_MTH_SkinFung_R = 0.25 * intensity; // Subtle cute smirk
        break;

      case 'ROMANTIC':
        // Warm, non-explicit romantic look: soft eyes, gentle smile, calm gaze.
        targetMorphs.Fcl_BRW_Joy = 0.38 * intensity;
        targetMorphs.Fcl_EYE_Joy_L = 0.30 * intensity;
        targetMorphs.Fcl_EYE_Joy_R = 0.30 * intensity;
        targetMorphs.Fcl_MTH_Fun = 0.48 * intensity;
        targetMorphs.Fcl_MTH_SkinFung_R = 0.20 * intensity;
        gazeAversion.set(-0.04, -0.05);
        break;

      case 'SHY':
        // Bashful affection: a small smile and a gentle look away.
        targetMorphs.Fcl_BRW_Joy = 0.28 * intensity;
        targetMorphs.Fcl_EYE_Joy_L = 0.20 * intensity;
        targetMorphs.Fcl_EYE_Joy_R = 0.20 * intensity;
        targetMorphs.Fcl_MTH_SkinFung_R = 0.32 * intensity;
        gazeAversion.set(-0.16 * intensity, -0.14 * intensity);
        break;

      case 'SURPRISED':
        targetMorphs.Fcl_BRW_Surprised = 0.70 * intensity;
        targetMorphs.Fcl_EYE_Spread = 0.65 * intensity; // Eyes widen visibly!
        targetMorphs.Fcl_MTH_Surprised = 0.45 * intensity;
        break;

      case 'SAD':
      case 'EMPATHETIC':
        targetMorphs.Fcl_BRW_Sorrow = 0.55 * intensity;
        targetMorphs.Fcl_EYE_Sorrow = 0.40 * intensity;
        targetMorphs.Fcl_MTH_Sorrow = 0.35 * intensity;
        gazeAversion.set(0, -0.15); // Downcast eyes
        break;

      case 'ANGRY':
        targetMorphs.Fcl_BRW_Angry = 0.65 * intensity;
        targetMorphs.Fcl_EYE_Angry = 0.45 * intensity;
        break;

      case 'GENTLY_ANNOYED':
        // Cute anime pout
        targetMorphs.Fcl_BRW_Angry = 0.25 * intensity;
        targetMorphs.Fcl_MTH_Small = 0.55 * intensity; // Pouted lips
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
        targetMorphs.Fcl_MTH_Fun = 0.12; // Natural resting friendly expression
        break;
    }

    // 2. Active Anime Expression Style Overrides (Level C Acting)
    switch (this.currentStyle) {
      case 'PLAYFUL_WINK': {
        const winkProgress = Math.sin(Math.min((this.styleTimer / 1.6) * Math.PI, Math.PI));
        targetVrm.blinkLeft = 0;
        targetVrm.blinkRight = 0;
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
        break;
      }

      case 'SHY_BLUSH_LOOK_AWAY': {
        const shyProg = Math.sin(Math.min((this.styleTimer / 2.8) * Math.PI, Math.PI));
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
        break;
      }

      case 'LAUGHTER_BURST': {
        const laughProg = Math.sin(Math.min((this.styleTimer / 3.0) * Math.PI, Math.PI));
        const laughFlutter = Math.abs(Math.sin(time * 12.0)) * 0.25;
        targetMorphs.Fcl_EYE_Joy_L = 0.75 * laughProg;
        targetMorphs.Fcl_EYE_Joy_R = 0.75 * laughProg;
        targetMorphs.Fcl_MTH_Joy = 0.80 * laughProg;
        targetMorphs.Fcl_MTH_A = (0.35 + laughFlutter) * laughProg;
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
        break;
      }

      case 'NATURAL':
      default:
        break;
    }

    // 3. Speech viseme exclusive ownership. While speaking, the speech viseme
    // controller is the sole owner of mouth aperture and jaw shapes. Emotion styles
    // (such as sleepy, laugh, pout, and smile) may still expressively drive the
    // eyes/brows/head, but must not overwrite or blend conflicting mouth shapes.
    const speechActive = state === 'SPEAKING' || visemeMouthOpen > 0.02;
    if (speechActive) {
      targetMorphs.Fcl_MTH_SkinFung_R = 0;
      targetMorphs.Fcl_MTH_SkinFung_L = 0;
      targetMorphs.Fcl_MTH_Fun = 0;
      targetMorphs.Fcl_MTH_Joy = 0;
      targetMorphs.Fcl_MTH_Sorrow = 0;
      targetMorphs.Fcl_MTH_Surprised = 0;
      targetMorphs.Fcl_MTH_Small = 0;
      targetMorphs.Fcl_MTH_A = 0;
      targetMorphs.Fcl_MTH_I = 0;
      targetMorphs.Fcl_MTH_U = 0;
      targetMorphs.Fcl_MTH_E = 0;
      targetMorphs.Fcl_MTH_O = 0;
    }

    // Audio-driven mouth Blend Shapes via authoritative VRM 1.0 Expression Presets and direct mesh blendshapes
    const driveOpen = THREE.MathUtils.clamp(visemeMouthOpen, 0, 1);
    if (driveOpen > 0.015) {
      if (visemeFrame && visemeFrame.mouthOpen > 0.01) {
        // Phoneme-shaped articulation amplified clearly to prominent visible range (0.65 - 0.90)
        const boost = Math.min(1.5, Math.max(1.1, 0.75 / Math.max(0.1, visemeFrame.mouthOpen)));
        targetVrm.aa = THREE.MathUtils.clamp(visemeFrame.aa * boost, 0, 1);
        targetVrm.ih = THREE.MathUtils.clamp(visemeFrame.ih * boost, 0, 1);
        targetVrm.oh = THREE.MathUtils.clamp(visemeFrame.oh * boost, 0, 1);
        targetVrm.ee = THREE.MathUtils.clamp(visemeFrame.ee * boost, 0, 1);
        targetVrm.ou = THREE.MathUtils.clamp(visemeFrame.ou * boost, 0, 1);
      } else {
        targetVrm.aa = driveOpen * 0.85;
        targetVrm.oh = driveOpen * 0.35;
        targetVrm.ih = driveOpen * 0.25;
        targetVrm.ee = driveOpen * 0.18;
        targetVrm.ou = driveOpen * 0.14;
      }

      // Sync direct morph targets for VRM meshes that use direct morph keys (e.g. VRoid Fcl_MTH_*)
      targetMorphs.Fcl_MTH_A = targetVrm.aa;
      targetMorphs.Fcl_MTH_I = targetVrm.ih;
      targetMorphs.Fcl_MTH_U = targetVrm.ou;
      targetMorphs.Fcl_MTH_E = targetVrm.ee;
      targetMorphs.Fcl_MTH_O = targetVrm.oh;
    } else {
      targetVrm.aa = 0;
      targetVrm.ih = 0;
      targetVrm.oh = 0;
      targetVrm.ee = 0;
      targetVrm.ou = 0;
      targetMorphs.Fcl_MTH_A = 0;
      targetMorphs.Fcl_MTH_I = 0;
      targetMorphs.Fcl_MTH_U = 0;
      targetMorphs.Fcl_MTH_E = 0;
      targetMorphs.Fcl_MTH_O = 0;
    }

    // 3.5 Anatomical Eye Closure Decoupling:
    // When closing the eyes, smoothly suppress all conflicting eyelid morphs (such as happy eye arches,
    // eye widening, or double-close morphs). This prevents mesh tearing, inverted geometry,
    // and polygon intersecting at the eyelid seams, creating realistic and clean eye closures.
    const blinkWeight = THREE.MathUtils.clamp(targetVrm.blink || 0, 0, 1);
    if (blinkWeight > 0.001) {
      const openRatio = Math.max(0, 1.0 - blinkWeight * 1.5);

      targetMorphs.Fcl_EYE_Joy_L = (targetMorphs.Fcl_EYE_Joy_L || 0) * openRatio;
      targetMorphs.Fcl_EYE_Joy_R = (targetMorphs.Fcl_EYE_Joy_R || 0) * openRatio;
      targetMorphs.Fcl_EYE_Spread = (targetMorphs.Fcl_EYE_Spread || 0) * openRatio;
      targetMorphs.Fcl_EYE_Surprised = (targetMorphs.Fcl_EYE_Surprised || 0) * openRatio;
      targetMorphs.Fcl_EYE_Angry = (targetMorphs.Fcl_EYE_Angry || 0) * openRatio;
      targetMorphs.Fcl_EYE_Sorrow = (targetMorphs.Fcl_EYE_Sorrow || 0) * openRatio;
      targetMorphs.Fcl_EYE_Fun = (targetMorphs.Fcl_EYE_Fun || 0) * openRatio;

      // Because VRM expression 'blink' drives symmetrical eyelid closure via Fcl_EYE_Close across all primitives,
      // eliminate any conflicting direct close morphs to prevent polygon tearing and double-closing
      targetMorphs.Fcl_EYE_Close_L = 0;
      targetMorphs.Fcl_EYE_Close_R = 0;
    }

    // 4. Smooth Damping to Prevent Facial Jitter or Snapping
    const dampRate = 9.0;
    for (const key of Object.keys(this.vrmPresets) as (keyof typeof this.vrmPresets)[]) {
      if (key === 'blink' || key === 'blinkLeft' || key === 'blinkRight') {
        // Blinking is computed with precise anatomical sine/cosine curve in EyeBehaviorController.
        this.vrmPresets[key] = THREE.MathUtils.clamp(targetVrm[key] || 0, 0, 1);
      } else if (key === 'aa' || key === 'ih' || key === 'ou' || key === 'ee' || key === 'oh') {
        // High responsiveness for speech visemes with clear visible syllable articulation
        const speechRate = targetVrm[key] < this.vrmPresets[key] ? 20.0 : 24.0;
        this.vrmPresets[key] = THREE.MathUtils.damp(this.vrmPresets[key], targetVrm[key], speechRate, frameDelta);
        if (targetVrm[key] === 0 && this.vrmPresets[key] < 0.005) {
          this.vrmPresets[key] = 0;
        }
      } else {
        this.vrmPresets[key] = THREE.MathUtils.damp(this.vrmPresets[key], targetVrm[key], dampRate, frameDelta);
        if (targetVrm[key] === 0 && this.vrmPresets[key] < 0.005) {
          this.vrmPresets[key] = 0;
        }
      }
    }

    for (const key of Object.keys(this.directMorphs)) {
      const tgt = targetMorphs[key] || 0;
      // When closing eyes, eye morphs must instantly match openRatio so they never lag and tear against blink
      if (key.startsWith('Fcl_EYE_') && blinkWeight > 0.01) {
        this.directMorphs[key] = tgt;
      } else {
        const rate = (key.startsWith('Fcl_EYE_') && blinkWeight > 0.05) ? 35.0 : dampRate;
        this.directMorphs[key] = THREE.MathUtils.damp(this.directMorphs[key], tgt, rate, frameDelta);
        if (tgt === 0 && this.directMorphs[key] < 0.005) {
          this.directMorphs[key] = 0;
        }
      }
    }

    return {
      vrmPresets: { ...this.vrmPresets },
      directMorphs: { ...this.directMorphs },
      activeStyle: this.currentStyle,
      gazeAversion,
      pupilDilation: 1.0 + (emotion === 'AFFECTIONATE' || emotion === 'ROMANTIC' || emotion === 'SHY' || emotion === 'HAPPY' ? 0.12 : 0),
    };
  }
}
