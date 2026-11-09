import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const WALNUT = new THREE.MeshStandardMaterial({ color: 0x624536, roughness: 0.38, metalness: 0.12 });
const WALNUT_DARK = new THREE.MeshStandardMaterial({ color: 0x392a25, roughness: 0.42, metalness: 0.08 });
const BRASS = new THREE.MeshStandardMaterial({ color: 0xb58a58, roughness: 0.28, metalness: 0.72 });
const LINEN = new THREE.MeshStandardMaterial({ color: 0xd8d0c2, roughness: 0.93 });
const LINEN_LIGHT = new THREE.MeshStandardMaterial({ color: 0xf0ebe2, roughness: 0.95 });
const LINEN_TAUPE = new THREE.MeshStandardMaterial({ color: 0x9b8d7f, roughness: 0.94 });
const TEAL = new THREE.MeshStandardMaterial({ color: 0x536f78, roughness: 0.9 });
const CHARCOAL = new THREE.MeshStandardMaterial({ color: 0x18232b, roughness: 0.32, metalness: 0.36 });
const DARK_SCREEN = new THREE.MeshStandardMaterial({
  color: 0x07121a,
  emissive: 0x102c38,
  emissiveIntensity: 0.72,
  roughness: 0.18,
  metalness: 0.22,
});
const PLANT_GREEN = new THREE.MeshStandardMaterial({ color: 0x315e4b, roughness: 0.85 });
const CERAMIC = new THREE.MeshStandardMaterial({ color: 0xddd6c9, roughness: 0.22, metalness: 0.03 });

function addMesh(
  parent: THREE.Object3D,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: THREE.Vector3,
  rotation?: THREE.Euler,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(position);
  if (rotation) mesh.rotation.copy(rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addBox(
  parent: THREE.Object3D,
  name: string,
  size: [number, number, number],
  material: THREE.Material,
  position: [number, number, number],
): THREE.Mesh {
  const smallestEdge = Math.min(...size);
  const radius = Math.min(0.055, smallestEdge * 0.24);
  return addMesh(
    parent,
    name,
    new RoundedBoxGeometry(size[0], size[1], size[2], 3, radius),
    material,
    new THREE.Vector3(...position),
  );
}

function addCylinder(
  parent: THREE.Object3D,
  name: string,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  material: THREE.Material,
  position: [number, number, number],
  radialSegments = 20,
): THREE.Mesh {
  return addMesh(
    parent,
    name,
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments),
    material,
    new THREE.Vector3(...position),
  );
}

function createBed(): THREE.Group {
  const bed = new THREE.Group();
  bed.name = 'BoxBed_BoxBed_Root';
  bed.userData.generatedByAether = true;
  // The established layout pass moves the bed to the measured rear-wall sleeping zone.
  bed.position.set(-0.9, 0, -3.2);

  // Low walnut platform with a brass reveal, sized to become a realistic king bed
  // after the existing 1.2x authored-bed scale and room-scale normalization.
  addBox(bed, 'AetherBed_WalnutPlatform', [1.94, 0.28, 2.18], WALNUT, [0, 0.20, 0]);
  addBox(bed, 'AetherBed_BrassReveal', [1.98, 0.018, 2.19], BRASS, [0, 0.33, 0]);
  addBox(bed, 'AetherBed_RecessedPlinth', [1.72, 0.12, 1.98], WALNUT_DARK, [0, 0.08, 0]);
  for (const x of [-0.78, 0.78]) {
    for (const z of [-0.88, 0.88]) {
      addBox(bed, `AetherBed_Leg_${x}_${z}`, [0.13, 0.15, 0.13], WALNUT_DARK, [x, 0.075, z]);
    }
  }

  addBox(bed, 'AetherBed_Mattress', [1.88, 0.30, 2.10], LINEN_LIGHT, [0, 0.48, 0]);
  addBox(bed, 'AetherBed_FittedSheet', [1.86, 0.045, 2.06], LINEN, [0, 0.648, 0]);
  addBox(bed, 'AetherBed_Duvet', [1.86, 0.12, 1.48], LINEN_LIGHT, [0, 0.728, 0.26]);
  addBox(bed, 'AetherBed_FoldedTealThrow', [1.90, 0.065, 0.40], TEAL, [0, 0.812, 0.82]);
  addBox(bed, 'AetherBed_ThrowStitch', [1.80, 0.008, 0.018], BRASS, [0, 0.85, 0.64]);

  // Upholstered channel headboard, with a softly contrasting center panel.
  addBox(bed, 'AetherBed_HeadboardFrame', [2.08, 1.16, 0.16], WALNUT, [0, 1.12, -1.08]);
  addBox(bed, 'AetherBed_HeadboardUpholstery', [1.94, 0.98, 0.06], LINEN_TAUPE, [0, 1.13, -0.966]);
  for (const x of [-0.63, 0, 0.63]) {
    addBox(bed, `AetherBed_HeadboardChannel_${x}`, [0.014, 0.84, 0.012], LINEN_LIGHT, [x, 1.13, -0.927]);
  }

  for (const x of [-0.47, 0.47]) {
    const pillow = addBox(bed, `AetherBed_Pillow_${x}`, [0.78, 0.16, 0.46], LINEN_LIGHT, [x, 0.78, -0.70]);
    pillow.rotation.y = x < 0 ? -0.045 : 0.045;
    addBox(bed, `AetherBed_PillowSeam_${x}`, [0.70, 0.012, 0.012], LINEN_TAUPE, [x, 0.864, -0.70]);
  }

  return bed;
}

function createTelevision(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'TV_TV_Root';
  root.userData.generatedByAether = true;
  root.position.set(0, 0, 0);
  addBox(root, 'TV_Frame', [1.60, 0.92, 0.075], CHARCOAL, [0, 1.46, 4.07]);
  addBox(root, 'TV_GlassScreen', [1.52, 0.84, 0.012], DARK_SCREEN, [0, 1.46, 4.023]);
  addBox(root, 'TV_LowerBezel', [1.58, 0.035, 0.082], WALNUT_DARK, [0, 0.985, 4.07]);
  const indicator = addMesh(
    root,
    'TV_PowerIndicator',
    new THREE.SphereGeometry(0.012, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0x67e8f9, toneMapped: false }),
    new THREE.Vector3(0.72, 0.986, 4.015),
  );
  indicator.castShadow = false;
  return root;
}

