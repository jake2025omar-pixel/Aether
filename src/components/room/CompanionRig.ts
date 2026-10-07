import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import { CompanionEmotion, CompanionState } from '../../lib/companionPersonality';
import { dispose3DResource } from '@/Aether/3D/Preview/AssetPreviewLoader';

export class CompanionRig {
  public root: THREE.Group;
  private vrmInstance: VRM | null = null;
  private isVrm: boolean = false;

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
  private vrmHeadBone: THREE.Object3D | null = null;
  private vrmSpineBone: THREE.Object3D | null = null;
  private vrmLeftUpperArm: THREE.Object3D | null = null;
  private vrmRightUpperArm: THREE.Object3D | null = null;
  private readonly vrmHeadRest = new THREE.Euler();
  private readonly vrmSpineRest = new THREE.Euler();
  private readonly leftArmRest = new THREE.Euler();
  private readonly rightArmRest = new THREE.Euler();
  private readonly lookDirection = new THREE.Vector3();
  private targetLeftBrowRotation = 0;
  private targetRightBrowRotation = 0;
  private targetLeftBrowHeight = 0.05;
  private targetRightBrowHeight = 0.05;

  // Animation states
  private currentEmotion: CompanionEmotion = 'NEUTRAL';
  private currentState: CompanionState = 'IDLE';
  private motionEnabled = true;
  private gestureTime = 1;
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
  private blinkTimer: number = 0;
  private nextBlinkTime: number = 3.5;
  private isBlinking: boolean = false;
  private blinkProgress: number = 0;

