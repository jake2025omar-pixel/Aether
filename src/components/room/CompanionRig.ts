import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import { CompanionEmotion, CompanionState } from '../../lib/companionPersonality';
import { dispose3DResource } from '@/Aether/3D/Preview/AssetPreviewLoader';
import { AnimationEvent, AnimationOrchestrator, SemanticAnimationFrame } from '../../lib/animationOrchestrator';
import { HumanBehaviorController } from '../../lib/behavior/HumanBehaviorController';

export class CompanionRig {
  public root: THREE.Group;
  private vrmInstance: VRM | null = null;
  private isVrm: boolean = false;

  // VRM Humanoid Bones
  private vrmHeadBone: THREE.Object3D | null = null;
  private vrmNeckBone: THREE.Object3D | null = null;
  private vrmChestBone: THREE.Object3D | null = null;
  private vrmUpperChestBone: THREE.Object3D | null = null;
  private vrmSpineBone: THREE.Object3D | null = null;
  private vrmHipsBone: THREE.Object3D | null = null;
  private vrmLeftShoulderBone: THREE.Object3D | null = null;
  private vrmRightShoulderBone: THREE.Object3D | null = null;
  private vrmLeftUpperArm: THREE.Object3D | null = null;
  private vrmRightUpperArm: THREE.Object3D | null = null;
  private vrmLeftLowerArm: THREE.Object3D | null = null;
  private vrmRightLowerArm: THREE.Object3D | null = null;
  private vrmLeftHand: THREE.Object3D | null = null;
  private vrmRightHand: THREE.Object3D | null = null;

  // Stored Rest Rotations
  private readonly vrmHeadRest = new THREE.Euler();
  private readonly vrmNeckRest = new THREE.Euler();
  private readonly vrmChestRest = new THREE.Euler();
  private readonly vrmUpperChestRest = new THREE.Euler();
  private readonly vrmSpineRest = new THREE.Euler();
  private readonly vrmHipsRest = new THREE.Euler();
  private readonly vrmLeftShoulderRest = new THREE.Euler();
  private readonly vrmRightShoulderRest = new THREE.Euler();
  private readonly leftArmRest = new THREE.Euler();
  private readonly rightArmRest = new THREE.Euler();
  private readonly leftLowerArmRest = new THREE.Euler();
  private readonly rightLowerArmRest = new THREE.Euler();
  private readonly leftHandRest = new THREE.Euler();
  private readonly rightHandRest = new THREE.Euler();

  // Procedural rig references
  private headBone: THREE.Group | null = null;
  private chestBone: THREE.Group | null = null;
  private leftEye: THREE.Mesh | null = null;
  private rightEye: THREE.Mesh | null = null;
  private leftEyebrow: THREE.Mesh | null = null;
  private rightEyebrow: THREE.Mesh | null = null;
  private mouthMesh: THREE.Mesh | null = null;
  private crystalCore: THREE.Mesh | null = null;
  private proceduralLeftArm: THREE.Mesh | null = null;
  private proceduralRightArm: THREE.Mesh | null = null;
  private targetLeftBrowRotation = 0;
  private targetRightBrowRotation = 0;
  private targetLeftBrowHeight = 0.05;
  private targetRightBrowHeight = 0.05;

  // Animation & Behavior Controllers
  private readonly humanBehavior = new HumanBehaviorController();
  private readonly animationOrchestrator = new AnimationOrchestrator();
  private animationFrame: SemanticAnimationFrame = this.animationOrchestrator.update(0, 0);

  // States
  private currentEmotion: CompanionEmotion = 'NEUTRAL';
  private currentState: CompanionState = 'IDLE';
  private motionEnabled = true;
  private targetViseme: number = 0; // 0 (closed) to 1 (open)
  private displayedViseme: number = 0; // Smoothly damped mouth aperture
  private activeEmotionVrmPreset: string = 'relaxed';
  private readonly emotionWeights: Record<string, number> = {
    happy: 0,
    angry: 0,
    sad: 0,
    relaxed: 0,
    surprised: 0,
  };