function createWallClockCase(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Alarm_Alarm_Root';
  root.userData.generatedByAether = true;
  root.position.set(-0.9, 2.48, -4.48);
  addBox(root, 'Alarm', [0.52, 0.22, 0.09], CHARCOAL, [0, 0, 0]);
  addBox(root, 'Alarm_BrassTrim', [0.48, 0.18, 0.012], BRASS, [0, 0, 0.052]);
  return root;
}

function createVessel(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Vessel_Vessel_Root';
  root.userData.generatedByAether = true;
  const points = [
    new THREE.Vector2(0.035, 0), new THREE.Vector2(0.09, 0.02),
    new THREE.Vector2(0.14, 0.12), new THREE.Vector2(0.15, 0.24),
    new THREE.Vector2(0.11, 0.34), new THREE.Vector2(0.06, 0.42),
    new THREE.Vector2(0.055, 0.49), new THREE.Vector2(0.085, 0.51),
  ];
  const vase = addMesh(
    root,
    'Vessel_CeramicBody',
    new THREE.LatheGeometry(points, 28),
    CERAMIC,
    new THREE.Vector3(0, 0, 0),
  );
  vase.position.y = 0.25;
  addCylinder(root, 'Vessel_BrassFoot', 0.10, 0.10, 0.025, BRASS, [0, 0.012, 0], 24);
  return root;
}

function createCandle(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'ModernCandle_ModernCandle_Root';
  root.userData.generatedByAether = true;
  addCylinder(root, 'Candle_Wax', 0.075, 0.08, 0.22, LINEN_LIGHT, [0, 0.11, 0], 18);
  addCylinder(root, 'Candle_Wick', 0.006, 0.006, 0.025, WALNUT_DARK, [0, 0.233, 0], 8);
  return root;
}

