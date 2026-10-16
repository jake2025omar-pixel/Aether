import * as THREE from 'three';

const WORLD_X = new THREE.Vector3(1, 0, 0);
const WORLD_Y = new THREE.Vector3(0, 1, 0);

const BED_LENGTH_SCALE = 1.2;
const BED_CENTER_X = -0.9;
const BED_WALL_CLEARANCE = 0.14;
const BEDSIDE_CLEARANCE = 0.12;

export interface NeonWorld3LayoutAudit {
  roomMeters: number[];
  bedMeters: number[] | null;
  bedCenterMeters: number[] | null;
  bedsideGapMeters: number | null;
  bedFloorGapMeters: number | null;
  tvMeters: number[] | null;
  tvVerticalized: boolean;
  consoleClearanceMeters: number | null;
  vesselSurfaceGapMeters: number | null;
  candleSurfaceGapMeters: number | null;
  windowHeaderGapMeters: number | null;
  outsideRoom: string[];
  warnings: string[];
}

function boundsOf(object: THREE.Object3D | null | undefined): THREE.Box3 | null {
  if (!object) return null;
  return new THREE.Box3().setFromObject(object);
}

function dimensions(bounds: THREE.Box3 | null): number[] | null {
  if (!bounds || bounds.isEmpty()) return null;
  const size = bounds.getSize(new THREE.Vector3());
  return [size.x, size.y, size.z].map((value) => Number(value.toFixed(3)));
}

/** Translate an object by a world-space delta even when it has transformed parents. */
function moveWorld(object: THREE.Object3D, delta: THREE.Vector3): void {
  const parent = object.parent;
  if (!parent) {
    object.position.add(delta);
    return;
  }
  parent.updateWorldMatrix(true, false);
  const inverseParent = parent.matrixWorld.clone().invert();
  const localOrigin = new THREE.Vector3(0, 0, 0).applyMatrix4(inverseParent);
  const localDestination = delta.clone().applyMatrix4(inverseParent);
  object.position.add(localDestination.sub(localOrigin));
}

function overlapOnFloor(a: THREE.Box3, b: THREE.Box3, tolerance = 0.025): boolean {
  return a.min.x < b.max.x - tolerance && a.max.x > b.min.x + tolerance &&
    a.min.z < b.max.z - tolerance && a.max.z > b.min.z + tolerance;
}

function center(bounds: THREE.Box3): THREE.Vector3 {
  return bounds.getCenter(new THREE.Vector3());
}

/**
 * Re-seats the supplied Neon World 3 assets using measured scene bounds and the
 * avatar-scale bedroom layout. Offsets are world metres; this runs once at load.
 */
