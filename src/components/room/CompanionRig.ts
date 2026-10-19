import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import { CompanionEmotion, CompanionState } from '../../lib/companionPersonality';
import { dispose3DResource } from '@/Aether/3D/Preview/AssetPreviewLoader';
import { AnimationEvent, AnimationOrchestrator, SemanticAnimationFrame } from '../../lib/animationOrchestrator';
import {
  CharacterPerformanceDirector,
  FullBodyActionType,
  AnimeExpressionStyle,
  computePresetJoints,
} from '../../lib/behavior';

const FINGER_BONE_NAMES = [
  'thumbMetacarpal',
  'thumbProximal',
  'thumbDistal',
  'indexProximal',
  'indexIntermediate',
  'indexDistal',
  'middleProximal',
  'middleIntermediate',
  'middleDistal',
  'ringProximal',
  'ringIntermediate',
  'ringDistal',
  'littleProximal',
  'littleIntermediate',
  'littleDistal',
] as const;

export class CompanionRig {
  public root: THREE.Group;
  private vrmInstance: VRM | null = null;
  private isVrm: boolean = false;

  // VRM Humanoid Bones - Upper Body
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

  // VRM Humanoid Bones - Lower Body & Locomotion
  private vrmLeftUpperLeg: THREE.Object3D | null = null;
  private vrmLeftLowerLeg: THREE.Object3D | null = null;
  private vrmLeftFoot: THREE.Object3D | null = null;
  private vrmLeftToes: THREE.Object3D | null = null;
  private vrmRightUpperLeg: THREE.Object3D | null = null;
  private vrmRightLowerLeg: THREE.Object3D | null = null;
  private vrmRightFoot: THREE.Object3D | null = null;
  private vrmRightToes: THREE.Object3D | null = null;

  // VRM Humanoid Bones - 30 Finger Bones
  private vrmLeftFingers: Record<string, THREE.Object3D | null> = {};
  private vrmRightFingers: Record<string, THREE.Object3D | null> = {};
  private vrmLeftFingerRest: Record<string, THREE.Euler> = {};
  private vrmRightFingerRest: Record<string, THREE.Euler> = {};

  // Face Meshes for Direct Morph Targets (57 blendshapes across all submesh primitives)
  private vrmFaceMeshes: THREE.Mesh[] = [];

  // Stored Rest Rotations & Positions
  private readonly vrmHipsRestPosition = new THREE.Vector3(0, 0.9100833, 0);
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

  private readonly leftUpperLegRest = new THREE.Euler();
  private readonly leftLowerLegRest = new THREE.Euler();
  private readonly leftFootRest = new THREE.Euler();
  private readonly rightUpperLegRest = new THREE.Euler();
  private readonly rightLowerLegRest = new THREE.Euler();
  private readonly rightFootRest = new THREE.Euler();

  // Procedural fallback rig references
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

  // Unified Character Performance Director
  public readonly performanceDirector = new CharacterPerformanceDirector();
  private readonly animationOrchestrator = new AnimationOrchestrator();
  private animationFrame: SemanticAnimationFrame = this.animationOrchestrator.update(0, 0);

  // States
  private currentEmotion: CompanionEmotion = 'NEUTRAL';
  private currentState: CompanionState = 'IDLE';
  private motionEnabled = true;
  private targetViseme: number = 0; // 0 to 1
  private displayedViseme: number = 0;