function createSideTable(name: string, position: [number, number, number], width = 0.68, depth = 0.43): THREE.Group {
  const root = new THREE.Group();
  root.name = name;
  root.position.set(...position);
  root.userData.generatedByAether = true;
  for (const x of [-width * 0.39, width * 0.39]) {
    for (const z of [-depth * 0.37, depth * 0.37]) {
      addBox(root, `${name}_Leg_${x}_${z}`, [0.055, 0.48, 0.055], WALNUT_DARK, [x, 0.24, z]);
    }
  }
  addBox(root, `${name}_Cabinet`, [width, 0.33, depth], WALNUT, [0, 0.34, 0]);
  addBox(root, `${name}_DrawerFront`, [width * 0.82, 0.11, 0.018], WALNUT_DARK, [0, 0.40, depth / 2 + 0.011]);
  addBox(root, `${name}_BrassPull`, [0.11, 0.018, 0.018], BRASS, [0, 0.40, depth / 2 + 0.026]);
  addBox(root, `${name}_Top`, [width + 0.045, 0.055, depth + 0.045], WALNUT, [0, 0.55, 0]);
  return root;
}

function createSofa(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Aether_Modern_Sofa_Root';
  root.position.set(2.10, 0, 1.65);
  root.rotation.y = -Math.PI / 2;
  root.userData.generatedByAether = true;
  addBox(root, 'Sofa_LowBase', [2.42, 0.25, 0.90], WALNUT_DARK, [0, 0.22, 0]);
  addBox(root, 'Sofa_Seat', [2.28, 0.19, 0.79], TEAL, [0, 0.43, 0.055]);
  addBox(root, 'Sofa_Back', [2.28, 0.74, 0.21], TEAL, [0, 0.83, -0.34]);
  for (const x of [-1.07, 1.07]) {
    addBox(root, `Sofa_Arm_${x}`, [0.27, 0.55, 0.82], LINEN_TAUPE, [x, 0.56, 0.02]);
    addBox(root, `Sofa_Foot_${x}_L`, [0.10, 0.15, 0.10], WALNUT_DARK, [x * 0.83, 0.075, -0.34]);
    addBox(root, `Sofa_Foot_${x}_R`, [0.10, 0.15, 0.10], WALNUT_DARK, [x * 0.83, 0.075, 0.34]);
  }
  for (const x of [-0.62, 0.62]) {
    addBox(root, `Sofa_BackPanel_${x}`, [0.018, 0.52, 0.018], LINEN_LIGHT, [x, 0.84, -0.222]);
  }
  return root;
}

function createReadingChair(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Aether_Reading_Chair_Root';
  root.position.set(-2.55, 0, 0.52);
  root.rotation.y = Math.PI / 2;
  root.userData.generatedByAether = true;
  addBox(root, 'ReadingChair_SeatBase', [0.88, 0.18, 0.84], WALNUT_DARK, [0, 0.32, 0]);
  addBox(root, 'ReadingChair_Cushion', [0.79, 0.17, 0.75], LINEN_TAUPE, [0, 0.45, 0.04]);
  addBox(root, 'ReadingChair_Back', [0.82, 0.82, 0.18], TEAL, [0, 0.86, -0.30]);
  for (const x of [-0.39, 0.39]) {
    addBox(root, `ReadingChair_Arm_${x}`, [0.12, 0.48, 0.69], WALNUT, [x, 0.64, -0.01]);
    addBox(root, `ReadingChair_Leg_${x}_F`, [0.065, 0.30, 0.065], WALNUT_DARK, [x * 0.82, 0.15, 0.30]);
    addBox(root, `ReadingChair_Leg_${x}_B`, [0.065, 0.30, 0.065], WALNUT_DARK, [x * 0.82, 0.15, -0.30]);
  }
  return root;
}

