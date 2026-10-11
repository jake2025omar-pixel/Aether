import * as THREE from 'three';

export type LocomotionState =
  | 'IDLE_STATIONARY'
  | 'TURNING_TO_TARGET'
  | 'WALKING'
  | 'DECELERATING'
  | 'SETTLING';

export interface LegBoneRotations {
  upperLeg: THREE.Vector3;
  lowerLeg: THREE.Vector3;
  foot: THREE.Vector3;
  toes: THREE.Vector3;
}

export interface LocomotionSample {
  state: LocomotionState;
  worldPosition: THREE.Vector3;
  bodyYaw: number;
  isMoving: boolean;
  velocity: number;
  stridePhase: number;
  hipsOffset: THREE.Vector3;
  hipsRotation: THREE.Vector3;
  leftLeg: LegBoneRotations;
  rightLeg: LegBoneRotations;
  armSwingOffset: {
    leftUpperArmZ: number;
    leftUpperArmX: number;
    rightUpperArmZ: number;
    rightUpperArmX: number;
  };
}

export interface NavigationWaypoint {
  id: string;
  name: string;
  position: THREE.Vector3;
  faceDirection?: number; // radians
  dwellTimeSeconds: number;
}

// Walkable bounds strictly clamped to the open center carpet (zero furniture collision)
const ROOM_BOUNDS = {
  minX: -0.4,
  maxX: 0.4,
  minZ: -0.3,
  maxZ: 0.3,
};

export class LocomotionController {
  private state: LocomotionState = 'IDLE_STATIONARY';

  // World transform
  private currentPosition = new THREE.Vector3(0, 0, 0);
  private targetPosition = new THREE.Vector3(0, 0, 0);
  private currentYaw = 0;
  private targetYaw = 0;

  // Locomotion dynamics
  private velocity = 0;
  private targetVelocity = 0;
  private readonly maxSpeed = 0.55; // m/s
  private readonly walkFrequency = 3.6; // rad/s
  private stridePhase = 0;

  // Stride smoothing
  private leftUpperLeg = new THREE.Vector3();
  private leftLowerLeg = new THREE.Vector3();
  private leftFoot = new THREE.Vector3();
  private leftToes = new THREE.Vector3();

  private rightUpperLeg = new THREE.Vector3();
  private rightLowerLeg = new THREE.Vector3();
  private rightFoot = new THREE.Vector3();
  private rightToes = new THREE.Vector3();

  private hipsOffset = new THREE.Vector3();
  private hipsRotation = new THREE.Vector3();

  // Active furniture collision barriers
  private colliders: THREE.Box3[] = [];

  // Navigation schedule - Disabled by default to stay squarely centered without room clutter collision
  private autonomousNavigationEnabled = false;
  private idleDwellTimer = 0;
  private nextPatrolDelay = 28.0; // Seconds between natural room patrols
  private currentWaypointIndex = 0;

  private readonly waypoints: NavigationWaypoint[] = [
    { id: 'center', name: 'Center Stage', position: new THREE.Vector3(0, 0, 0), faceDirection: 0, dwellTimeSeconds: 35 },
    { id: 'right_lounge', name: 'Right Lounge', position: new THREE.Vector3(0.55, 0, -0.30), faceDirection: -0.25, dwellTimeSeconds: 22 },
    { id: 'left_terrace', name: 'Left Terrace', position: new THREE.Vector3(-0.55, 0, -0.25), faceDirection: 0.25, dwellTimeSeconds: 24 },
    { id: 'deep_room', name: 'Deep Suite', position: new THREE.Vector3(0.15, 0, -0.65), faceDirection: 0, dwellTimeSeconds: 20 },
    { id: 'close_intimate', name: 'Close Connection', position: new THREE.Vector3(0, 0, 0.28), faceDirection: 0, dwellTimeSeconds: 30 },
  ];

  constructor(initialPosition = new THREE.Vector3(0, 0, 0)) {
    this.currentPosition.copy(initialPosition);
    this.targetPosition.copy(initialPosition);
  }

  public setAutonomousNavigation(enabled: boolean): void {
    this.autonomousNavigationEnabled = enabled;
    if (!enabled && this.state !== 'IDLE_STATIONARY') {
      this.stop();
    }
  }

  public setColliders(colliders: THREE.Box3[]): void {
    this.colliders = colliders;
  }

  public isAutonomousNavigationEnabled(): boolean {
    return this.autonomousNavigationEnabled;
  }

  public navigateTo(target: THREE.Vector3, targetFaceYaw?: number): void {
    // Clamp to room bounds
    const clampedX = THREE.MathUtils.clamp(target.x, ROOM_BOUNDS.minX, ROOM_BOUNDS.maxX);
    const clampedZ = THREE.MathUtils.clamp(target.z, ROOM_BOUNDS.minZ, ROOM_BOUNDS.maxZ);
    this.targetPosition.set(clampedX, 0, clampedZ);

    const deltaX = this.targetPosition.x - this.currentPosition.x;
    const deltaZ = this.targetPosition.z - this.currentPosition.z;
    const dist = Math.hypot(deltaX, deltaZ);

    if (dist < 0.08) {
      if (typeof targetFaceYaw === 'number') {
        this.targetYaw = targetFaceYaw;
      }
      return;
    }

    // Facing direction during travel
    this.targetYaw = Math.atan2(deltaX, deltaZ);
    this.state = 'TURNING_TO_TARGET';
  }

