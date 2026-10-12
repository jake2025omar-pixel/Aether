import * as THREE from 'three';

export type HandPosePreset =
  | 'RELAXED'
  | 'POINTING'
  | 'OPEN_PALM'
  | 'PALMS_UP_QUESTION'
  | 'GENTLE_WAVE'
  | 'CHIN_TOUCH'
  | 'MOUTH_COVER'
  | 'CHEST_HEART'
  | 'HIP_REST'
  | 'SHRUG_PALMS'
  | 'FIDGET_TAP'
  | 'LOOSE_CURL';

export interface FingerJointRotation {
  x: number;
  y: number;
  z: number;
}

export interface HandFingerSample {
  thumbMetacarpal: FingerJointRotation;
  thumbProximal: FingerJointRotation;
  thumbDistal: FingerJointRotation;
  indexProximal: FingerJointRotation;
  indexIntermediate: FingerJointRotation;
  indexDistal: FingerJointRotation;
  middleProximal: FingerJointRotation;
  middleIntermediate: FingerJointRotation;
  middleDistal: FingerJointRotation;
  ringProximal: FingerJointRotation;
  ringIntermediate: FingerJointRotation;
  ringDistal: FingerJointRotation;
  littleProximal: FingerJointRotation;
  littleIntermediate: FingerJointRotation;
  littleDistal: FingerJointRotation;
}

export interface DualHandFingerSample {
  left: HandFingerSample;
  right: HandFingerSample;
  leftPose: HandPosePreset;
  rightPose: HandPosePreset;
  leftBlend: number;
  rightBlend: number;
}

interface InternalHandJoints {
  [jointName: string]: THREE.Euler;
}