function createWardrobe(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Aether_Sliding_Wardrobe_Root';
  root.position.set(3.12, 0, -0.72);
  root.userData.generatedByAether = true;
  const body = addBox(root, 'Wardrobe_Carcass', [0.64, 2.28, 1.78], WALNUT_DARK, [0, 1.14, 0]);
  body.castShadow = true;
  addBox(root, 'Wardrobe_LeftDoor', [0.035, 2.12, 0.87], WALNUT, [-0.335, 1.14, -0.445]);
  addBox(root, 'Wardrobe_RightDoor', [0.035, 2.12, 0.87], WALNUT, [-0.335, 1.14, 0.445]);
  const mirror = new THREE.MeshStandardMaterial({ color: 0x607985, roughness: 0.16, metalness: 0.78 });
  addBox(root, 'Wardrobe_MirrorInset', [0.014, 1.82, 0.56], mirror, [-0.358, 1.15, 0.445]);
  for (const z of [-0.06, 0.06]) {
    addBox(root, `Wardrobe_Handle_${z}`, [0.025, 0.24, 0.018], BRASS, [-0.365, 1.12, z]);
  }
  addBox(root, 'Wardrobe_TopTrim', [0.69, 0.05, 1.84], WALNUT, [0, 2.30, 0]);
  return root;
}

function createCoffeeTable(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Aether_Lounge_Table_Root';
  root.position.set(1.12, 0, 1.65);
  root.userData.generatedByAether = true;
  addBox(root, 'LoungeTable_Pedestal', [0.12, 0.42, 0.12], WALNUT_DARK, [0, 0.21, 0]);
  addBox(root, 'LoungeTable_Foot', [0.42, 0.055, 0.42], BRASS, [0, 0.03, 0]);
  addBox(root, 'LoungeTable_Top', [0.66, 0.075, 0.66], WALNUT, [0, 0.46, 0]);
  addBox(root, 'LoungeTable_Inlay', [0.56, 0.009, 0.009], BRASS, [0, 0.501, 0.25]);
  return root;
}

function createFloorLamp(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Aether_Floor_Lamp_Root';
  root.position.set(-1.52, 0, 1.42);
  root.userData.generatedByAether = true;
  addCylinder(root, 'FloorLamp_Base', 0.18, 0.22, 0.075, WALNUT_DARK, [0, 0.038, 0], 24);
  addCylinder(root, 'FloorLamp_Stem', 0.024, 0.032, 1.50, BRASS, [0, 0.81, 0], 16);
  const shadeMaterial = new THREE.MeshStandardMaterial({ color: 0xe1d5bf, roughness: 0.72, emissive: 0x5a3a20, emissiveIntensity: 0.12, side: THREE.DoubleSide });
  addMesh(root, 'FloorLamp_Shade', new THREE.ConeGeometry(0.23, 0.30, 24, 1, true), shadeMaterial, new THREE.Vector3(0, 1.65, 0));
  const bulb = new THREE.PointLight(0xffd2a1, 0.45, 3.2, 2);
  bulb.name = 'AetherWarmLampLight';
  bulb.position.set(0, 1.49, 0);
  root.add(bulb);
  return root;
}

function createPlant(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Aether_Indoor_Plant_Root';
  root.position.set(2.75, 0, -2.28);
  root.userData.generatedByAether = true;
  addCylinder(root, 'Plant_Pot', 0.20, 0.15, 0.34, CERAMIC, [0, 0.17, 0], 24);
  addCylinder(root, 'Plant_Soil', 0.16, 0.16, 0.018, WALNUT_DARK, [0, 0.34, 0], 24);
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2;
    const height = 0.72 + (i % 3) * 0.12;
    const x = Math.cos(angle) * 0.12;
    const z = Math.sin(angle) * 0.12;
    const leaf = addMesh(
      root,
      `Plant_Leaf_${i}`,
      new THREE.SphereGeometry(0.12, 12, 8),
      PLANT_GREEN,
      new THREE.Vector3(x, 0.50 + height * 0.45, z),
    );
    leaf.scale.set(0.55, height, 0.72);
    leaf.rotation.z = -Math.cos(angle) * 0.25;
    leaf.rotation.x = Math.sin(angle) * 0.25;
  }
  return root;
}

