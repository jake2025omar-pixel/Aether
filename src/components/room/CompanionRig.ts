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
  private readonly lookDirection = new THREE.Vector3();
  private leftUpperArm: THREE.Object3D | null = null;
  private rightUpperArm: THREE.Object3D | null = null;
  private readonly leftArmRestZ = -0.85;
  private readonly rightArmRestZ = 0.85;

  // Animation states
  private currentEmotion: CompanionEmotion = 'NEUTRAL';
  private currentViseme: number = 0; // 0 (closed) to 1 (wide open)
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
      this.leftUpperArm = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
      this.rightUpperArm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
      if (this.leftUpperArm) this.leftUpperArm.rotation.z = this.leftArmRestZ;
      if (this.rightUpperArm) this.rightUpperArm.rotation.z = this.rightArmRestZ;
    } else {
      this.buildProceduralHumanoidRig();
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

    if (this.isVrm && this.vrmInstance?.expressionManager) {
      // Clear previous emotions
      const manager = this.vrmInstance.expressionManager;
      const emotions = ['happy', 'angry', 'sad', 'relaxed', 'surprised'];
      emotions.forEach((e) => manager.setValue(e, 0));

      const vrmMap: Record<CompanionEmotion, string> = {
        NEUTRAL: 'relaxed',
        HAPPY: 'happy',
        SAD: 'sad',
        ANGRY: 'angry',
        SURPRISED: 'surprised',
        CONFUSED: 'surprised',
        THINKING: 'relaxed',
      };
      const target = vrmMap[emotion];
      if (target) manager.setValue(target, 0.85);
      return;
    }

    // Procedural rig emotion modulation
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
   * Sets real-time lip-sync mouth opening (0 = closed, 1 = open)
   */
  public setViseme(mouthOpen: number): void {
    this.currentViseme = Math.max(0, Math.min(1, mouthOpen));

    if (this.isVrm && this.vrmInstance?.expressionManager) {
      this.vrmInstance.expressionManager.setValue('aa', this.currentViseme * 0.9);
      this.vrmInstance.expressionManager.setValue('oh', this.currentViseme * 0.4);
      return;
    }

    if (this.mouthMesh) {
      // Scale mouth vertically and slightly horizontally for natural phoneme opening
      const scaleY = 1.0 + this.currentViseme * 3.5;
      const scaleX = 1.0 + this.currentViseme * 0.4;
      this.mouthMesh.scale.set(scaleX, scaleY, 1.0);
    }
  }

  /**
   * Updates idle breathing, eye blinking, and lookAt tracking every frame
   */
  public update(delta: number, elapsedTime: number, targetLookPos?: THREE.Vector3): void {
    if (this.isVrm && this.vrmInstance) {
      this.vrmInstance.update(delta);
      const armSway = Math.sin(elapsedTime * 0.8) * 0.025;
      if (this.leftUpperArm) this.leftUpperArm.rotation.z = this.leftArmRestZ - armSway;
      if (this.rightUpperArm) this.rightUpperArm.rotation.z = this.rightArmRestZ + armSway;
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
        const lookDir = this.lookDirection.copy(targetLookPos).sub(this.root.position).normalize();
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