const JOINT_NAMES = [
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

function createEmptyJoints(): InternalHandJoints {
  const joints: InternalHandJoints = {};
  for (const name of JOINT_NAMES) {
    joints[name] = new THREE.Euler(0, 0, 0);
  }
  return joints;
}

function curlFinger(joints: InternalHandJoints, finger: 'index' | 'middle' | 'ring' | 'little', curlRad: number, splayRad = 0): void {
  joints[`${finger}Proximal`].set(0, splayRad, -curlRad);
  joints[`${finger}Intermediate`].set(0, 0, -curlRad * 1.15);
  joints[`${finger}Distal`].set(0, 0, -curlRad * 0.85);
}

function curlThumb(joints: InternalHandJoints, metacarpalY: number, proximalZ: number, distalZ: number): void {
  joints['thumbMetacarpal'].set(0, metacarpalY, 0.08);
  joints['thumbProximal'].set(0, 0.05, proximalZ);
  joints['thumbDistal'].set(0, 0, distalZ);
}

function computePresetJoints(preset: HandPosePreset, isLeft: boolean, time = 0): InternalHandJoints {
  const joints = createEmptyJoints();
  const splaySign = isLeft ? -1 : 1;

  switch (preset) {
    case 'RELAXED':
      // Preserve the authored/rest pose. Finger articulation is only applied
      // by an intentional hand pose such as pointing, waving, or thinking.
      break;

    case 'POINTING':
      // Index extended, others curled into palm, thumb resting
      curlThumb(joints, 0.22 * splaySign, 0.45, 0.40);
      curlFinger(joints, 'index', -0.02, 0.05 * splaySign);
      curlFinger(joints, 'middle', 1.15, -0.01 * splaySign);
      curlFinger(joints, 'ring', 1.20, -0.04 * splaySign);
      curlFinger(joints, 'little', 1.25, -0.08 * splaySign);
      break;

    case 'OPEN_PALM':
      // Gentle open palm with graceful splay
      curlThumb(joints, -0.15 * splaySign, 0.02, 0.02);
      curlFinger(joints, 'index', 0.04, 0.08 * splaySign);
      curlFinger(joints, 'middle', 0.06, 0.02 * splaySign);
      curlFinger(joints, 'ring', 0.08, -0.04 * splaySign);
      curlFinger(joints, 'little', 0.12, -0.10 * splaySign);
      break;

    case 'PALMS_UP_QUESTION':
      // Questioning open palm, slightly curved up
      curlThumb(joints, -0.10 * splaySign, 0.06, 0.05);
      curlFinger(joints, 'index', 0.14, 0.06 * splaySign);
      curlFinger(joints, 'middle', 0.16, 0.01 * splaySign);
      curlFinger(joints, 'ring', 0.20, -0.03 * splaySign);
      curlFinger(joints, 'little', 0.26, -0.07 * splaySign);
      break;

    case 'GENTLE_WAVE': {
      // Gentle flutter with harmonic phase offset
      const wavePhase = Math.sin(time * 6.0);
      const flutterI = wavePhase * 0.08;
      const flutterM = Math.sin(time * 6.0 - 0.4) * 0.08;
      const flutterR = Math.sin(time * 6.0 - 0.8) * 0.09;
      const flutterL = Math.sin(time * 6.0 - 1.2) * 0.11;

      curlThumb(joints, -0.08 * splaySign, 0.08, 0.06);
      curlFinger(joints, 'index', 0.10 + flutterI, 0.06 * splaySign);
      curlFinger(joints, 'middle', 0.12 + flutterM, 0.02 * splaySign);
      curlFinger(joints, 'ring', 0.16 + flutterR, -0.03 * splaySign);
      curlFinger(joints, 'little', 0.22 + flutterL, -0.08 * splaySign);
      break;
    }

    case 'CHIN_TOUCH':
      // Index extended alongside jaw, middle/ring/pinky loosely curved
      curlThumb(joints, 0.18 * splaySign, 0.28, 0.22);
      curlFinger(joints, 'index', 0.06, 0.04 * splaySign);
      curlFinger(joints, 'middle', 0.65, -0.02 * splaySign);
      curlFinger(joints, 'ring', 0.82, -0.05 * splaySign);
      curlFinger(joints, 'little', 0.95, -0.09 * splaySign);
      break;

    case 'MOUTH_COVER':
      // Graceful curve over mouth (giggle / bashful)
      curlThumb(joints, 0.10 * splaySign, 0.18, 0.14);
      curlFinger(joints, 'index', 0.26, 0.03 * splaySign);
      curlFinger(joints, 'middle', 0.32, 0.01 * splaySign);
      curlFinger(joints, 'ring', 0.38, -0.02 * splaySign);
      curlFinger(joints, 'little', 0.44, -0.05 * splaySign);
      break;

    case 'CHEST_HEART':
      // Soft hand resting on chest/heart
      curlThumb(joints, 0.08 * splaySign, 0.14, 0.10);
      curlFinger(joints, 'index', 0.22, 0.04 * splaySign);
      curlFinger(joints, 'middle', 0.26, 0.01 * splaySign);
      curlFinger(joints, 'ring', 0.32, -0.03 * splaySign);
      curlFinger(joints, 'little', 0.38, -0.06 * splaySign);
      break;

    case 'HIP_REST':
      // Thumb back, fingers forward over hip
      curlThumb(joints, -0.25 * splaySign, 0.15, 0.12);
      curlFinger(joints, 'index', 0.42, 0.06 * splaySign);
      curlFinger(joints, 'middle', 0.50, 0.02 * splaySign);
      curlFinger(joints, 'ring', 0.56, -0.03 * splaySign);
      curlFinger(joints, 'little', 0.64, -0.08 * splaySign);
      break;

    case 'SHRUG_PALMS':
      // Splayed open palms
      curlThumb(joints, -0.22 * splaySign, 0.04, 0.02);
      curlFinger(joints, 'index', 0.06, 0.10 * splaySign);
      curlFinger(joints, 'middle', 0.08, 0.03 * splaySign);
      curlFinger(joints, 'ring', 0.12, -0.05 * splaySign);
      curlFinger(joints, 'little', 0.16, -0.12 * splaySign);
      break;

    case 'FIDGET_TAP': {
      // Subtle nervous or thoughtful tap
      const tap = (Math.sin(time * 4.5) + 1) * 0.5;
      curlThumb(joints, 0.16 * splaySign, 0.20 + tap * 0.15, 0.15);
      curlFinger(joints, 'index', 0.24 + tap * 0.18, 0.04 * splaySign);
      curlFinger(joints, 'middle', 0.36 + (1 - tap) * 0.14, 0.01 * splaySign);
      curlFinger(joints, 'ring', 0.48, -0.02 * splaySign);
      curlFinger(joints, 'little', 0.56, -0.05 * splaySign);
      break;
    }

    case 'LOOSE_CURL':
    default:
      curlThumb(joints, 0.20 * splaySign, 0.35, 0.28);
      curlFinger(joints, 'index', 0.62, 0.03 * splaySign);
      curlFinger(joints, 'middle', 0.74, 0.01 * splaySign);
      curlFinger(joints, 'ring', 0.84, -0.02 * splaySign);
      curlFinger(joints, 'little', 0.92, -0.06 * splaySign);
      break;
  }

  return joints;
}

export class FingerHandController {
  private leftCurrent = createEmptyJoints();
  private rightCurrent = createEmptyJoints();

  private leftTarget = createEmptyJoints();
  private rightTarget = createEmptyJoints();

  private leftPose: HandPosePreset = 'RELAXED';
  private rightPose: HandPosePreset = 'RELAXED';

  private leftBlendSpeed = 7.0;
  private rightBlendSpeed = 7.0;

  constructor() {
    this.leftCurrent = computePresetJoints('RELAXED', true, 0);
    this.rightCurrent = computePresetJoints('RELAXED', false, 0);
    this.leftTarget = computePresetJoints('RELAXED', true, 0);
    this.rightTarget = computePresetJoints('RELAXED', false, 0);
  }

  public setLeftPose(pose: HandPosePreset, speed = 7.0): void {
    this.leftPose = pose;
    this.leftBlendSpeed = speed;
  }

  public setRightPose(pose: HandPosePreset, speed = 7.0): void {
    this.rightPose = pose;
    this.rightBlendSpeed = speed;
  }

  public setDualPose(pose: HandPosePreset, speed = 7.0): void {
    this.setLeftPose(pose, speed);
    this.setRightPose(pose, speed);
  }

  public update(dt: number, time: number): DualHandFingerSample {
    const frameDelta = Math.min(Math.max(dt, 0), 0.05);

    // Compute target joints for each hand
    this.leftTarget = computePresetJoints(this.leftPose, true, time);
    this.rightTarget = computePresetJoints(this.rightPose, false, time);

    // Smoothly damp each joint to target
    for (const name of JOINT_NAMES) {
      const lCur = this.leftCurrent[name];
      const lTgt = this.leftTarget[name];
      lCur.x = THREE.MathUtils.damp(lCur.x, lTgt.x, this.leftBlendSpeed, frameDelta);
      lCur.y = THREE.MathUtils.damp(lCur.y, lTgt.y, this.leftBlendSpeed, frameDelta);
      lCur.z = THREE.MathUtils.damp(lCur.z, lTgt.z, this.leftBlendSpeed, frameDelta);

      const rCur = this.rightCurrent[name];
      const rTgt = this.rightTarget[name];
      rCur.x = THREE.MathUtils.damp(rCur.x, rTgt.x, this.rightBlendSpeed, frameDelta);
      rCur.y = THREE.MathUtils.damp(rCur.y, rTgt.y, this.rightBlendSpeed, frameDelta);
      rCur.z = THREE.MathUtils.damp(rCur.z, rTgt.z, this.rightBlendSpeed, frameDelta);
    }

    const toSample = (joints: InternalHandJoints): HandFingerSample => ({
      thumbMetacarpal: { x: joints.thumbMetacarpal.x, y: joints.thumbMetacarpal.y, z: joints.thumbMetacarpal.z },
      thumbProximal: { x: joints.thumbProximal.x, y: joints.thumbProximal.y, z: joints.thumbProximal.z },
      thumbDistal: { x: joints.thumbDistal.x, y: joints.thumbDistal.y, z: joints.thumbDistal.z },
      indexProximal: { x: joints.indexProximal.x, y: joints.indexProximal.y, z: joints.indexProximal.z },
      indexIntermediate: { x: joints.indexIntermediate.x, y: joints.indexIntermediate.y, z: joints.indexIntermediate.z },
      indexDistal: { x: joints.indexDistal.x, y: joints.indexDistal.y, z: joints.indexDistal.z },
      middleProximal: { x: joints.middleProximal.x, y: joints.middleProximal.y, z: joints.middleProximal.z },
      middleIntermediate: { x: joints.middleIntermediate.x, y: joints.middleIntermediate.y, z: joints.middleIntermediate.z },
      middleDistal: { x: joints.middleDistal.x, y: joints.middleDistal.y, z: joints.middleDistal.z },
      ringProximal: { x: joints.ringProximal.x, y: joints.ringProximal.y, z: joints.ringProximal.z },
      ringIntermediate: { x: joints.ringIntermediate.x, y: joints.ringIntermediate.y, z: joints.ringIntermediate.z },
      ringDistal: { x: joints.ringDistal.x, y: joints.ringDistal.y, z: joints.ringDistal.z },
      littleProximal: { x: joints.littleProximal.x, y: joints.littleProximal.y, z: joints.littleProximal.z },
      littleIntermediate: { x: joints.littleIntermediate.x, y: joints.littleIntermediate.y, z: joints.littleIntermediate.z },
      littleDistal: { x: joints.littleDistal.x, y: joints.littleDistal.y, z: joints.littleDistal.z },
    });

    return {
      left: toSample(this.leftCurrent),
      right: toSample(this.rightCurrent),
      leftPose: this.leftPose,
      rightPose: this.rightPose,
      leftBlend: 1.0,
      rightBlend: 1.0,
    };
  }
}