function createCurtainPanel(name: string, width: number, height: number): THREE.Mesh {
  const columns = 30;
  const rows = 18;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      const fold = Math.sin(u * Math.PI * 14) * 0.038;
      positions.push((u - 0.5) * width, (0.5 - v) * height, fold * (0.35 + 0.65 * Math.sin(v * Math.PI)));
    }
  }
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column;
      const b = a + columns + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: 0xbdb4a7, roughness: 1, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createCurtains(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Curtain_Curtain_Root';
  root.position.set(-3.42, 1.78, 0);
  root.rotation.y = Math.PI / 2;
  root.userData.generatedByAether = true;
  const left = createCurtainPanel('Curtain_LeftPanel', 1.45, 3.52);
  const right = createCurtainPanel('Curtain_RightPanel', 1.45, 3.52);
  left.position.x = -1.80;
  right.position.x = 1.80;
  root.add(left, right);
  return root;
}

function createCurtainHeader(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'SmallWallCurtain_SmallWallCurtain_Root';
  root.position.set(-3.42, 3.72, -1.35);
  root.userData.generatedByAether = true;
  addBox(root, 'Curtain_HeaderTrim', [5.65, 0.18, 0.15], WALNUT, [0, 0, 0]);
  addBox(root, 'Curtain_HeaderBrassLine', [5.50, 0.018, 0.015], BRASS, [0, -0.065, 0.083]);
  return root;
}

function repositionOriginalSofaPillows(room: THREE.Object3D): void {
  const pillows = [
    { name: 'SimplePillow1_Root', x: 2.10, z: 1.16, yaw: -1.62 },
    { name: 'SimplePillow2_Root', x: 2.10, z: 2.14, yaw: -1.52 },
  ];
  for (const spec of pillows) {
    const root = room.getObjectByName(spec.name);
    if (!root || root.userData.generatedByAether) continue;
    root.position.set(spec.x, 0.60, spec.z);
    root.rotation.set(0.05, spec.yaw, -0.04);
    root.scale.setScalar(25);
    root.userData.reusedAsSofaCushion = true;
  }
}

/** Add only missing furniture; source meshes such as the drawer console, nightstand,
 *  and pillows are retained and reused in the finished room. */
export function ensureModernRoomFurniture(room: THREE.Object3D): string[] {
  const created: string[] = [];
  const addIfMissing = (name: string, factory: () => THREE.Object3D) => {
    if (room.getObjectByName(name)) return;
    room.add(factory());
    created.push(name);
  };

  addIfMissing('BoxBed_BoxBed_Root', createBed);
  addIfMissing('TV_TV_Root', createTelevision);
  addIfMissing('Alarm_Alarm_Root', createWallClockCase);
  addIfMissing('Vessel_Vessel_Root', createVessel);
  addIfMissing('ModernCandle_ModernCandle_Root', createCandle);
  addIfMissing('Aether_Bedside_Table_Root', () => createSideTable('Aether_Bedside_Table_Root', [0.80, 0, -4.10]));
  addIfMissing('Aether_Modern_Sofa_Root', createSofa);
  addIfMissing('Aether_Reading_Chair_Root', createReadingChair);
  addIfMissing('Aether_Sliding_Wardrobe_Root', createWardrobe);
  addIfMissing('Aether_Lounge_Table_Root', createCoffeeTable);
  addIfMissing('Aether_Floor_Lamp_Root', createFloorLamp);
  addIfMissing('Aether_Indoor_Plant_Root', createPlant);
  addIfMissing('Curtain_Curtain_Root', createCurtains);
  addIfMissing('SmallWallCurtain_SmallWallCurtain_Root', createCurtainHeader);

  repositionOriginalSofaPillows(room);
  room.updateMatrixWorld(true);
  return created;
}