  constructor(vrm?: VRM | null) {
    this.root = new THREE.Group();

    if (vrm) {
      this.vrmInstance = vrm;
      this.isVrm = true;
      this.root.add(vrm.scene);
      this.vrmHeadBone = vrm.humanoid?.getNormalizedBoneNode('head') || null;
      this.vrmSpineBone = vrm.humanoid?.getNormalizedBoneNode('spine') || null;
      if (this.vrmHeadBone) this.vrmHeadRest.copy(this.vrmHeadBone.rotation);
      if (this.vrmSpineBone) this.vrmSpineRest.copy(this.vrmSpineBone.rotation);
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
    const leftUpperArm = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
    const rightUpperArm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
    const leftLowerArm = vrm.humanoid.getNormalizedBoneNode('leftLowerArm');
    const rightLowerArm = vrm.humanoid.getNormalizedBoneNode('rightLowerArm');
    const leftHand = vrm.humanoid.getNormalizedBoneNode('leftHand');
    const rightHand = vrm.humanoid.getNormalizedBoneNode('rightHand');

    // Natural companion idle stance: arms relaxed along body sides
    if (leftUpperArm) {
      leftUpperArm.rotation.set(0.12, 0.05, -1.25);
      this.vrmLeftUpperArm = leftUpperArm;
      this.leftArmRest.copy(leftUpperArm.rotation);
    }
    if (rightUpperArm) {
      rightUpperArm.rotation.set(0.12, -0.05, 1.25);
      this.vrmRightUpperArm = rightUpperArm;
      this.rightArmRest.copy(rightUpperArm.rotation);
    }
    if (leftLowerArm) {
      leftLowerArm.rotation.set(0, -0.15, -0.12);
    }
    if (rightLowerArm) {
      rightLowerArm.rotation.set(0, 0.15, 0.12);
    }
    if (leftHand) {
      leftHand.rotation.set(0.05, 0, 0.05);
    }
    if (rightHand) {
      rightHand.rotation.set(0.05, 0, -0.05);
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
    if (state === this.currentState) return;
    this.currentState = state;
    this.gestureTime = state === 'SPEAKING' || state === 'LISTENING' ? 0 : 1;
  }

  public setMotionEnabled(enabled: boolean): void {
    this.motionEnabled = enabled;
    if (!enabled) {
      this.gestureTime = 1;
      this.blinkTimer = 0;
      this.isBlinking = false;
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

  /**
   * Updates idle breathing, eye blinking, lookAt tracking, and expressions every frame
  */
  public update(delta: number, elapsedTime: number, targetLookPos?: THREE.Vector3): void {
    const frameDelta = Math.min(Math.max(delta, 0), 0.05);
    const motion = this.motionEnabled ? 1 : 0;
    const breath = Math.sin(elapsedTime * 1.6) * 0.012 * motion;

    this.displayedViseme = THREE.MathUtils.damp(this.displayedViseme, this.targetViseme, 18, frameDelta);
    if (this.targetViseme === 0 && this.displayedViseme < 0.005) this.displayedViseme = 0;

    if (this.currentState === 'SPEAKING' || this.currentState === 'LISTENING') {
      this.gestureTime += frameDelta;
    } else {
      this.gestureTime = 1;
    }
    const gestureProgress = Math.min(this.gestureTime / 0.72, 1);
    const gesturePulse = Math.sin(gestureProgress * Math.PI) * (1 - gestureProgress) * motion;

    const lookDir = targetLookPos
      ? this.lookDirection.copy(targetLookPos).sub(this.root.position).normalize()
      : null;
    const lookYaw = motion
      ? (lookDir ? THREE.MathUtils.clamp(lookDir.x * 0.16, -0.12, 0.12) : Math.sin(elapsedTime * 0.55) * 0.025)
      : 0;
    const lookPitch = motion && lookDir ? THREE.MathUtils.clamp(-lookDir.y * 0.08, -0.08, 0.08) : 0;
    const stateTilt = this.currentState === 'LISTENING' ? 0.045 : 0;
    const emotionTilt = this.currentEmotion === 'CURIOUS' || this.currentEmotion === 'CONFUSED'
      ? -0.055
      : this.currentEmotion === 'SAD' || this.currentEmotion === 'EMPATHETIC'
        ? 0.025
        : this.currentEmotion === 'GENTLY_ANNOYED'
          ? -0.025
          : 0;

    if (this.isVrm && this.vrmInstance) {
      if (this.motionEnabled) {
        this.vrmInstance.update(frameDelta);
      } else {
        // Preserve expressions and lip sync without advancing look-at or spring-bone physics.
        this.vrmInstance.expressionManager?.update();
      }

      const manager = this.vrmInstance.expressionManager;
      if (manager) {
        // Dark Ice maps aa to Fcl_MTH_A; a conservative single-channel value avoids extreme mouth deformation.
        manager.setValue('aa', Math.min(0.18, this.displayedViseme * 0.2));
        manager.setValue('oh', 0);
        manager.setValue('ih', 0);
        manager.setValue('ou', 0);
        manager.setValue('ee', 0);

        const speechSuppression = Math.max(0.42, 1 - this.displayedViseme * 0.9);
        const emotionBase = this.currentEmotion === 'NEUTRAL' ? 0.18
          : this.currentEmotion === 'GENTLY_ANNOYED' ? 0.2 : 0.34;
        for (const preset of Object.keys(this.emotionWeights)) {
          const targetWeight = preset === this.activeEmotionVrmPreset ? emotionBase * speechSuppression : 0;
          const weight = THREE.MathUtils.damp(this.emotionWeights[preset], targetWeight, 5.5, frameDelta);
          this.emotionWeights[preset] = weight;
          manager.setValue(preset, weight);
        }
      }

      if (this.vrmSpineBone) {
        const lean = this.currentState === 'LISTENING' ? 0.018 : 0;
        this.vrmSpineBone.rotation.x = THREE.MathUtils.damp(
          this.vrmSpineBone.rotation.x,
          this.vrmSpineRest.x + breath + lean * motion,
          3.5,
          frameDelta
        );
      }

      if (this.vrmHeadBone) {
        const thinkingTilt = this.currentEmotion === 'THINKING' ? -0.07 : 0;
        this.vrmHeadBone.rotation.x = THREE.MathUtils.damp(
          this.vrmHeadBone.rotation.x,
          this.vrmHeadRest.x + lookPitch + thinkingTilt * motion + gesturePulse * 0.035,
          4.5,
          frameDelta
        );
        this.vrmHeadBone.rotation.y = THREE.MathUtils.damp(
          this.vrmHeadBone.rotation.y,
          this.vrmHeadRest.y + lookYaw + (this.currentEmotion === 'THINKING' ? 0.08 * motion : 0),
          4,
          frameDelta
        );
        this.vrmHeadBone.rotation.z = THREE.MathUtils.damp(
          this.vrmHeadBone.rotation.z,
          this.vrmHeadRest.z + (stateTilt + emotionTilt) * motion,
          3.5,
          frameDelta
        );
      }

      const armGesture = gesturePulse * (this.currentState === 'SPEAKING' ? 0.065 : 0.035);
      if (this.vrmRightUpperArm) {
        this.vrmRightUpperArm.rotation.copy(this.rightArmRest);
        this.vrmRightUpperArm.rotation.x += armGesture;
      }
      if (this.vrmLeftUpperArm) {
        this.vrmLeftUpperArm.rotation.copy(this.leftArmRest);
        this.vrmLeftUpperArm.rotation.x -= armGesture * 0.35;
      }
    }

    if (this.mouthMesh) {
      this.mouthMesh.scale.set(1 + this.displayedViseme * 0.2, 1 + this.displayedViseme * 1.2, 1);
    }
    if (this.chestBone) {
      this.chestBone.position.y = 0.22 + breath;
      this.chestBone.rotation.x = breath * 0.8;
    }
    if (this.headBone) {
      this.headBone.rotation.x = THREE.MathUtils.damp(
        this.headBone.rotation.x,
        lookPitch + (this.currentEmotion === 'THINKING' ? -0.07 * motion : 0) + gesturePulse * 0.035,
        4.5,
        frameDelta
      );
      this.headBone.rotation.y = THREE.MathUtils.damp(this.headBone.rotation.y, lookYaw, 4, frameDelta);
      this.headBone.rotation.z = THREE.MathUtils.damp(
        this.headBone.rotation.z,
        (stateTilt + emotionTilt) * motion,
        3.5,
        frameDelta
      );
    }
    if (this.leftEyebrow && this.rightEyebrow) {
      this.leftEyebrow.rotation.z = THREE.MathUtils.damp(this.leftEyebrow.rotation.z, this.targetLeftBrowRotation, 7, frameDelta);
      this.rightEyebrow.rotation.z = THREE.MathUtils.damp(this.rightEyebrow.rotation.z, this.targetRightBrowRotation, 7, frameDelta);
      this.leftEyebrow.position.y = THREE.MathUtils.damp(this.leftEyebrow.position.y, this.targetLeftBrowHeight, 7, frameDelta);
      this.rightEyebrow.position.y = THREE.MathUtils.damp(this.rightEyebrow.position.y, this.targetRightBrowHeight, 7, frameDelta);
    }
    if (!this.isVrm) {
      const armGesture = gesturePulse * (this.currentState === 'SPEAKING' ? 0.08 : 0.04);
      if (this.proceduralRightArm) this.proceduralRightArm.rotation.z = this.rightArmRest.z + armGesture;
      if (this.proceduralLeftArm) this.proceduralLeftArm.rotation.z = this.leftArmRest.z - armGesture * 0.35;
    }

    if (this.crystalCore) {
      this.crystalCore.rotation.y += frameDelta * 1.2 * motion;
      const pulseScale = 1 + Math.sin(elapsedTime * 2.4) * 0.045 * motion;
      this.crystalCore.scale.setScalar(pulseScale);
    }

    if (this.motionEnabled) {
      this.blinkTimer += frameDelta;
      if (!this.isBlinking && this.blinkTimer >= this.nextBlinkTime) {
        this.isBlinking = true;
        this.blinkProgress = 0;
        this.blinkTimer = 0;
        this.nextBlinkTime = 2.8 + Math.random() * 3.2;
      }
      if (this.isBlinking) {
        this.blinkProgress += frameDelta * 8;
        const blinkScaleY = Math.max(0.08, Math.abs(Math.cos(this.blinkProgress * Math.PI)));
        if (this.leftEye && this.rightEye) {
          this.leftEye.scale.y = blinkScaleY;
          this.rightEye.scale.y = blinkScaleY;
        }
        if (this.isVrm && this.vrmInstance?.expressionManager) {
          this.vrmInstance.expressionManager.setValue('blink', 1 - blinkScaleY);
        }
        if (this.blinkProgress >= 1) {
          this.isBlinking = false;
          if (this.leftEye && this.rightEye) {
            this.leftEye.scale.y = 1;
            this.rightEye.scale.y = 1;
          }
          if (this.isVrm && this.vrmInstance?.expressionManager) {
            this.vrmInstance.expressionManager.setValue('blink', 0);
          }
        }
      }
    }
  }

  public dispose(): void {
    dispose3DResource(this.root);
  }
}