  constructor(vrm?: VRM | null) {
    this.root = new THREE.Group();

    if (vrm) {
      this.vrmInstance = vrm;
      this.isVrm = true;
      this.root.add(vrm.scene);

      const humanoid = vrm.humanoid;

      // 1. Acquire upper body skeleton
      this.vrmHeadBone = humanoid?.getNormalizedBoneNode('head') || null;
      this.vrmNeckBone = humanoid?.getNormalizedBoneNode('neck') || null;
      this.vrmChestBone = humanoid?.getNormalizedBoneNode('chest') || null;
      this.vrmUpperChestBone = humanoid?.getNormalizedBoneNode('upperChest') || null;
      this.vrmSpineBone = humanoid?.getNormalizedBoneNode('spine') || null;
      this.vrmHipsBone = humanoid?.getNormalizedBoneNode('hips') || null;
      this.vrmLeftShoulderBone = humanoid?.getNormalizedBoneNode('leftShoulder') || null;
      this.vrmRightShoulderBone = humanoid?.getNormalizedBoneNode('rightShoulder') || null;
      this.vrmLeftUpperArm = humanoid?.getNormalizedBoneNode('leftUpperArm') || null;
      this.vrmRightUpperArm = humanoid?.getNormalizedBoneNode('rightUpperArm') || null;
      this.vrmLeftLowerArm = humanoid?.getNormalizedBoneNode('leftLowerArm') || null;
      this.vrmRightLowerArm = humanoid?.getNormalizedBoneNode('rightLowerArm') || null;
      this.vrmLeftHand = humanoid?.getNormalizedBoneNode('leftHand') || null;
      this.vrmRightHand = humanoid?.getNormalizedBoneNode('rightHand') || null;

      // 2. Acquire lower body locomotion skeleton
      this.vrmLeftUpperLeg = humanoid?.getNormalizedBoneNode('leftUpperLeg') || null;
      this.vrmLeftLowerLeg = humanoid?.getNormalizedBoneNode('leftLowerLeg') || null;
      this.vrmLeftFoot = humanoid?.getNormalizedBoneNode('leftFoot') || null;
      this.vrmLeftToes = humanoid?.getNormalizedBoneNode('leftToes') || null;

      this.vrmRightUpperLeg = humanoid?.getNormalizedBoneNode('rightUpperLeg') || null;
      this.vrmRightLowerLeg = humanoid?.getNormalizedBoneNode('rightLowerLeg') || null;
      this.vrmRightFoot = humanoid?.getNormalizedBoneNode('rightFoot') || null;
      this.vrmRightToes = humanoid?.getNormalizedBoneNode('rightToes') || null;

      // 3. Acquire complete 30-bone finger hierarchy
      for (const joint of FINGER_BONE_NAMES) {
        const leftBoneName = `left${joint.charAt(0).toUpperCase() + joint.slice(1)}` as any;
        const rightBoneName = `right${joint.charAt(0).toUpperCase() + joint.slice(1)}` as any;
        this.vrmLeftFingers[joint] = humanoid?.getNormalizedBoneNode(leftBoneName) || null;
        this.vrmRightFingers[joint] = humanoid?.getNormalizedBoneNode(rightBoneName) || null;
        if (this.vrmLeftFingers[joint]) this.vrmLeftFingerRest[joint] = this.vrmLeftFingers[joint]!.rotation.clone();
        if (this.vrmRightFingers[joint]) this.vrmRightFingerRest[joint] = this.vrmRightFingers[joint]!.rotation.clone();
      }

      // 4. Find Face Meshes for Direct Morph Targets (57 blendshapes across all submesh primitives)
      this.vrmFaceMeshes = [];
      vrm.scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          if (mesh.morphTargetDictionary && (mesh.name.includes('Face') || 'Fcl_BRW_Joy' in mesh.morphTargetDictionary)) {
            this.vrmFaceMeshes.push(mesh);
          }
        }
      });

      // 5. Store Rest Rotations
      if (this.vrmHeadBone) this.vrmHeadRest.copy(this.vrmHeadBone.rotation);
      if (this.vrmNeckBone) this.vrmNeckRest.copy(this.vrmNeckBone.rotation);
      if (this.vrmChestBone) this.vrmChestRest.copy(this.vrmChestBone.rotation);
      if (this.vrmUpperChestBone) this.vrmUpperChestRest.copy(this.vrmUpperChestBone.rotation);
      if (this.vrmSpineBone) this.vrmSpineRest.copy(this.vrmSpineBone.rotation);
      if (this.vrmHipsBone) {
        this.vrmHipsRest.copy(this.vrmHipsBone.rotation);
        this.vrmHipsRestPosition.copy(this.vrmHipsBone.position);
      }
      if (this.vrmLeftShoulderBone) this.vrmLeftShoulderRest.copy(this.vrmLeftShoulderBone.rotation);
      if (this.vrmRightShoulderBone) this.vrmRightShoulderRest.copy(this.vrmRightShoulderBone.rotation);

      if (this.vrmLeftUpperLeg) this.leftUpperLegRest.copy(this.vrmLeftUpperLeg.rotation);
      if (this.vrmLeftLowerLeg) this.leftLowerLegRest.copy(this.vrmLeftLowerLeg.rotation);
      if (this.vrmLeftFoot) this.leftFootRest.copy(this.vrmLeftFoot.rotation);
      if (this.vrmRightUpperLeg) this.rightUpperLegRest.copy(this.vrmRightUpperLeg.rotation);
      if (this.vrmRightLowerLeg) this.rightLowerLegRest.copy(this.vrmRightLowerLeg.rotation);
      if (this.vrmRightFoot) this.rightFootRest.copy(this.vrmRightFoot.rotation);

      this.applyNaturalVrmRestPose(vrm);
    } else {
      this.buildProceduralHumanoidRig();
    }
  }

  private applyNaturalVrmRestPose(vrm: VRM): void {
    if (!vrm.humanoid) return;
    const leftUpperArm = this.vrmLeftUpperArm;
    const rightUpperArm = this.vrmRightUpperArm;
    const leftLowerArm = this.vrmLeftLowerArm;
    const rightLowerArm = this.vrmRightLowerArm;
    const leftHand = this.vrmLeftHand;
    const rightHand = this.vrmRightHand;

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

    // Initialize anatomical relaxed cascade for all 30 finger bones
    const relaxedLeft = computePresetJoints('RELAXED', true, 0);
    const relaxedRight = computePresetJoints('RELAXED', false, 0);
    for (const joint of FINGER_BONE_NAMES) {
      if (this.vrmLeftFingers[joint]) {
        const e = relaxedLeft[joint];
        this.vrmLeftFingerRest[joint] = new THREE.Euler(e.x, e.y, e.z);
        this.vrmLeftFingers[joint]!.rotation.copy(this.vrmLeftFingerRest[joint]);
      }
      if (this.vrmRightFingers[joint]) {
        const e = relaxedRight[joint];
        this.vrmRightFingerRest[joint] = new THREE.Euler(e.x, e.y, e.z);
        this.vrmRightFingers[joint]!.rotation.copy(this.vrmRightFingerRest[joint]);
      }
    }
  }

  private buildProceduralHumanoidRig(): void {
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xfce7f3,
      roughness: 0.45,
      metalness: 0.1,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x1e1035,
      roughness: 0.35,
      metalness: 0.4,
    });
    const outfitMat = new THREE.MeshStandardMaterial({
      color: 0x2e1065,
      roughness: 0.25,
      metalness: 0.75,
    });
    const crystalMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyebrowMat = new THREE.MeshBasicMaterial({ color: 0x581c87 });
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0xe879f9 });

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

    const headGeo = new THREE.SphereGeometry(0.125, 32, 32);
    headGeo.scale(0.95, 1.15, 1.0);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    head.add(headMesh);

    const hairTopGeo = new THREE.SphereGeometry(0.138, 24, 24);
    hairTopGeo.scale(1.02, 1.15, 1.05);
    const hairTop = new THREE.Mesh(hairTopGeo, hairMat);
    hairTop.position.set(0, 0.03, -0.015);
    head.add(hairTop);

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

    const eyeWhiteGeo = new THREE.SphereGeometry(0.022, 16, 16);
    const eyeIrisGeo = new THREE.CircleGeometry(0.014, 16);

    const leftEyeGroup = new THREE.Group();
    leftEyeGroup.position.set(-0.045, 0.015, 0.118);
    const leftEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    const leftEyeIris = new THREE.Mesh(eyeIrisGeo, eyeMat);
    leftEyeIris.position.z = 0.021;
    leftEyeGroup.add(leftEyeWhite);
    leftEyeGroup.add(leftEyeIris);
    head.add(leftEyeGroup);
    this.leftEye = leftEyeWhite;

    const rightEyeGroup = new THREE.Group();
    rightEyeGroup.position.set(0.045, 0.015, 0.118);
    const rightEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    const rightEyeIris = new THREE.Mesh(eyeIrisGeo, eyeMat);
    rightEyeIris.position.z = 0.021;
    rightEyeGroup.add(rightEyeWhite);
    rightEyeGroup.add(rightEyeIris);
    head.add(rightEyeGroup);
    this.rightEye = rightEyeWhite;

    const eyebrowGeo = new THREE.BoxGeometry(0.035, 0.005, 0.005);
    const leftEyebrowMesh = new THREE.Mesh(eyebrowGeo, eyebrowMat);
    leftEyebrowMesh.position.set(-0.045, 0.05, 0.125);
    head.add(leftEyebrowMesh);
    this.leftEyebrow = leftEyebrowMesh;

    const rightEyebrowMesh = new THREE.Mesh(eyebrowGeo, eyebrowMat);
    rightEyebrowMesh.position.set(0.045, 0.05, 0.125);
    head.add(rightEyebrowMesh);
    this.rightEyebrow = rightEyebrowMesh;

    const mouthGeo = new THREE.BoxGeometry(0.028, 0.006, 0.005);
    const mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
    mouthMesh.position.set(0, -0.052, 0.122);
    head.add(mouthMesh);
    this.mouthMesh = mouthMesh;

    const torsoGeo = new THREE.CylinderGeometry(0.11, 0.09, 0.32, 16);
    const torsoMesh = new THREE.Mesh(torsoGeo, outfitMat);
    chest.add(torsoMesh);

    const coreGeo = new THREE.OctahedronGeometry(0.032, 0);
    const crystalCore = new THREE.Mesh(coreGeo, crystalMat);
    crystalCore.position.set(0, 0.04, 0.10);
    chest.add(crystalCore);
    this.crystalCore = crystalCore;

    const armGeo = new THREE.CylinderGeometry(0.03, 0.025, 0.52, 12);
    armGeo.translate(0, -0.26, 0);

    const leftArm = new THREE.Mesh(armGeo, outfitMat);
    leftArm.position.set(-0.16, 0.08, 0);
    leftArm.rotation.z = 0.18;
    chest.add(leftArm);
    this.proceduralLeftArm = leftArm;
    this.leftArmRest.copy(leftArm.rotation);

    const rightArm = new THREE.Mesh(armGeo, outfitMat);
    rightArm.position.set(0.16, 0.08, 0);
    rightArm.rotation.z = -0.18;
    chest.add(rightArm);
    this.proceduralRightArm = rightArm;
    this.rightArmRest.copy(rightArm.rotation);

    const legGeo = new THREE.CylinderGeometry(0.045, 0.035, 0.88, 12);
    legGeo.translate(0, -0.44, 0);

    const leftLeg = new THREE.Mesh(legGeo, outfitMat);
    leftLeg.position.set(-0.075, 0, 0);
    hips.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, outfitMat);
    rightLeg.position.set(0.075, 0, 0);
    hips.add(rightLeg);
  }

  // High-Level Public Control APIs
  public setEmotion(emotion: CompanionEmotion, intensity = 0.7): void {
    this.currentEmotion = emotion;
    this.performanceDirector.setEmotion(emotion, intensity);
  }

  public setState(state: CompanionState): void {
    if (state === this.currentState) return;
    this.currentState = state;
    this.animationOrchestrator.setConversationState(state);
    this.performanceDirector.setState(state);
  }

  public onSpeechStart(text: string): void {
    this.performanceDirector.onSpeechStart(text);
  }

  public onSpeechEnd(): void {
    this.performanceDirector.onSpeechEnd();
  }

  public triggerAction(type: FullBodyActionType, force = true): boolean {
    return this.performanceDirector.triggerAction(type, force);
  }

  public triggerFacialStyle(style: AnimeExpressionStyle, duration = 3.5): void {
    this.performanceDirector.triggerFacialStyle(style, duration);
  }

  public navigateTo(target: THREE.Vector3, faceYaw?: number): void {
    this.performanceDirector.navigateTo(target, faceYaw);
  }

  public setAutonomousNavigation(enabled: boolean): void {
    this.performanceDirector.setAutonomousNavigation(enabled);
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

  public setViseme(mouthOpen: number): void {
    this.targetViseme = Math.max(0, Math.min(1, mouthOpen));
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

  public notifyAnimationEvent(event: AnimationEvent): void {
    this.animationOrchestrator.notify(event);
  }

  public setFurnitureColliders(colliders: THREE.Box3[]): void {
    this.performanceDirector.locomotion.setColliders(colliders);
  }

  /**
   * Main Performance Frame Update Loop
   */
  public update(delta: number, elapsedTime: number, targetLookPos?: THREE.Vector3): void {
    const frameDelta = Math.min(Math.max(delta, 0), 0.05);
    const motion = this.motionEnabled ? 1 : 0;

    // 1. Semantic Orchestrator
    this.animationFrame = this.animationOrchestrator.update(frameDelta, elapsedTime);

    // 2. Viseme Smoothing
    this.displayedViseme = THREE.MathUtils.damp(this.displayedViseme, this.targetViseme, 18, frameDelta);
    if (this.targetViseme === 0 && this.displayedViseme < 0.005) this.displayedViseme = 0;

    // 3. Central Character Performance Director Frame
    const cameraTarget = targetLookPos || new THREE.Vector3(0, 1.45, 3.4);
    const frame = this.performanceDirector.update(
      frameDelta,
      elapsedTime,
      cameraTarget,
      this.root.position,
      this.displayedViseme
    );

    // 4. VRM Character Kinematics & Full-Body Performance
    if (this.isVrm && this.vrmInstance) {
      // Expression Manager (VRM 1.0 Presets) - Set before update so expressions evaluate in current frame
      const manager = this.vrmInstance.expressionManager;
      if (manager) {
        for (const [key, val] of Object.entries(frame.facial.vrmPresets)) {
          manager.setValue(key, val * motion);
        }
      }

      // Look-At Target - Synchronously evaluated BEFORE update so eye bones update in the exact same frame.
      // During blinks/eye closures, smoothly center gaze to neutral forward eye-level to prevent iris/cornea clipping.
      if (this.vrmInstance.lookAt && this.motionEnabled) {
        const blinkAmount = frame.facial.vrmPresets.blink || 0;
        if (blinkAmount > 0.05) {
          const neutralEyeLevel = new THREE.Vector3(
            this.root.position.x,
            this.root.position.y + 1.45,
            this.root.position.z + 3.2
          );
          const centeredGazeTarget = frame.lookAtTarget.clone().lerp(neutralEyeLevel, Math.min(1.0, blinkAmount * 1.2));
          this.vrmInstance.lookAt.lookAt(centeredGazeTarget);
        } else {
          this.vrmInstance.lookAt.lookAt(frame.lookAtTarget);
        }
      }

      if (this.motionEnabled) {
        this.vrmInstance.update(frameDelta);
      } else {
        this.vrmInstance.expressionManager?.update();
      }

      // Root World Placement - Anchored squarely at (0, 0, 0) on open floor
      this.root.position.set(0, 0, 0);
      this.root.rotation.y = 0;

      // Direct Morph Targets on Face Meshes (applied across all face primitives/submeshes)
      if (this.vrmFaceMeshes.length > 0) {
        for (const faceMesh of this.vrmFaceMeshes) {
          if (!faceMesh.morphTargetDictionary || !faceMesh.morphTargetInfluences) continue;
          const dict = faceMesh.morphTargetDictionary;
          const influences = faceMesh.morphTargetInfluences;
          for (const [morphName, weight] of Object.entries(frame.facial.directMorphs)) {
            // While speaking, speech viseme presets exclusively own mouth and jaw apertures
            if (this.displayedViseme > 0.02 && morphName.startsWith('Fcl_MTH_')) {
              continue;
            }
            const idx = dict[morphName];
            if (typeof idx === 'number') {
              influences[idx] = weight * motion;
            }
          }
        }
      }

      // Dark ICE has no authored animation clips, so apply the safe procedural
      // performance layer to the real VRM bones. Every target is derived from
      // its stored authored rest pose; no cumulative transforms or root motion
      // are introduced, and facial/lip controls remain separate from the body.
      if (this.isVrm) {
      // Hips (Contrapposto weight shift & living body sway)
      if (this.vrmHipsBone) {
        const targetHipsZ = this.vrmHipsRest.z +
          (frame.posture.hipTiltZ + frame.posture.bodySway.z) * motion;
        const targetHipsY = this.vrmHipsRest.y +
          frame.posture.hipYawY * motion;

        this.vrmHipsBone.rotation.z = THREE.MathUtils.damp(this.vrmHipsBone.rotation.z, targetHipsZ, 3.2, frameDelta);
        this.vrmHipsBone.rotation.y = THREE.MathUtils.damp(this.vrmHipsBone.rotation.y, targetHipsY, 3.0, frameDelta);
        this.vrmHipsBone.position.x = this.vrmHipsRestPosition.x + frame.posture.bodySway.x * motion;
        // Strictly preserve exact natural vertical hip height - zero sinking into the floor!
        this.vrmHipsBone.position.y = this.vrmHipsRestPosition.y;
        this.vrmHipsBone.position.z = this.vrmHipsRestPosition.z;
      }

      // Spine (Breathing + Contrapposto S-Curve + Action Lean)
      const actionOffsets = frame.action.offsets;
      const actionWeight = frame.action.weight;

      if (this.vrmSpineBone) {
        const targetSpineX = this.vrmSpineRest.x +
          (frame.respiration.spineExpansion + frame.posture.spineCurve.x + this.animationFrame.torso.lean + actionOffsets.torso.x * actionWeight) * motion;
        const targetSpineZ = this.vrmSpineRest.z +
          (frame.posture.spineCurve.z + this.animationFrame.torso.lean * 0.4 + actionOffsets.torso.z * actionWeight) * motion;

        this.vrmSpineBone.rotation.x = THREE.MathUtils.damp(this.vrmSpineBone.rotation.x, targetSpineX, 3.5, frameDelta);
        this.vrmSpineBone.rotation.z = THREE.MathUtils.damp(this.vrmSpineBone.rotation.z, targetSpineZ, 3.0, frameDelta);
      }

      // Chest & Upper Chest
      if (this.vrmChestBone) {
        const targetChestX = this.vrmChestRest.x +
          (frame.respiration.chestExpansion + frame.posture.chestOrientation.x) * motion;
        const targetChestZ = this.vrmChestRest.z +
          frame.posture.chestOrientation.z * motion;

        this.vrmChestBone.rotation.x = THREE.MathUtils.damp(this.vrmChestBone.rotation.x, targetChestX, 4.0, frameDelta);
        this.vrmChestBone.rotation.z = THREE.MathUtils.damp(this.vrmChestBone.rotation.z, targetChestZ, 3.5, frameDelta);
      }
      if (this.vrmUpperChestBone) {
        const targetUpperChestX = this.vrmUpperChestRest.x +
          frame.respiration.chestExpansion * 0.7 * motion;
        this.vrmUpperChestBone.rotation.x = THREE.MathUtils.damp(this.vrmUpperChestBone.rotation.x, targetUpperChestX, 4.0, frameDelta);
      }

      // Clavicles / shoulders remain in their authored neutral pose so parent
      // motion cannot reintroduce unexplained hand lifting.
      if (this.vrmLeftShoulderBone) {
        this.vrmLeftShoulderBone.rotation.copy(this.vrmLeftShoulderRest);
      }
      if (this.vrmRightShoulderBone) {
        this.vrmRightShoulderBone.rotation.copy(this.vrmRightShoulderRest);
      }

      // Head & Neck (Nods + tilts + action rotation)
      if (this.vrmHeadBone) {
        const targetHeadX = this.vrmHeadRest.x +
          (frame.head.rotation.x + this.animationFrame.head.x + actionOffsets.head.x * actionWeight) * motion;
        const targetHeadY = this.vrmHeadRest.y +
          (frame.head.rotation.y + this.animationFrame.head.y + actionOffsets.head.y * actionWeight) * motion;
        const targetHeadZ = this.vrmHeadRest.z +
          (frame.head.rotation.z + this.animationFrame.head.z + actionOffsets.head.z * actionWeight) * motion;

        this.vrmHeadBone.rotation.x = THREE.MathUtils.damp(this.vrmHeadBone.rotation.x, targetHeadX, 4.5, frameDelta);
        this.vrmHeadBone.rotation.y = THREE.MathUtils.damp(this.vrmHeadBone.rotation.y, targetHeadY, 4.0, frameDelta);
        this.vrmHeadBone.rotation.z = THREE.MathUtils.damp(this.vrmHeadBone.rotation.z, targetHeadZ, 3.8, frameDelta);
      }

      if (this.vrmNeckBone) {
        const targetNeckX = this.vrmNeckRest.x +
          (frame.head.rotation.x * 0.35 + frame.respiration.neckTension + actionOffsets.head.x * 0.25 * actionWeight) * motion;
        const targetNeckY = this.vrmNeckRest.y +
          (frame.head.rotation.y * 0.35 + actionOffsets.head.y * 0.25 * actionWeight) * motion;
        const targetNeckZ = this.vrmNeckRest.z +
          (frame.head.rotation.z * 0.35 + actionOffsets.head.z * 0.25 * actionWeight) * motion;

        this.vrmNeckBone.rotation.x = THREE.MathUtils.damp(this.vrmNeckBone.rotation.x, targetNeckX, 4.5, frameDelta);
        this.vrmNeckBone.rotation.y = THREE.MathUtils.damp(this.vrmNeckBone.rotation.y, targetNeckY, 4.0, frameDelta);
        this.vrmNeckBone.rotation.z = THREE.MathUtils.damp(this.vrmNeckBone.rotation.z, targetNeckZ, 3.8, frameDelta);
      }

      // Arms, wrists, hands, and fingers are intentionally authoritative at
      // the authored neutral pose. This removes every speech/action/locomotion
      // hand animation path while preserving head, face, torso, breathing,
      // and lower-body animation.
      if (this.vrmRightUpperArm) {
        this.vrmRightUpperArm.rotation.copy(this.rightArmRest);
      }
      if (this.vrmRightLowerArm) {
        this.vrmRightLowerArm.rotation.copy(this.rightLowerArmRest);
      }
      if (this.vrmRightHand) {
        this.vrmRightHand.rotation.copy(this.rightHandRest);
      }

      // Left arm
      if (this.vrmLeftUpperArm) {
        this.vrmLeftUpperArm.rotation.copy(this.leftArmRest);
      }
      if (this.vrmLeftLowerArm) {
        this.vrmLeftLowerArm.rotation.copy(this.leftLowerArmRest);
      }
      if (this.vrmLeftHand) {
        // Zero animated hand movement per Task 1: preserve neutral authored rest pose
        this.vrmLeftHand.rotation.copy(this.leftHandRest);
      }

      // 30 Finger Bones: Kept visually attached and anchored at the model's neutral authored rest pose
      // with zero procedural finger animation, gestures, or articulation routines
      for (const joint of FINGER_BONE_NAMES) {
        const lBone = this.vrmLeftFingers[joint];
        if (lBone) {
          const rest = this.vrmLeftFingerRest[joint] || new THREE.Euler();
          lBone.rotation.copy(rest);
        }

        const rBone = this.vrmRightFingers[joint];
        if (rBone) {
          const rest = this.vrmRightFingerRest[joint] || new THREE.Euler();
          rBone.rotation.copy(rest);
        }
      }

      // Lower Body / Legs (Locomotion Kinematics)
      const lLeg = frame.locomotion.leftLeg;
      const rLeg = frame.locomotion.rightLeg;

      if (this.vrmLeftUpperLeg) {
        this.vrmLeftUpperLeg.rotation.x = THREE.MathUtils.damp(
          this.vrmLeftUpperLeg.rotation.x,
          this.leftUpperLegRest.x + lLeg.upperLeg.x * motion,
          7.0,
          frameDelta
        );
      }
      if (this.vrmLeftLowerLeg) {
        this.vrmLeftLowerLeg.rotation.x = THREE.MathUtils.damp(
          this.vrmLeftLowerLeg.rotation.x,
          this.leftLowerLegRest.x + lLeg.lowerLeg.x * motion,
          7.0,
          frameDelta
        );
      }
      if (this.vrmLeftFoot) {
        this.vrmLeftFoot.rotation.x = THREE.MathUtils.damp(
          this.vrmLeftFoot.rotation.x,
          this.leftFootRest.x + lLeg.foot.x * motion,
          7.0,
          frameDelta
        );
      }
      if (this.vrmLeftToes) {
        this.vrmLeftToes.rotation.x = lLeg.toes.x * motion;
      }

      if (this.vrmRightUpperLeg) {
        this.vrmRightUpperLeg.rotation.x = THREE.MathUtils.damp(
          this.vrmRightUpperLeg.rotation.x,
          this.rightUpperLegRest.x + rLeg.upperLeg.x * motion,
          7.0,
          frameDelta
        );
      }
      if (this.vrmRightLowerLeg) {
        this.vrmRightLowerLeg.rotation.x = THREE.MathUtils.damp(
          this.vrmRightLowerLeg.rotation.x,
          this.rightLowerLegRest.x + rLeg.lowerLeg.x * motion,
          7.0,
          frameDelta
        );
      }
      if (this.vrmRightFoot) {
        this.vrmRightFoot.rotation.x = THREE.MathUtils.damp(
          this.vrmRightFoot.rotation.x,
          this.rightFootRest.x + rLeg.foot.x * motion,
          7.0,
          frameDelta
        );
      }
      if (this.vrmRightToes) {
        this.vrmRightToes.rotation.x = rLeg.toes.x * motion;
      }
      }
    }

    // 5. Procedural Humanoid Rig Animation Fallback
    // The fallback mouth mesh has no authored facial rig. Scaling it during
    // speech changes its local silhouette and can make the lips appear to
    // leave their anchor. Keep it static; the real VRM path owns lip sync via
    // anchored expression Blend Shapes above.
    if (this.mouthMesh) {
      this.mouthMesh.scale.set(1, 1, 1);
    }
    if (this.chestBone) {
      this.chestBone.position.y = 0.22 + (frame.respiration.chestExpansion * 2.5 + this.animationFrame.torso.shoulderLift * 0.12) * motion;
      this.chestBone.rotation.x = (frame.respiration.chestExpansion + frame.posture.chestOrientation.x + this.animationFrame.torso.lean) * motion;
      this.chestBone.rotation.z = (frame.posture.chestOrientation.z) * motion;
    }
    if (this.headBone) {
      this.headBone.rotation.x = THREE.MathUtils.damp(
        this.headBone.rotation.x,
        (frame.head.rotation.x + this.animationFrame.head.x + frame.action.offsets.head.x) * motion,
        4.5,
        frameDelta
      );
      this.headBone.rotation.y = THREE.MathUtils.damp(
        this.headBone.rotation.y,
        (frame.head.rotation.y + this.animationFrame.head.y + frame.action.offsets.head.y) * motion,
        4.0,
        frameDelta
      );
      this.headBone.rotation.z = THREE.MathUtils.damp(
        this.headBone.rotation.z,
        (frame.head.rotation.z + this.animationFrame.head.z + frame.action.offsets.head.z) * motion,
        3.8,
        frameDelta
      );
    }
    if (this.leftEyebrow && this.rightEyebrow) {
      this.leftEyebrow.rotation.z = THREE.MathUtils.damp(this.leftEyebrow.rotation.z, this.targetLeftBrowRotation + frame.micro.browTwitch, 7, frameDelta);
      this.rightEyebrow.rotation.z = THREE.MathUtils.damp(this.rightEyebrow.rotation.z, this.targetRightBrowRotation - frame.micro.browTwitch, 7, frameDelta);
      this.leftEyebrow.position.y = THREE.MathUtils.damp(this.leftEyebrow.position.y, this.targetLeftBrowHeight, 7, frameDelta);
      this.rightEyebrow.position.y = THREE.MathUtils.damp(this.rightEyebrow.position.y, this.targetRightBrowHeight, 7, frameDelta);
    }
    if (this.leftEye && this.rightEye) {
      const proceduralBlinkScale = motion ? Math.max(0.08, 1 - frame.eye.leftBlink) : 1;
      this.leftEye.scale.y = proceduralBlinkScale;
      this.rightEye.scale.y = proceduralBlinkScale;
    }
    if (!this.isVrm) {
      if (this.proceduralRightArm) {
        this.proceduralRightArm.rotation.copy(this.rightArmRest);
      }
      if (this.proceduralLeftArm) {
        this.proceduralLeftArm.rotation.copy(this.leftArmRest);
      }
    }

    if (this.crystalCore) {
      this.crystalCore.rotation.y += frameDelta * 1.2 * motion;
      const pulseScale = 1 + (frame.respiration.lungVolume * 0.05) * motion;
      this.crystalCore.scale.setScalar(pulseScale);
    }
  }

  public dispose(): void {
    dispose3DResource(this.root);
  }
}