export function applyNeonWorld3SpatialLayout(room: THREE.Object3D): NeonWorld3LayoutAudit {
  const warnings: string[] = [];

  const structuralRoot = room.getObjectByName('Base1');
  const structuralBounds = boundsOf(structuralRoot) ?? boundsOf(room) ?? new THREE.Box3();
  const roomSize = structuralBounds.getSize(new THREE.Vector3());

  const bed = room.getObjectByName('BoxBed_BoxBed_Root');
  if (bed) {
    bed.scale.multiplyScalar(BED_LENGTH_SCALE);
    room.updateMatrixWorld(true);

    const bedBeforePositioning = boundsOf(bed);
    if (bedBeforePositioning) {
      const bedCenter = center(bedBeforePositioning);
      const towardRoomCenterZ = bedCenter.z < 0 ? 1 : -1;
      moveWorld(
        bed,
        new THREE.Vector3(BED_CENTER_X - bedCenter.x, 0, towardRoomCenterZ * BED_WALL_CLEARANCE),
      );
      room.updateMatrixWorld(true);

      const floorBounds = boundsOf(bed);
      if (floorBounds && Math.abs(floorBounds.min.y) > 0.002) {
        moveWorld(bed, new THREE.Vector3(0, -floorBounds.min.y, 0));
      }
    }
  } else {
    warnings.push('Bed root BoxBed_BoxBed_Root was not found.');
  }

  room.updateMatrixWorld(true);
  const bedBounds = boundsOf(bed);

  const nightstand = room.getObjectByName('Nightstand');
  const candle = room.getObjectByName('ModernCandle_ModernCandle_Root');
  let bedsideGapMeters: number | null = null;
  let candleSurfaceGapMeters: number | null = null;

  if (bedBounds && nightstand) {
    const tableBefore = boundsOf(nightstand);
    if (tableBefore) {
      const tableSize = tableBefore.getSize(new THREE.Vector3());
      const desiredTableCenterX = bedBounds.min.x - tableSize.x / 2 - BEDSIDE_CLEARANCE;
      const tableOffset = new THREE.Vector3(
        desiredTableCenterX - center(tableBefore).x,
        -tableBefore.min.y,
        0,
      );
      moveWorld(nightstand, tableOffset);
      if (candle) moveWorld(candle, new THREE.Vector3(tableOffset.x, tableOffset.y, 0));
      room.updateMatrixWorld(true);

      const tableBounds = boundsOf(nightstand);
      if (tableBounds) {
        bedsideGapMeters = Number((bedBounds.min.x - tableBounds.max.x).toFixed(3));
        if (candle) {
          const candleBounds = boundsOf(candle);
          if (candleBounds) {
            const tableCenter = center(tableBounds);
            const candleCenter = center(candleBounds);
            const candleOffset = new THREE.Vector3(
              tableCenter.x - candleCenter.x,
              tableBounds.max.y - candleBounds.min.y,
              tableCenter.z - candleCenter.z,
            );
            moveWorld(candle, candleOffset);
            room.updateMatrixWorld(true);
            const seatedCandle = boundsOf(candle);
            candleSurfaceGapMeters = seatedCandle
              ? Number(Math.abs(seatedCandle.min.y - tableBounds.max.y).toFixed(3))
              : null;
          }
        }
        if (overlapOnFloor(bedBounds, tableBounds)) {
          warnings.push('The bed and bedside table floor bounds overlap.');
        }
      }
    }
  } else if (!nightstand) {
    warnings.push('Nightstand mesh was not found; the room layout is missing its bedside surface.');
  }

  // Align the original wall clock above the moved bed; the live display is added
  // later from the transformed alarm case bounds.
  if (bedBounds) {
    const alarmRoot = room.getObjectByName('Alarm_Alarm_Root') ?? room.getObjectByName('Alarm');
    const alarmBounds = boundsOf(alarmRoot);
    if (alarmRoot && alarmBounds) {
      moveWorld(alarmRoot, new THREE.Vector3(center(bedBounds).x - center(alarmBounds).x, 0, 0));
      room.updateMatrixWorld(true);
    } else {
      warnings.push('Wall clock root was not found.');
    }
  }

  // The supplied TV was imported nearly flat: its broad screen plane is horizontal.
  // Rotate the intact original asset upright around its measured center.
  const tv = room.getObjectByName('TV_TV_Root');
  if (!tv) warnings.push('TV root TV_TV_Root was not found.');
  const tvBefore = boundsOf(tv);
  const tvBeforeSize = tvBefore?.getSize(new THREE.Vector3());
  if (tv && tvBefore && tvBeforeSize && tvBeforeSize.y < tvBeforeSize.z * 0.45) {
    const tvCenter = center(tvBefore);
    tv.rotateOnWorldAxis(WORLD_X, -Math.PI / 2);
    room.updateMatrixWorld(true);
    const tvAfter = boundsOf(tv);
    if (tvAfter) moveWorld(tv, tvCenter.sub(center(tvAfter)));
    room.updateMatrixWorld(true);
  }

  const consoleMesh = room.getObjectByName('Drawer_Base') ?? room.getObjectByName('Drawer Base');
  const consoleBounds = boundsOf(consoleMesh);
  let finalTvBounds = boundsOf(tv);

  if (tv && consoleBounds && finalTvBounds) {
    const clearance = finalTvBounds.min.y - consoleBounds.max.y;
    const desiredClearance = 0.03;
    if (clearance < desiredClearance) {
      moveWorld(tv, new THREE.Vector3(0, desiredClearance - clearance, 0));
      room.updateMatrixWorld(true);
      finalTvBounds = boundsOf(tv);
    }
  } else if (!consoleBounds) {
    warnings.push('Console mesh Drawer_Base was not found; tabletop props cannot be seated.');
  }

  const finalTvSize = finalTvBounds?.getSize(new THREE.Vector3());
  const tvVerticalized = Boolean(finalTvSize && finalTvSize.y > finalTvSize.z * 1.4);
  if (finalTvBounds && !tvVerticalized) warnings.push('TV orientation correction did not produce a vertical screen.');

  const consoleClearanceMeters = consoleBounds && finalTvBounds
    ? Number((finalTvBounds.min.y - consoleBounds.max.y).toFixed(3))
    : null;
  if (consoleClearanceMeters !== null && consoleClearanceMeters < 0.02) {
    warnings.push('The TV touches or intersects the console top.');
  }

  // Preserve the vessel's proportions while fitting its measured depth to the real console top.
  const vessel = room.getObjectByName('Vessel_Vessel_Root');
  let vesselSurfaceGapMeters: number | null = null;
  if (vessel && consoleBounds) {
    let vesselBounds = boundsOf(vessel);
    if (vesselBounds) {
      const consoleSize = consoleBounds.getSize(new THREE.Vector3());
      const vesselSize = vesselBounds.getSize(new THREE.Vector3());
      const depthFit = consoleSize.z > 0 ? (consoleSize.z - 0.04) / vesselSize.z : 1;
      if (depthFit > 0 && depthFit < 1) {
        vessel.scale.multiplyScalar(depthFit);
        room.updateMatrixWorld(true);
        vesselBounds = boundsOf(vessel);
      }
      if (vesselBounds) {
        const fittedSize = vesselBounds.getSize(new THREE.Vector3());
        const tvLeftClearance = finalTvBounds
          ? finalTvBounds.min.x - fittedSize.x / 2 - 0.08
          : center(consoleBounds).x;
        const minCenterX = consoleBounds.min.x + fittedSize.x / 2 + 0.02;
        const maxCenterX = consoleBounds.max.x - fittedSize.x / 2 - 0.02;
        const targetX = THREE.MathUtils.clamp(tvLeftClearance, minCenterX, maxCenterX);
        const targetZ = center(consoleBounds).z;
        moveWorld(vessel, new THREE.Vector3(
          targetX - center(vesselBounds).x,
          consoleBounds.max.y - vesselBounds.min.y,
          targetZ - center(vesselBounds).z,
        ));
        room.updateMatrixWorld(true);
        const seatedVessel = boundsOf(vessel);
        vesselSurfaceGapMeters = seatedVessel
          ? Number(Math.abs(seatedVessel.min.y - consoleBounds.max.y).toFixed(3))
          : null;
        if (seatedVessel && (
          seatedVessel.min.z < consoleBounds.min.z - 0.02 || seatedVessel.max.z > consoleBounds.max.z + 0.02
        )) {
          warnings.push('The vessel does not fit within the console depth after uniform scaling.');
        }
      }
    }
  } else {
    warnings.push('Vessel_Vessel_Root was not found; the console decoration is missing.');
  }

  const windowMesh = room.getObjectByName('Window');
  const windowBounds = boundsOf(windowMesh);
  const fullCurtain = room.getObjectByName('Curtain_Curtain_Root') ?? room.getObjectByName('Curtain');
  const fullCurtainBefore = boundsOf(fullCurtain);
  if (fullCurtain && fullCurtainBefore && windowBounds) {
    const windowCenter = center(windowBounds);
    const curtainCenter = center(fullCurtainBefore);
    moveWorld(fullCurtain, new THREE.Vector3(0, 0, windowCenter.z - curtainCenter.z));
    room.updateMatrixWorld(true);
  } else if (!fullCurtain) {
    warnings.push('Full-height curtain was not found.');
  }

  // Re-seat the small fabric header above the existing window, perpendicular to
  // the full-height curtain. Uniform half-scale resolves its overlarge depth.
  const smallCurtain = room.getObjectByName('SmallWallCurtain_SmallWallCurtain_Root');
  let windowHeaderGapMeters: number | null = null;
  if (smallCurtain && windowBounds) {
    smallCurtain.scale.multiplyScalar(0.5);
    smallCurtain.rotateOnWorldAxis(WORLD_Y, Math.PI / 2);
    room.updateMatrixWorld(true);
    const headerBounds = boundsOf(smallCurtain);
    const fullCurtainBounds = boundsOf(fullCurtain);
    if (headerBounds) {
      const headerSize = headerBounds.getSize(new THREE.Vector3());
      const windowCenter = center(windowBounds);
      const targetMinX = fullCurtainBounds ? fullCurtainBounds.min.x : windowBounds.max.x;
      const targetCenter = new THREE.Vector3(
        Math.max(windowBounds.max.x + headerSize.x / 2 + 0.025, targetMinX + headerSize.x / 2),
        windowBounds.max.y - headerSize.y / 2 - 0.025,
        windowCenter.z,
      );
      moveWorld(smallCurtain, targetCenter.sub(center(headerBounds)));
      room.updateMatrixWorld(true);
      const seatedHeader = boundsOf(smallCurtain);
      windowHeaderGapMeters = seatedHeader
        ? Number(Math.abs(windowBounds.max.y - seatedHeader.max.y - 0.025).toFixed(3))
        : null;
    }
  } else if (!smallCurtain) {
    warnings.push('Small wall-curtain prefab was not found; full-height curtain remains unchanged.');
  }

  const finalBedBounds = boundsOf(bed);
  const finalTableBounds = boundsOf(nightstand);
  if (finalBedBounds && finalBedBounds.min.y < -0.01) warnings.push('Bed extends below the wooden floor.');
  if (finalBedBounds && finalBedBounds.min.y > 0.025) warnings.push('Bed does not contact the wooden floor.');

  const roomObjects = [
    ['bed', finalBedBounds],
    ['nightstand', finalTableBounds],
    ['TV', finalTvBounds],
    ['vessel', boundsOf(vessel)],
    ['curtain', boundsOf(fullCurtain)],
    ['curtain header', boundsOf(smallCurtain)],
  ] as const;

  const outsideRoom: string[] = [];
  for (const [name, bounds] of roomObjects) {
    if (!bounds) continue;
    const outside = bounds.min.x < structuralBounds.min.x - 0.02 || bounds.max.x > structuralBounds.max.x + 0.02 ||
      bounds.min.y < structuralBounds.min.y - 0.02 || bounds.max.y > structuralBounds.max.y + 0.02 ||
      bounds.min.z < structuralBounds.min.z - 0.02 || bounds.max.z > structuralBounds.max.z + 0.02;
    if (outside) outsideRoom.push(name);
  }
  if (outsideRoom.length) warnings.push(`Furniture outside room envelope: ${outsideRoom.join(', ')}.`);
  if (bedsideGapMeters !== null && bedsideGapMeters < 0.04) warnings.push('Bedside table clearance is below 4 cm.');
  if (candleSurfaceGapMeters !== null && candleSurfaceGapMeters > 0.025) warnings.push('Candle is not seated on the bedside table.');
  if (vesselSurfaceGapMeters !== null && vesselSurfaceGapMeters > 0.025) warnings.push('Vessel is not seated on the console.');

  return {
    roomMeters: [roomSize.x, roomSize.y, roomSize.z].map((value) => Number(value.toFixed(3))),
    bedMeters: dimensions(finalBedBounds),
    bedCenterMeters: finalBedBounds
      ? center(finalBedBounds).toArray().map((value) => Number(value.toFixed(3)))
      : null,
    bedsideGapMeters,
    bedFloorGapMeters: finalBedBounds ? Number(finalBedBounds.min.y.toFixed(3)) : null,
    tvMeters: dimensions(finalTvBounds),
    tvVerticalized,
    consoleClearanceMeters,
    vesselSurfaceGapMeters,
    candleSurfaceGapMeters,
    windowHeaderGapMeters,
    outsideRoom,
    warnings,
  };
}