  constructor(vrm?: VRM | null) {
    this.root = new THREE.Group();

    if (vrm) {
      this.vrmInstance = vrm;
      this.isVrm = true;
      this.root.add(vrm.scene);

      // Acquire complete normalized upper body skeleton
      this.vrmHeadBone = vrm.humanoid?.getNormalizedBoneNode('head') || null;
      this.vrmNeckBone = vrm.humanoid?.getNormalizedBoneNode('neck') || null;
      this.vrmChestBone = vrm.humanoid?.getNormalizedBoneNode('chest') || null;
      this.vrmUpperChestBone = vrm.humanoid?.getNormalizedBoneNode('upperChest') || null;
      this.vrmSpineBone = vrm.humanoid?.getNormalizedBoneNode('spine') || null;
      this.vrmHipsBone = vrm.humanoid?.getNormalizedBoneNode('hips') || null;
      this.vrmLeftShoulderBone = vrm.humanoid?.getNormalizedBoneNode('leftShoulder') || null;
      this.vrmRightShoulderBone = vrm.humanoid?.getNormalizedBoneNode('rightShoulder') || null;
      this.vrmLeftUpperArm = vrm.humanoid?.getNormalizedBoneNode('leftUpperArm') || null;
      this.vrmRightUpperArm = vrm.humanoid?.getNormalizedBoneNode('rightUpperArm') || null;
      this.vrmLeftLowerArm = vrm.humanoid?.getNormalizedBoneNode('leftLowerArm') || null;
      this.vrmRightLowerArm = vrm.humanoid?.getNormalizedBoneNode('rightLowerArm') || null;
      this.vrmLeftHand = vrm.humanoid?.getNormalizedBoneNode('leftHand') || null;
      this.vrmRightHand = vrm.humanoid?.getNormalizedBoneNode('rightHand') || null;

      if (this.vrmHeadBone) this.vrmHeadRest.copy(this.vrmHeadBone.rotation);
      if (this.vrmNeckBone) this.vrmNeckRest.copy(this.vrmNeckBone.rotation);
      if (this.vrmChestBone) this.vrmChestRest.copy(this.vrmChestBone.rotation);
      if (this.vrmUpperChestBone) this.vrmUpperChestRest.copy(this.vrmUpperChestBone.rotation);
      if (this.vrmSpineBone) this.vrmSpineRest.copy(this.vrmSpineBone.rotation);
      if (this.vrmHipsBone) this.vrmHipsRest.copy(this.vrmHipsBone.rotation);
      if (this.vrmLeftShoulderBone) this.vrmLeftShoulderRest.copy(this.vrmLeftShoulderBone.rotation);
      if (this.vrmRightShoulderBone) this.vrmRightShoulderRest.copy(this.vrmRightShoulderBone.rotation);

      this.applyNaturalVrmRestPose(vrm);
    } else {
      this.buildProceduralHumanoidRig();
    }
  }

  /**
   * Poses VRM humanoid arms and shoulders into a relaxed, natural standing posture.
   */
  private applyNaturalVrmRestPose(vrm: VRM): void {
    if (!vrm.humanoid) return;
    const leftUpperArm = this.vrmLeftUpperArm;
    const rightUpperArm = this.vrmRightUpperArm;
    const leftLowerArm = this.vrmLeftLowerArm;
    const rightLowerArm = this.vrmRightLowerArm;
    const leftHand = this.vrmLeftHand;
    const rightHand = this.vrmRightHand;

    // Natural companion idle stance: arms relaxed along body sides
    if (leftUpperArm) {
      leftUpperArm.rotation.set(0.12, 0.05, -1.25);
      this.leftArmRest.copy(leftUpperArm.rotation);
    }
    if (rightUpperArm) {
      rightUpperArm.rotation.set(0.12, -0.05, 1.25);
      this.rightArmRest.copy(rightUpperArm.rotation);
    }
    if (leftLowerArm) {
      leftLowerArm.rotation.set(0, -0.15, -0.12);
      this.leftLowerArmRest.copy(leftLowerArm.rotation);
    }
    if (rightLowerArm) {
      rightLowerArm.rotation.set(0, 0.15, 0.12);
      this.rightLowerArmRest.copy(rightLowerArm.rotation);
    }
    if (leftHand) {
      leftHand.rotation.set(0.05, 0, 0.05);
      this.leftHandRest.copy(leftHand.rotation);
    }
    if (rightHand) {
      rightHand.rotation.set(0.05, 0, -0.05);
      this.rightHandRest.copy(rightHand.rotation);
    }
  }

