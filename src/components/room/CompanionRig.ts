import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import { CompanionEmotion } from '../../lib/companionPersonality';
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

  // Animation states
  private currentEmotion: CompanionEmotion = 'NEUTRAL';
  private targetViseme: number = 0; // 0 (closed) to 1 (wide open)
  private displayedViseme: number = 0; // Smoothly damped mouth aperture
  private activeEmotionVrmPreset: string = 'relaxed';
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
    }
    if (rightUpperArm) {
      rightUpperArm.rotation.set(0.12, -0.05, 1.25);
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

    const rightArm = new THREE.Mesh(armGeo, outfitMat);
    rightArm.position.set(0.19, 0.05, 0);
    rightArm.rotation.z = 0.15;
    chest.add(rightArm);

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
    };
    this.activeEmotionVrmPreset = vrmMap[emotion] || 'relaxed';

    // Procedural rig eyebrow emotion modulation
    if (this.leftEyebrow && this.rightEyebrow) {
      switch (emotion) {
        case 'HAPPY':
          this.leftEyebrow.rotation.z = -0.15;
          this.rightEyebrow.rotation.z = 0.15;
          this.leftEyebrow.position.y = 0.055;
          this.rightEyebrow.position.y = 0.055;
          break;
        case 'SAD':
          this.leftEyebrow.rotation.z = 0.2;
          this.rightEyebrow.rotation.z = -0.2;
          this.leftEyebrow.position.y = 0.045;
          this.rightEyebrow.position.y = 0.045;
          break;
        case 'SURPRISED':
          this.leftEyebrow.rotation.z = 0;
          this.rightEyebrow.rotation.z = 0;
          this.leftEyebrow.position.y = 0.065;
          this.rightEyebrow.position.y = 0.065;
          break;
        case 'ANGRY':
          this.leftEyebrow.rotation.z = 0.25;
          this.rightEyebrow.rotation.z = -0.25;
          this.leftEyebrow.position.y = 0.042;
          this.rightEyebrow.position.y = 0.042;
          break;
        case 'CONFUSED':
        case 'THINKING':
          this.leftEyebrow.rotation.z = -0.25;
          this.rightEyebrow.rotation.z = 0.05;
          break;
        default:
          this.leftEyebrow.rotation.z = 0;
          this.rightEyebrow.rotation.z = 0;
          this.leftEyebrow.position.y = 0.05;
          this.rightEyebrow.position.y = 0.05;
          break;
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
    // 1. Smoothly interpolate displayed mouth viseme
    this.displayedViseme = THREE.MathUtils.damp(this.displayedViseme, this.targetViseme, 22, delta);
    if (this.targetViseme === 0 && this.displayedViseme < 0.005) {
      this.displayedViseme = 0;
    }

    if (this.isVrm && this.vrmInstance) {
      this.vrmInstance.update(delta);

      if (this.vrmInstance.expressionManager) {
        const manager = this.vrmInstance.expressionManager;

        // Dedicated single-channel mouth speech (aa):
        // Capped at 0.42 to ensure lips stay firmly attached and never tear or expose dark void
        const safeMouthAperture = this.displayedViseme * 0.42;
        manager.setValue('aa', safeMouthAperture);
        manager.setValue('oh', 0);
        manager.setValue('ih', 0);
        manager.setValue('ou', 0);
        manager.setValue('ee', 0);

        // Emotion mouth decoupling:
        // Whole-face emotion presets (happy, relaxed, surprised) contain built-in mouth smiles/curves.
        // As the speech viseme opens, we smoothly attenuate the emotion weight on the mouth
        // so mouth shapes NEVER compound additively or exceed the natural biological range.
        const emotions = ['happy', 'angry', 'sad', 'relaxed', 'surprised'];
        const speechSuppression = Math.max(0, 1.0 - this.displayedViseme * 0.85);
        const targetEmotionWeight = 0.55 * speechSuppression;

        for (const e of emotions) {
          if (e === this.activeEmotionVrmPreset) {
            manager.setValue(e, targetEmotionWeight);
          } else {
            manager.setValue(e, 0);
          }
        }
      }

      const spineNode = this.vrmInstance.humanoid?.getNormalizedBoneNode('spine');
      const headNode = this.vrmInstance.humanoid?.getNormalizedBoneNode('head');
      const breathOffset = Math.sin(elapsedTime * 1.6) * 0.015;

      if (spineNode) {
        spineNode.rotation.x = breathOffset;
      }

      if (headNode && targetLookPos) {
        const lookDir = targetLookPos.clone().sub(this.root.position).normalize();
        headNode.rotation.y = THREE.MathUtils.lerp(headNode.rotation.y, lookDir.x * 0.22, 0.04);
        headNode.rotation.x = THREE.MathUtils.lerp(headNode.rotation.x, -lookDir.y * 0.12, 0.04);
      }
    }

    // Procedural fallback mouth scaling
    if (this.mouthMesh) {
      const scaleY = 1.0 + this.displayedViseme * 1.5;
      const scaleX = 1.0 + this.displayedViseme * 0.2;
      this.mouthMesh.scale.set(scaleX, scaleY, 1.0);
    }

    // 1. Natural Sinusoidal Idle Breathing (Chest & Spine)
    const breathRate = 1.6;
    const breathOffset = Math.sin(elapsedTime * breathRate) * 0.015;

    if (this.chestBone) {
      this.chestBone.position.y = 0.22 + breathOffset;
      this.chestBone.rotation.x = Math.sin(elapsedTime * breathRate) * 0.015;
    }

    // 2. Idle Head Sway and Look-At Tracking
    if (this.headBone) {
      if (this.currentEmotion === 'THINKING') {
        this.headBone.rotation.x = -0.1;
        this.headBone.rotation.y = 0.15;
      } else if (targetLookPos) {
        // Soft head track towards target
        const lookDir = targetLookPos.clone().sub(this.root.position).normalize();
        this.headBone.rotation.y = THREE.MathUtils.lerp(this.headBone.rotation.y, lookDir.x * 0.25, 0.05);
        this.headBone.rotation.x = THREE.MathUtils.lerp(this.headBone.rotation.x, -lookDir.y * 0.15, 0.05);
      } else {
        this.headBone.rotation.y = Math.sin(elapsedTime * 0.8) * 0.03;
        this.headBone.rotation.z = Math.cos(elapsedTime * 0.5) * 0.01;
      }
    }

    // 3. Crystal Core Pulse
    if (this.crystalCore) {
      this.crystalCore.rotation.y += delta * 1.5;
      const pulseScale = 1.0 + Math.sin(elapsedTime * 3.0) * 0.08;
      this.crystalCore.scale.set(pulseScale, pulseScale, pulseScale);
    }

    // 4. Random Human Eye Blinking Cycle
    this.blinkTimer += delta;
    if (!this.isBlinking && this.blinkTimer >= this.nextBlinkTime) {
      this.isBlinking = true;
      this.blinkProgress = 0;
      this.blinkTimer = 0;
      this.nextBlinkTime = 2.5 + Math.random() * 3.0; // Next blink in 2.5 to 5.5s
    }

    if (this.isBlinking) {
      this.blinkProgress += delta * 8.0; // Fast 120ms blink duration
      const blinkScaleY = Math.max(0.08, Math.abs(Math.cos(this.blinkProgress * Math.PI)));

      if (this.leftEye && this.rightEye) {
        this.leftEye.scale.y = blinkScaleY;
        this.rightEye.scale.y = blinkScaleY;
      }

      if (this.isVrm && this.vrmInstance?.expressionManager) {
        this.vrmInstance.expressionManager.setValue('blink', 1.0 - blinkScaleY);
      }

      if (this.blinkProgress >= 1.0) {
        this.isBlinking = false;
        if (this.leftEye && this.rightEye) {
          this.leftEye.scale.y = 1.0;
          this.rightEye.scale.y = 1.0;
        }
        if (this.isVrm && this.vrmInstance?.expressionManager) {
          this.vrmInstance.expressionManager.setValue('blink', 0);
        }
      }
    }
  }

  public dispose(): void {
    dispose3DResource(this.root);
  }
}