  public interruptAndFaceTarget(lookAtWorldPos: THREE.Vector3): void {
    // Gracefully slow down and pivot towards user
    this.targetVelocity = 0;
    const dx = lookAtWorldPos.x - this.currentPosition.x;
    const dz = lookAtWorldPos.z - this.currentPosition.z;
    if (Math.hypot(dx, dz) > 0.1) {
      this.targetYaw = Math.atan2(dx, dz);
    }
    this.state = 'DECELERATING';
  }

  public stop(): void {
    this.targetVelocity = 0;
    this.state = 'DECELERATING';
  }

  public getPosition(): THREE.Vector3 {
    return this.currentPosition.clone();
  }

  public getYaw(): number {
    return this.currentYaw;
  }

  public update(dt: number, isHighPriorityActionActive: boolean): LocomotionSample {
    const frameDelta = Math.min(Math.max(dt, 0), 0.05);

    // 1. Autonomous Waypoint Scheduler (when not locked in speaking or high-priority gestures)
    if (this.autonomousNavigationEnabled && !isHighPriorityActionActive) {
      if (this.state === 'IDLE_STATIONARY') {
        this.idleDwellTimer += frameDelta;
        if (this.idleDwellTimer >= this.nextPatrolDelay) {
          this.idleDwellTimer = 0;
          this.nextPatrolDelay = 22.0 + Math.random() * 20.0;
          this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
          const nextWp = this.waypoints[this.currentWaypointIndex];
          this.navigateTo(nextWp.position, nextWp.faceDirection);
        }
      }
    }

    // 2. State Machine Execution
    const toTarget = new THREE.Vector3().subVectors(this.targetPosition, this.currentPosition);
    toTarget.y = 0;
    const distanceToTarget = toTarget.length();

    // Yaw difference normalized to [-PI, PI]
    let yawDiff = this.targetYaw - this.currentYaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;

    switch (this.state) {
      case 'TURNING_TO_TARGET': {
        this.targetVelocity = 0;
        this.currentYaw += Math.sign(yawDiff) * Math.min(Math.abs(yawDiff), 2.8 * frameDelta);
        if (Math.abs(yawDiff) < 0.15) {
          this.state = distanceToTarget > 0.08 ? 'WALKING' : 'IDLE_STATIONARY';
        }
        break;
      }

      case 'WALKING': {
        // Turn while walking
        this.currentYaw += Math.sign(yawDiff) * Math.min(Math.abs(yawDiff), 2.2 * frameDelta);
        this.targetVelocity = this.maxSpeed;

        if (distanceToTarget < 0.12) {
          this.state = 'DECELERATING';
        }
        break;
      }

      case 'DECELERATING': {
        this.targetVelocity = 0;
        if (this.velocity < 0.04) {
          this.velocity = 0;
          this.state = 'SETTLING';
        }
        break;
      }

      case 'SETTLING': {
        this.targetVelocity = 0;
        // Turn to final resting face direction if provided
        this.currentYaw += Math.sign(yawDiff) * Math.min(Math.abs(yawDiff), 2.5 * frameDelta);
        if (Math.abs(yawDiff) < 0.04) {
          this.state = 'IDLE_STATIONARY';
        }
        break;
      }

      case 'IDLE_STATIONARY':
      default: {
        this.targetVelocity = 0;
        this.velocity = 0;
        break;
      }
    }

    // 3. Accelerate / Decelerate smoothly (no instant sliding)
    const accelRate = this.targetVelocity > this.velocity ? 2.2 : 3.8;
    this.velocity = THREE.MathUtils.damp(this.velocity, this.targetVelocity, accelRate, frameDelta);
    if (this.velocity < 0.005) this.velocity = 0;

    // 4. Displace in world space along forward vector
    if (this.velocity > 0) {
      const forwardStep = this.velocity * frameDelta;
      const proposedX = this.currentPosition.x + Math.sin(this.currentYaw) * forwardStep;
      const proposedZ = this.currentPosition.z + Math.cos(this.currentYaw) * forwardStep;

      // Test against any registered furniture colliders
      let isBlocked = false;
      if (this.colliders.length > 0) {
        const charBox = new THREE.Box3(
          new THREE.Vector3(proposedX - 0.28, 0, proposedZ - 0.28),
          new THREE.Vector3(proposedX + 0.28, 1.7, proposedZ + 0.28)
        );
        for (const col of this.colliders) {
          if (col.intersectsBox(charBox)) {
            isBlocked = true;
            break;
          }
        }
      }

      if (!isBlocked) {
        this.currentPosition.x = proposedX;
        this.currentPosition.z = proposedZ;
      } else {
        this.velocity = 0;
        this.state = 'IDLE_STATIONARY';
      }

      // Stride Phase accumulation
      this.stridePhase = (this.stridePhase + this.walkFrequency * (this.velocity / this.maxSpeed) * frameDelta) % (Math.PI * 2);
    }

    // Clamp position within safe room boundaries
    this.currentPosition.x = THREE.MathUtils.clamp(this.currentPosition.x, ROOM_BOUNDS.minX, ROOM_BOUNDS.maxX);
    this.currentPosition.z = THREE.MathUtils.clamp(this.currentPosition.z, ROOM_BOUNDS.minZ, ROOM_BOUNDS.maxZ);

    // 5. Procedural Leg Kinematics based on Stride Phase & Velocity
    const moveWeight = THREE.MathUtils.clamp(this.velocity / this.maxSpeed, 0, 1);

    if (moveWeight > 0.02) {
      const sinPhase = Math.sin(this.stridePhase);
      const cosPhase = Math.cos(this.stridePhase);

      // Left leg phase is 0; Right leg phase is PI (opposing swing)
      const leftStride = sinPhase;
      const rightStride = -sinPhase;

      // Thigh rotation (Pitch X): swinging forward and backward
      const thighAmp = 0.42 * moveWeight;
      const targetLThighX = leftStride * thighAmp;
      const targetRThighX = rightStride * thighAmp;

      // Knee flexion (Lower leg Pitch X): bends backward during recovery swing
      const kneeAmp = 0.55 * moveWeight;
      const targetLKneeX = Math.max(0, -leftStride) * kneeAmp;
      const targetRKneeX = Math.max(0, -rightStride) * kneeAmp;

      // Ankle/Foot counter-pitch: keeps foot parallel to ground & rolls during toe-off
      const targetLFootX = -targetLThighX * 0.45 + Math.max(0, leftStride) * 0.15 * moveWeight;
      const targetRFootX = -targetRThighX * 0.45 + Math.max(0, rightStride) * 0.15 * moveWeight;

      this.leftUpperLeg.set(targetLThighX, 0, 0);
      this.leftLowerLeg.set(targetLKneeX, 0, 0);
      this.leftFoot.set(targetLFootX, 0, 0);
      this.leftToes.set(Math.max(0, -leftStride) * 0.2 * moveWeight, 0, 0);

      this.rightUpperLeg.set(targetRThighX, 0, 0);
      this.rightLowerLeg.set(targetRKneeX, 0, 0);
      this.rightFoot.set(targetRFootX, 0, 0);
      this.rightToes.set(Math.max(0, -rightStride) * 0.2 * moveWeight, 0, 0);

      // Pelvis bob: sinusoidal bounce at twice the stride frequency
      const bobY = Math.abs(cosPhase) * -0.025 * moveWeight;
      // Pelvis sway: roll slightly towards the stance leg to realistically balance weight
      const swayZ = sinPhase * 0.028 * moveWeight;
      const yawY = -sinPhase * 0.035 * moveWeight;

      this.hipsOffset.set(0, bobY, 0);
      this.hipsRotation.set(0, yawY, swayZ);
    } else {
      // Smoothly relax legs to standing neutral pose
      this.leftUpperLeg.set(0, 0, 0);
      this.leftLowerLeg.set(0, 0, 0);
      this.leftFoot.set(0, 0, 0);
      this.leftToes.set(0, 0, 0);

      this.rightUpperLeg.set(0, 0, 0);
      this.rightLowerLeg.set(0, 0, 0);
      this.rightFoot.set(0, 0, 0);
      this.rightToes.set(0, 0, 0);

      this.hipsOffset.set(0, 0, 0);
      this.hipsRotation.set(0, 0, 0);
    }

    // Arm swing counter-balance (opposite phase to thighs)
    const armSwingPhase = Math.sin(this.stridePhase);
    const armSwingAmp = 0.32 * moveWeight;
    const armSwingOffset = {
      leftUpperArmZ: 0,
      leftUpperArmX: -armSwingPhase * armSwingAmp,
      rightUpperArmZ: 0,
      rightUpperArmX: armSwingPhase * armSwingAmp,
    };

    return {
      state: this.state,
      worldPosition: this.currentPosition.clone(),
      bodyYaw: this.currentYaw,
      isMoving: this.velocity > 0.04,
      velocity: this.velocity,
      stridePhase: this.stridePhase,
      hipsOffset: this.hipsOffset.clone(),
      hipsRotation: this.hipsRotation.clone(),
      leftLeg: {
        upperLeg: this.leftUpperLeg.clone(),
        lowerLeg: this.leftLowerLeg.clone(),
        foot: this.leftFoot.clone(),
        toes: this.leftToes.clone(),
      },
      rightLeg: {
        upperLeg: this.rightUpperLeg.clone(),
        lowerLeg: this.rightLowerLeg.clone(),
        foot: this.rightFoot.clone(),
        toes: this.rightToes.clone(),
      },
      armSwingOffset,
    };
  }
}