  /**
   * Builds an articulate stylized 3D humanoid companion (Height: 1.62m)
   * with responsive eyes, eyebrows, mouth visemes, and crystalline outfit.
   */
  private buildProceduralHumanoidRig(): void {
    // 1. Materials with Aether dark crystal aesthetic
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xfce7f3, // Soft porcelain complexion
      roughness: 0.45,
      metalness: 0.1,
    });

    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x1e1035, // Deep obsidian violet
      roughness: 0.35,
      metalness: 0.4,
    });

    const outfitMat = new THREE.MeshStandardMaterial({
      color: 0x2e1065, // Royal amethyst
      roughness: 0.25,
      metalness: 0.75,
    });

    const crystalMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8, // Cyan crystal core
    });

    const eyeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8, // Luminous cyan irises
    });

    const eyeWhiteMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });

    const eyebrowMat = new THREE.MeshBasicMaterial({
      color: 0x581c87,
    });

    const mouthMat = new THREE.MeshBasicMaterial({
      color: 0xe879f9, // Fuchsia lip tone
    });

    // 2. Base Skeleton Hierarchy
    const hips = new THREE.Group();
    hips.position.y = 0.9;
    this.root.add(hips);

    const spine = new THREE.Group();
    spine.position.y = 0.15;
    hips.add(spine);

    const chest = new THREE.Group();
    chest.position.y = 0.22;
    spine.add(chest);
    this.chestBone = chest;

    const neck = new THREE.Group();
    neck.position.y = 0.25;
    chest.add(neck);

    const head = new THREE.Group();
    head.position.y = 0.14;
    neck.add(head);
    this.headBone = head;

    // 3. Head & Face Meshes
    const headGeo = new THREE.SphereGeometry(0.125, 32, 32);
    headGeo.scale(0.95, 1.15, 1.0);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    head.add(headMesh);

    // Hair Top & Back
    const hairTopGeo = new THREE.SphereGeometry(0.138, 24, 24);
    hairTopGeo.scale(1.02, 1.15, 1.05);
    const hairTop = new THREE.Mesh(hairTopGeo, hairMat);
    hairTop.position.set(0, 0.03, -0.015);
    head.add(hairTop);

    // Hair Twin Tails / Side Bangs (Stylized anime companion aesthetic)
    const bangLeftGeo = new THREE.ConeGeometry(0.04, 0.42, 12);
    bangLeftGeo.rotateZ(0.2);
    const bangLeft = new THREE.Mesh(bangLeftGeo, hairMat);
    bangLeft.position.set(-0.14, -0.15, 0.02);
    head.add(bangLeft);

    const bangRightGeo = new THREE.ConeGeometry(0.04, 0.42, 12);
    bangRightGeo.rotateZ(-0.2);
    const bangRight = new THREE.Mesh(bangRightGeo, hairMat);
    bangRight.position.set(0.14, -0.15, 0.02);
    head.add(bangRight);

    // Eyes (Left & Right)
    const eyeWhiteGeo = new THREE.SphereGeometry(0.022, 16, 16);
    const eyeIrisGeo = new THREE.CircleGeometry(0.014, 16);

    // Left Eye Socket
    const leftEyeGroup = new THREE.Group();
    leftEyeGroup.position.set(-0.045, 0.015, 0.118);
    const leftEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    const leftEyeIris = new THREE.Mesh(eyeIrisGeo, eyeMat);
    leftEyeIris.position.z = 0.021;
    leftEyeGroup.add(leftEyeWhite);
    leftEyeGroup.add(leftEyeIris);
    head.add(leftEyeGroup);
    this.leftEye = leftEyeWhite;

    // Right Eye Socket
    const rightEyeGroup = new THREE.Group();
    rightEyeGroup.position.set(0.045, 0.015, 0.118);
    const rightEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    const rightEyeIris = new THREE.Mesh(eyeIrisGeo, eyeMat);
    rightEyeIris.position.z = 0.021;
    rightEyeGroup.add(rightEyeWhite);
    rightEyeGroup.add(rightEyeIris);
    head.add(rightEyeGroup);
    this.rightEye = rightEyeWhite;

    // Eyebrows
    const eyebrowGeo = new THREE.BoxGeometry(0.035, 0.005, 0.005);

    const leftBrow = new THREE.Mesh(eyebrowGeo, eyebrowMat);
    leftBrow.position.set(-0.045, 0.05, 0.125);
    head.add(leftBrow);
    this.leftEyebrow = leftBrow;

    const rightBrow = new THREE.Mesh(eyebrowGeo, eyebrowMat);
    rightBrow.position.set(0.045, 0.05, 0.125);
    head.add(rightBrow);
    this.rightEyebrow = rightBrow;

    // Mouth Viseme Mesh (Can scale vertically for speech lip-sync!)
    const mouthGeo = new THREE.BoxGeometry(0.03, 0.008, 0.005);
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.position.set(0, -0.055, 0.122);
    head.add(mouth);
    this.mouthMesh = mouth;

    // 4. Torso & Outfit
    const torsoGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.45, 20);
    const torso = new THREE.Mesh(torsoGeo, outfitMat);
    torso.position.y = 0.1;
    chest.add(torso);

    // Crystal Heart Core
    const crystalGeo = new THREE.OctahedronGeometry(0.04, 0);
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.set(0, 0.12, 0.135);
    chest.add(crystal);
    this.crystalCore = crystal;

    // Dress / Robe Skirt (Feet-to-waist coverage)
    const skirtGeo = new THREE.ConeGeometry(0.34, 0.9, 24, 1, true);
    const skirt = new THREE.Mesh(skirtGeo, outfitMat);
    skirt.position.y = -0.42;
    hips.add(skirt);

    // Arms & Hands (Left & Right)
    const armGeo = new THREE.CylinderGeometry(0.035, 0.03, 0.35, 12);
    const leftArm = new THREE.Mesh(armGeo, outfitMat);
    leftArm.position.set(-0.19, 0.05, 0);
    leftArm.rotation.z = -0.15;
    chest.add(leftArm);
    this.proceduralLeftArm = leftArm;
    this.leftArmRest.copy(leftArm.rotation);

    const rightArm = new THREE.Mesh(armGeo, outfitMat);
    rightArm.position.set(0.19, 0.05, 0);
    rightArm.rotation.z = 0.15;
    chest.add(rightArm);
    this.proceduralRightArm = rightArm;
    this.rightArmRest.copy(rightArm.rotation);

    // Floor Pedestal Ring (Ground Anchor at Y = 0)
    const pedestalGeo = new THREE.RingGeometry(0.42, 0.45, 32);
    const pedestalMat = new THREE.MeshBasicMaterial({ color: 0xa855f7, side: THREE.DoubleSide });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.rotation.x = -Math.PI / 2;
    pedestal.position.y = 0.005;
    this.root.add(pedestal);
  }

  /**
   * Sets emotional state and adjusts facial expressions
   */
  public setEmotion(emotion: CompanionEmotion): void {
    this.currentEmotion = emotion;
    this.animationOrchestrator.setEmotion(emotion, 0.62);
    this.humanBehavior.setEmotion(emotion, 0.75);

    const vrmMap: Record<CompanionEmotion, string> = {
      NEUTRAL: 'relaxed',
      HAPPY: 'happy',
      SAD: 'sad',
      ANGRY: 'angry',
      SURPRISED: 'surprised',
      CONFUSED: 'surprised',
      THINKING: 'relaxed',
      CURIOUS: 'surprised',
      EMPATHETIC: 'sad',
      AFFECTIONATE: 'happy',
      GENTLY_ANNOYED: 'angry',
    };
    this.activeEmotionVrmPreset = vrmMap[emotion] || 'relaxed';

    // Procedural rig eyebrow emotion modulation
    if (this.leftEyebrow && this.rightEyebrow) {
      switch (emotion) {
        case 'HAPPY':
        case 'AFFECTIONATE':
          this.targetLeftBrowRotation = -0.15;
          this.targetRightBrowRotation = 0.15;
          this.targetLeftBrowHeight = 0.055;
          this.targetRightBrowHeight = 0.055;
          break;
        case 'SAD':
        case 'EMPATHETIC':
          this.targetLeftBrowRotation = 0.2;
          this.targetRightBrowRotation = -0.2;
          this.targetLeftBrowHeight = 0.045;
          this.targetRightBrowHeight = 0.045;
          break;
        case 'SURPRISED':
        case 'CURIOUS':
          this.targetLeftBrowRotation = 0;
          this.targetRightBrowRotation = 0;
          this.targetLeftBrowHeight = 0.065;
          this.targetRightBrowHeight = 0.065;
          break;
        case 'ANGRY':
        case 'GENTLY_ANNOYED':
          this.targetLeftBrowRotation = 0.25;
          this.targetRightBrowRotation = -0.25;
          this.targetLeftBrowHeight = 0.042;
          this.targetRightBrowHeight = 0.042;
          break;
        case 'CONFUSED':
        case 'THINKING':
          this.targetLeftBrowRotation = -0.25;
          this.targetRightBrowRotation = 0.05;
          this.targetLeftBrowHeight = 0.05;
          this.targetRightBrowHeight = 0.05;
          break;
        default:
          this.targetLeftBrowRotation = 0;
          this.targetRightBrowRotation = 0;
          this.targetLeftBrowHeight = 0.05;
          this.targetRightBrowHeight = 0.05;
          break;
      }
    }
  }

  public setState(state: CompanionState): void {
    if (state === this.currentState && this.animationOrchestrator.getSnapshot().state !== 'INITIALIZING') return;
    this.currentState = state;
    this.animationOrchestrator.setConversationState(state);
    this.humanBehavior.setState(state);
  }

  public onSpeechStart(text: string): void {
    this.humanBehavior.onSpeechStart(text);
  }

  public onSpeechEnd(): void {
    this.humanBehavior.onSpeechEnd();
  }

  public setMotionEnabled(enabled: boolean): void {
    this.motionEnabled = enabled;
    this.animationOrchestrator.setMotionEnabled(enabled);
    if (!enabled) {
      if (this.leftEye) this.leftEye.scale.y = 1;
      if (this.rightEye) this.rightEye.scale.y = 1;
      if (this.isVrm && this.vrmInstance?.expressionManager) {
        this.vrmInstance.expressionManager.setValue('blink', 0);
      }
    }
  }

  /**
   * Sets real-time lip-sync mouth opening (0 = closed, 1 = open).
   * Driven through a single, calibrated, smooth channel.
   */
  public setViseme(mouthOpen: number): void {
    this.targetViseme = Math.max(0, Math.min(1, mouthOpen));

    // Fast zero clamp when speech stops to guarantee no lingering open mouth
    if (mouthOpen === 0 && this.displayedViseme < 0.08) {
      this.displayedViseme = 0;
      if (this.isVrm && this.vrmInstance?.expressionManager) {
        this.vrmInstance.expressionManager.setValue('aa', 0);
        this.vrmInstance.expressionManager.setValue('oh', 0);
        this.vrmInstance.expressionManager.setValue('ih', 0);
        this.vrmInstance.expressionManager.setValue('ou', 0);
        this.vrmInstance.expressionManager.setValue('ee', 0);
      }
    }
  }

  /** Forwards validated conversation/network events without exposing rig details. */
  public notifyAnimationEvent(event: AnimationEvent): void {
    this.animationOrchestrator.notify(event);
  }

  /**
   * Updates realistic human behavior, continuous respiration, contrapposto posture,
   * speech gestures, micro-saccades, and expressions every frame.
   */
  public update(delta: number, elapsedTime: number, targetLookPos?: THREE.Vector3): void {
    const frameDelta = Math.min(Math.max(delta, 0), 0.05);
    const motion = this.motionEnabled ? 1 : 0;

    // 1. Advance high-level semantic orchestrator
    this.animationFrame = this.animationOrchestrator.update(frameDelta, elapsedTime);

    // 2. Smooth mouth viseme damping
    this.displayedViseme = THREE.MathUtils.damp(this.displayedViseme, this.targetViseme, 18, frameDelta);
    if (this.targetViseme === 0 && this.displayedViseme < 0.005) this.displayedViseme = 0;

    // 3. Compute continuous Human Behavior Frame
    const cameraTarget = targetLookPos || new THREE.Vector3(0, 1.45, 3.4);
    const behavior = this.humanBehavior.update(
      frameDelta,
      elapsedTime,
      cameraTarget,
      this.root.position,
      this.displayedViseme
    );

    // 4. VRM Character Kinematics & Expressions
    if (this.isVrm && this.vrmInstance) {
      if (this.motionEnabled) {
        this.vrmInstance.update(frameDelta);
      } else {
        this.vrmInstance.expressionManager?.update();
      }

      // Feed synthesized look-at target to VRM look-at plugin if available
      if (this.vrmInstance.lookAt && this.motionEnabled) {
        this.vrmInstance.lookAt.lookAt(behavior.lookAtTarget);
      }

      const manager = this.vrmInstance.expressionManager;
      if (manager) {
        // Safe single-channel lip sync (Dark ICE: aa = Fcl_MTH_A)
        manager.setValue('aa', Math.min(0.18, this.displayedViseme * 0.2));
        manager.setValue('oh', 0);
        manager.setValue('ih', 0);
        manager.setValue('ou', 0);
        manager.setValue('ee', 0);

        // Natural dynamic eye blink driven by EyeBehaviorController
        const blinkVal = motion ? THREE.MathUtils.clamp(behavior.eye.leftBlink, 0, 1) : 0;
        manager.setValue('blink', blinkVal);

        // Emotion expression with speech suppression & eyelid squint blending
        const speechSuppression = Math.max(0.38, 1 - this.displayedViseme * 0.85);
        const emotionBase = (this.currentEmotion === 'NEUTRAL' ? 0.18
          : this.currentEmotion === 'GENTLY_ANNOYED' ? 0.2 : 0.34) * behavior.emotionIntensity;

        for (const preset of Object.keys(this.emotionWeights)) {
          let targetWeight = preset === this.activeEmotionVrmPreset ? emotionBase * speechSuppression : 0;
          if (preset === 'relaxed' && behavior.eye.squint > 0) {
            targetWeight = Math.max(targetWeight, behavior.eye.squint * speechSuppression);
          }
          const weight = THREE.MathUtils.damp(this.emotionWeights[preset], targetWeight, 5.5, frameDelta);
          this.emotionWeights[preset] = weight;
          manager.setValue(preset, weight);
        }
      }

      // Apply Hips (Contrapposto weight shift & living body sway)
      if (this.vrmHipsBone) {
        const targetHipsZ = this.vrmHipsRest.z + (behavior.posture.hipTiltZ + behavior.posture.bodySway.z) * motion;
        const targetHipsY = this.vrmHipsRest.y + behavior.posture.hipYawY * motion;
        this.vrmHipsBone.rotation.z = THREE.MathUtils.damp(this.vrmHipsBone.rotation.z, targetHipsZ, 3.2, frameDelta);
        this.vrmHipsBone.rotation.y = THREE.MathUtils.damp(this.vrmHipsBone.rotation.y, targetHipsY, 3.0, frameDelta);
        this.vrmHipsBone.position.x = behavior.posture.bodySway.x * motion;
      }

      // Apply Spine (Breathing expansion & S-curve contrapposto)
      if (this.vrmSpineBone) {
        const targetSpineX = this.vrmSpineRest.x +
          (behavior.respiration.spineExpansion + behavior.posture.spineCurve.x + this.animationFrame.torso.lean) * motion;
        const targetSpineZ = this.vrmSpineRest.z +
          (behavior.posture.spineCurve.z + this.animationFrame.torso.lean * 0.4) * motion;

        this.vrmSpineBone.rotation.x = THREE.MathUtils.damp(this.vrmSpineBone.rotation.x, targetSpineX, 3.5, frameDelta);
        this.vrmSpineBone.rotation.z = THREE.MathUtils.damp(this.vrmSpineBone.rotation.z, targetSpineZ, 3.0, frameDelta);
      }

      // Apply Chest & Upper Chest (Respiration lift & posture roll counter)
      if (this.vrmChestBone) {
        const targetChestX = this.vrmChestRest.x +
          (behavior.respiration.chestExpansion + behavior.posture.chestOrientation.x) * motion;
        const targetChestZ = this.vrmChestRest.z +
          behavior.posture.chestOrientation.z * motion;

        this.vrmChestBone.rotation.x = THREE.MathUtils.damp(this.vrmChestBone.rotation.x, targetChestX, 4.0, frameDelta);
        this.vrmChestBone.rotation.z = THREE.MathUtils.damp(this.vrmChestBone.rotation.z, targetChestZ, 3.5, frameDelta);
      }
      if (this.vrmUpperChestBone) {
        const targetUpperChestX = this.vrmUpperChestRest.x +
          behavior.respiration.chestExpansion * 0.7 * motion;
        this.vrmUpperChestBone.rotation.x = THREE.MathUtils.damp(this.vrmUpperChestBone.rotation.x, targetUpperChestX, 4.0, frameDelta);
      }

      // Apply Clavicles / Shoulders (Respiration lift & contrapposto offset)
      if (this.vrmLeftShoulderBone) {
        const targetLShoulderZ = this.vrmLeftShoulderRest.z +
          (behavior.respiration.shoulderLift + behavior.posture.leftShoulderOffset.y + behavior.micro.shoulderTwitch) * motion;
        this.vrmLeftShoulderBone.rotation.z = THREE.MathUtils.damp(this.vrmLeftShoulderBone.rotation.z, targetLShoulderZ, 3.5, frameDelta);
      }
      if (this.vrmRightShoulderBone) {
        const targetRShoulderZ = this.vrmRightShoulderRest.z -
          (behavior.respiration.shoulderLift - behavior.posture.rightShoulderOffset.y + behavior.micro.shoulderTwitch) * motion;
        this.vrmRightShoulderBone.rotation.z = THREE.MathUtils.damp(this.vrmRightShoulderBone.rotation.z, targetRShoulderZ, 3.5, frameDelta);
      }

      // Apply Head & Neck (Context-aware nods, tilts, micro-sway)
      if (this.vrmHeadBone) {
        const targetHeadX = this.vrmHeadRest.x + (behavior.head.rotation.x + this.animationFrame.head.x) * motion;
        const targetHeadY = this.vrmHeadRest.y + (behavior.head.rotation.y + this.animationFrame.head.y) * motion;
        const targetHeadZ = this.vrmHeadRest.z + (behavior.head.rotation.z + this.animationFrame.head.z) * motion;

        this.vrmHeadBone.rotation.x = THREE.MathUtils.damp(this.vrmHeadBone.rotation.x, targetHeadX, 4.5, frameDelta);
        this.vrmHeadBone.rotation.y = THREE.MathUtils.damp(this.vrmHeadBone.rotation.y, targetHeadY, 4.0, frameDelta);
        this.vrmHeadBone.rotation.z = THREE.MathUtils.damp(this.vrmHeadBone.rotation.z, targetHeadZ, 3.8, frameDelta);
      }

      if (this.vrmNeckBone) {
        const targetNeckX = this.vrmNeckRest.x +
          (behavior.head.rotation.x * 0.35 + behavior.respiration.neckTension) * motion;
        const targetNeckY = this.vrmNeckRest.y + (behavior.head.rotation.y * 0.35) * motion;
        const targetNeckZ = this.vrmNeckRest.z + (behavior.head.rotation.z * 0.35) * motion;

        this.vrmNeckBone.rotation.x = THREE.MathUtils.damp(this.vrmNeckBone.rotation.x, targetNeckX, 4.5, frameDelta);
        this.vrmNeckBone.rotation.y = THREE.MathUtils.damp(this.vrmNeckBone.rotation.y, targetNeckY, 4.0, frameDelta);
        this.vrmNeckBone.rotation.z = THREE.MathUtils.damp(this.vrmNeckBone.rotation.z, targetNeckZ, 3.8, frameDelta);
      }

      // Apply Arms & Hands (Length-aware expressive gestures & micro-twitches)
      if (this.vrmRightUpperArm) {
        this.vrmRightUpperArm.rotation.x = THREE.MathUtils.damp(
          this.vrmRightUpperArm.rotation.x,
          this.rightArmRest.x + (behavior.speech.rightArm.upperArm.x + this.animationFrame.arms.right) * motion,
          5.0,
          frameDelta
        );
        this.vrmRightUpperArm.rotation.y = THREE.MathUtils.damp(
          this.vrmRightUpperArm.rotation.y,
          this.rightArmRest.y + behavior.speech.rightArm.upperArm.y * motion,
          5.0,
          frameDelta
        );
        this.vrmRightUpperArm.rotation.z = THREE.MathUtils.damp(
          this.vrmRightUpperArm.rotation.z,
          this.rightArmRest.z + (behavior.speech.rightArm.upperArm.z - behavior.respiration.shoulderLift * 0.5) * motion,
          5.0,
          frameDelta
        );
      }
      if (this.vrmRightLowerArm) {
        this.vrmRightLowerArm.rotation.y = THREE.MathUtils.damp(
          this.vrmRightLowerArm.rotation.y,
          this.rightLowerArmRest.y + behavior.speech.rightArm.lowerArm.y * motion,
          5.0,
          frameDelta
        );
      }
      if (this.vrmRightHand) {
        this.vrmRightHand.rotation.x = THREE.MathUtils.damp(
          this.vrmRightHand.rotation.x,
          this.rightHandRest.x + (behavior.speech.rightArm.hand.x + behavior.micro.rightHandFingers * 0.5) * motion,
          5.0,
          frameDelta
        );
      }

      if (this.vrmLeftUpperArm) {
        this.vrmLeftUpperArm.rotation.x = THREE.MathUtils.damp(
          this.vrmLeftUpperArm.rotation.x,
          this.leftArmRest.x + (behavior.speech.leftArm.upperArm.x + this.animationFrame.arms.left) * motion,
          5.0,
          frameDelta
        );
        this.vrmLeftUpperArm.rotation.y = THREE.MathUtils.damp(
          this.vrmLeftUpperArm.rotation.y,
          this.leftArmRest.y + behavior.speech.leftArm.upperArm.y * motion,
          5.0,
          frameDelta
        );
        this.vrmLeftUpperArm.rotation.z = THREE.MathUtils.damp(
          this.vrmLeftUpperArm.rotation.z,
          this.leftArmRest.z + (behavior.speech.leftArm.upperArm.z + behavior.respiration.shoulderLift * 0.5) * motion,
          5.0,
          frameDelta
        );
      }
      if (this.vrmLeftLowerArm) {
        this.vrmLeftLowerArm.rotation.y = THREE.MathUtils.damp(
          this.vrmLeftLowerArm.rotation.y,
          this.leftLowerArmRest.y + behavior.speech.leftArm.lowerArm.y * motion,
          5.0,
          frameDelta
        );
      }
      if (this.vrmLeftHand) {
        this.vrmLeftHand.rotation.x = THREE.MathUtils.damp(
          this.vrmLeftHand.rotation.x,
          this.leftHandRest.x + (behavior.speech.leftArm.hand.x + behavior.micro.leftHandFingers * 0.5) * motion,
          5.0,
          frameDelta
        );
      }
    }

    // 5. Procedural Humanoid Rig Animation
    if (this.mouthMesh) {
      this.mouthMesh.scale.set(
        1 + this.displayedViseme * 0.2 + behavior.micro.mouthMicroTwitch,
        1 + this.displayedViseme * 1.2,
        1
      );
    }
    if (this.chestBone) {
      this.chestBone.position.y = 0.22 + (behavior.respiration.chestExpansion * 2.5 + this.animationFrame.torso.shoulderLift * 0.12) * motion;
      this.chestBone.rotation.x = (behavior.respiration.chestExpansion + behavior.posture.chestOrientation.x + this.animationFrame.torso.lean) * motion;
      this.chestBone.rotation.z = (behavior.posture.chestOrientation.z) * motion;
    }
    if (this.headBone) {
      this.headBone.rotation.x = THREE.MathUtils.damp(
        this.headBone.rotation.x,
        (behavior.head.rotation.x + this.animationFrame.head.x) * motion,
        4.5,
        frameDelta
      );
      this.headBone.rotation.y = THREE.MathUtils.damp(
        this.headBone.rotation.y,
        (behavior.head.rotation.y + this.animationFrame.head.y) * motion,
        4.0,
        frameDelta
      );
      this.headBone.rotation.z = THREE.MathUtils.damp(
        this.headBone.rotation.z,
        (behavior.head.rotation.z + this.animationFrame.head.z) * motion,
        3.8,
        frameDelta
      );
    }
    if (this.leftEyebrow && this.rightEyebrow) {
      this.leftEyebrow.rotation.z = THREE.MathUtils.damp(this.leftEyebrow.rotation.z, this.targetLeftBrowRotation + behavior.micro.browTwitch, 7, frameDelta);
      this.rightEyebrow.rotation.z = THREE.MathUtils.damp(this.rightEyebrow.rotation.z, this.targetRightBrowRotation - behavior.micro.browTwitch, 7, frameDelta);
      this.leftEyebrow.position.y = THREE.MathUtils.damp(this.leftEyebrow.position.y, this.targetLeftBrowHeight, 7, frameDelta);
      this.rightEyebrow.position.y = THREE.MathUtils.damp(this.rightEyebrow.position.y, this.targetRightBrowHeight, 7, frameDelta);
    }
    if (this.leftEye && this.rightEye) {
      const proceduralBlinkScale = motion ? Math.max(0.08, 1 - behavior.eye.leftBlink) : 1;
      this.leftEye.scale.y = proceduralBlinkScale;
      this.rightEye.scale.y = proceduralBlinkScale;
    }
    if (!this.isVrm) {
      if (this.proceduralRightArm) {
        this.proceduralRightArm.rotation.z = this.rightArmRest.z + (behavior.speech.rightArm.upperArm.z + this.animationFrame.arms.right) * motion;
        this.proceduralRightArm.rotation.x = this.rightArmRest.x + behavior.speech.rightArm.upperArm.x * motion;
      }
      if (this.proceduralLeftArm) {
        this.proceduralLeftArm.rotation.z = this.leftArmRest.z + (behavior.speech.leftArm.upperArm.z + this.animationFrame.arms.left) * motion;
        this.proceduralLeftArm.rotation.x = this.leftArmRest.x + behavior.speech.leftArm.upperArm.x * motion;
      }
    }

    if (this.crystalCore) {
      this.crystalCore.rotation.y += frameDelta * 1.2 * motion;
      const pulseScale = 1 + (behavior.respiration.lungVolume * 0.05) * motion;
      this.crystalCore.scale.setScalar(pulseScale);
    }
  }

  public dispose(): void {
    dispose3DResource(this.root);
  }
}
