import * as THREE from 'three';

export type NavigationPointKind = 'FLOOR' | 'BED_APPROACH' | 'BED_LIE' | 'SOFA_APPROACH' | 'SOFA_SIT';

export interface RoomNavigationPoint {
  id: string;
  kind: NavigationPointKind;
  position: THREE.Vector3;
  faceDirection?: number;
  interactionTarget?: THREE.Vector3;
}

export interface NavigationSurfaceSpec {
  id: string;
  kind: 'BED_LIE' | 'SOFA_SIT';
  bounds: THREE.Box3;
  surfaceY: number;
  facing: THREE.Vector3;
}

export interface RoomNavigationGraph {
  points: RoomNavigationPoint[];
  walkableFloorPoints: RoomNavigationPoint[];
  interactionPoints: RoomNavigationPoint[];
}

function isWalkable(
  point: THREE.Vector3,
  bounds: THREE.Box3,
  obstacles: THREE.Box3[],
  radius: number,
): boolean {
  if (
    point.x < bounds.min.x + radius || point.x > bounds.max.x - radius
    || point.z < bounds.min.z + radius || point.z > bounds.max.z - radius
  ) return false;

  const footprint = new THREE.Box3(
    new THREE.Vector3(point.x - radius, 0, point.z - radius),
    new THREE.Vector3(point.x + radius, 1.82, point.z + radius),
  );
  return !obstacles.some((obstacle) => obstacle.intersectsBox(footprint));
}

function deterministicJitter(index: number): number {
  const value = Math.sin(index * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function makeSurfacePoints(surface: NavigationSurfaceSpec): RoomNavigationPoint[] {
  const center = surface.bounds.getCenter(new THREE.Vector3());
  const size = surface.bounds.getSize(new THREE.Vector3());
  const facing = surface.facing.clone().setY(0).normalize();
  const faceYaw = Math.atan2(facing.x, facing.z);
  const points: RoomNavigationPoint[] = [];

  if (surface.kind === 'BED_LIE') {
    // Two natural lying positions preserve the source bed content while allowing
    // the character to occupy either side without clipping the headboard.
    for (const side of [-0.32, 0.32]) {
      const position = center.clone();
      position.x += side * Math.min(size.x, 1.8);
      position.y = surface.surfaceY + 0.035;
      points.push({
        id: `${surface.id}-lie-${side < 0 ? 'left' : 'right'}`,
        kind: 'BED_LIE',
        position,
        faceDirection: faceYaw,
        interactionTarget: center.clone().setY(0),
      });
    }
  } else {
    const seat = center.clone();
    seat.y = surface.surfaceY + 0.02;
    points.push({
      id: `${surface.id}-sit-center`,
      kind: 'SOFA_SIT',
      position: seat,
      faceDirection: faceYaw,
      interactionTarget: center.clone().setY(0),
    });
    const left = seat.clone();
    left.x -= Math.min(size.x * 0.22, 0.45);
    points.push({ ...points[0], id: `${surface.id}-sit-left`, position: left });
    const right = seat.clone();
    right.x += Math.min(size.x * 0.22, 0.45);
    points.push({ ...points[0], id: `${surface.id}-sit-right`, position: right });
  }

  return points;
}

/**
 * Creates a deterministic dense room graph. The graph is intentionally data-only:
 * it is cheap to rebuild after the authored room finishes loading and is also
 * straightforward to inspect in tests. The floor grid targets at least 1,000
 * valid points whenever the authored room has sufficient walkable area.
 */
export function buildRoomNavigationGraph(
  bounds: THREE.Box3,
  obstacles: THREE.Box3[],
  surfaces: NavigationSurfaceSpec[] = [],
  options: { spacing?: number; radius?: number; minimumFloorPoints?: number } = {},
): RoomNavigationGraph {
  const spacing = options.spacing ?? 0.18;
  const radius = options.radius ?? 0.28;
  const minimumFloorPoints = options.minimumFloorPoints ?? 1000;
  const floorPoints: RoomNavigationPoint[] = [];
  let index = 0;

  for (let x = bounds.min.x + radius; x <= bounds.max.x - radius; x += spacing) {
    for (let z = bounds.min.z + radius; z <= bounds.max.z - radius; z += spacing) {
      const point = new THREE.Vector3(x, 0, z);
      if (!isWalkable(point, bounds, obstacles, radius)) continue;
      const jitter = (deterministicJitter(index) - 0.5) * spacing * 0.18;
      const candidate = new THREE.Vector3(x + jitter, 0, z - jitter);
      if (!isWalkable(candidate, bounds, obstacles, radius)) continue;
      floorPoints.push({ id: `floor-${floorPoints.length.toString().padStart(4, '0')}`, kind: 'FLOOR', position: candidate });
      index += 1;
    }
  }

  // If furniture occupies a large fraction of the room, fill remaining safe
  // samples deterministically instead of inventing points inside colliders.
  let attempts = 0;
  while (floorPoints.length < minimumFloorPoints && attempts < minimumFloorPoints * 160) {
    const u = deterministicJitter(index + attempts * 3 + 11);
    const v = deterministicJitter(index + attempts * 3 + 29);
    const candidate = new THREE.Vector3(
      THREE.MathUtils.lerp(bounds.min.x + radius, bounds.max.x - radius, u),
      0,
      THREE.MathUtils.lerp(bounds.min.z + radius, bounds.max.z - radius, v),
    );
    if (isWalkable(candidate, bounds, obstacles, radius)) {
      floorPoints.push({ id: `floor-${floorPoints.length.toString().padStart(4, '0')}`, kind: 'FLOOR', position: candidate });
    }
    attempts += 1;
  }

  const interactionPoints = surfaces.flatMap((surface) => {
    const points = makeSurfacePoints(surface);
    const approach = surface.facing.clone().setY(0).normalize();
    const center = surface.bounds.getCenter(new THREE.Vector3());
    const approachDistance = Math.max(surface.bounds.getSize(new THREE.Vector3()).x, surface.bounds.getSize(new THREE.Vector3()).z) * 0.5 + radius + 0.08;
    const approachPosition = center.clone().addScaledVector(approach, approachDistance).setY(0);
    const approachKind = surface.kind === 'BED_LIE' ? 'BED_APPROACH' : 'SOFA_APPROACH';
    points.unshift({
      id: `${surface.id}-approach`,
      kind: approachKind,
      position: approachPosition,
      faceDirection: Math.atan2(-approach.x, -approach.z),
      interactionTarget: center.clone().setY(0),
    });
    return points;
  });

  return {
    points: [...floorPoints, ...interactionPoints],
    walkableFloorPoints: floorPoints,
    interactionPoints,
  };
}
