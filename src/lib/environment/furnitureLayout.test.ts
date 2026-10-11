import * as THREE from 'three';
import { FurnitureLayoutEngine } from './FurnitureLayoutEngine';

console.log('=== RUNNING AETHER AI FURNITURE EXTRACTION & SPATIAL LAYOUT TEST SUITE ===');

// Helper to construct a synthetic mesh node matching the exact names and bounds in Neon_World_3
function createMockBoxMesh(
  name: string,
  min: [number, number, number],
  max: [number, number, number],
  materialName = 'White'
): THREE.Mesh {
  const sizeX = max[0] - min[0];
  const sizeY = max[1] - min[1];
  const sizeZ = max[2] - min[2];
  const geo = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
  const mat = new THREE.MeshStandardMaterial({ name: materialName });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  // Position so that world bounding box matches [min, max]
  mesh.position.set(
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2
  );
  return mesh;
}

// -----------------------------------------------------------------------------
// Test 1: Full Extraction from Mock Neon World 3 Scene Graph
// -----------------------------------------------------------------------------
console.log('\n--- Test 1: Extracting and Organizing Synthetic Neon World 3 Hierarchy ---');

const mockScene = new THREE.Scene();

// 1. Carpet: min [-2.25, 0, -4.63], max [1.75, 0.012, 0.38]
mockScene.add(createMockBoxMesh('Carpet', [-2.25, 0, -4.625], [1.75, 0.012, 0.375], 'Carpet014'));

// 2. Credenza components (7 parts)
mockScene.add(createMockBoxMesh('Drawer Base', [-2.25, 0, 4.13], [1.75, 0.88, 4.63]));
mockScene.add(createMockBoxMesh('DrawerSide1', [-2.28, 0, 4.10], [-2.25, 0.75, 4.63]));
mockScene.add(createMockBoxMesh('DrawerSide2', [1.75, 0, 4.10], [1.77, 0.75, 4.63]));
mockScene.add(createMockBoxMesh('DrawerDoor1', [-2.25, 0.01, 4.10], [-1.26, 0.75, 4.13]));
mockScene.add(createMockBoxMesh('DrawerDoor2', [-1.25, 0.01, 4.10], [-0.26, 0.75, 4.13]));
mockScene.add(createMockBoxMesh('DrawerDoor3', [-0.25, 0.01, 4.10], [0.74, 0.75, 4.13]));
mockScene.add(createMockBoxMesh('DrawerDoor4', [0.75, 0.01, 4.10], [1.75, 0.75, 4.13]));

// 3. Nightstand: min [-3.25, 0.60, -4.38], max [-2.25, 0.95, -3.88]
mockScene.add(createMockBoxMesh('Nightstand', [-3.25, 0.60, -4.375], [-2.25, 0.95, -3.875], 'Wood042'));

// 4. Pillows
const pillow1Root = new THREE.Group();
pillow1Root.name = 'SimplePillow1_Root';
const pillow1Mesh = createMockBoxMesh('Pillow', [-0.4, -0.2, -0.4], [0.4, 0.2, 0.4], 'Pillow1');
pillow1Root.add(pillow1Mesh);
mockScene.add(pillow1Root);

const pillow2Root = new THREE.Group();
pillow2Root.name = 'SimplePillow2_Root';
const pillow2Mesh = createMockBoxMesh('Pillow.001', [-0.4, -0.2, -0.4], [0.4, 0.2, 0.4], 'Pillow2');
pillow2Root.add(pillow2Mesh);
mockScene.add(pillow2Root);

// 5. LED-Light
mockScene.add(createMockBoxMesh('LED-Light', [-2.0, 4.05, -4.57], [1.5, 4.20, -4.43], 'WhiteLED'));

// 6. Window Frame & Glass
mockScene.add(createMockBoxMesh('WindowFrame', [-3.75, 0, -4.38], [-3.45, 4.0, 1.63], 'Metal018'));
mockScene.add(createMockBoxMesh('Window', [-3.63, 0.05, -4.32], [-3.57, 3.95, 1.57], 'Glass'));

// Run Extraction Engine
const result = FurnitureLayoutEngine.extractAndOrganize(mockScene);

console.log(`Success: ${result.success}`);
console.log(`Extracted items count: ${result.items.length}`);
console.log(`Validation report passed: ${result.validationReport.passed}`);
console.log(`Checks run:`);
for (const check of result.validationReport.checks) {
  console.log(`  [${check.passed ? 'PASS' : 'FAIL'}] ${check.name}: ${check.details}`);
}

if (!result.success || !result.validationReport.passed) {
  throw new Error('Test 1 Failed: Extraction or validation checks failed!');
}
console.log('✓ Test 1 Passed: Synthetic scene successfully extracted and organized with zero violations.');

// -----------------------------------------------------------------------------
// Test 2: Verify Floor Contact and Resting Elevation Accuracy
// -----------------------------------------------------------------------------
console.log('\n--- Test 2: Floor Contact and Elevation Precision ---');

const credenza = result.items.find((i) => i.id === 'credenza_feature');
if (!credenza) throw new Error('Credenza item not found!');
console.log(`Credenza world bounds min Y: ${credenza.worldBounds.min.y.toFixed(4)}m (Expected: 0.000m)`);
if (Math.abs(credenza.worldBounds.min.y) > 0.001) {
  throw new Error(`Credenza base not flush with floor: ${credenza.worldBounds.min.y}`);
}

const nightstand = result.items.find((i) => i.id === 'nightstand_west');
if (!nightstand) throw new Error('Nightstand item not found!');
console.log(`Nightstand world bounds min Y: ${nightstand.worldBounds.min.y.toFixed(4)}m (Expected: 0.000m)`);
if (Math.abs(nightstand.worldBounds.min.y) > 0.001) {
  throw new Error(`Nightstand base not flush with floor: ${nightstand.worldBounds.min.y}`);
}

const carpet = result.items.find((i) => i.id === 'carpet_primary');
if (!carpet) throw new Error('Carpet item not found!');
console.log(`Carpet world bounds min Y: ${carpet.worldBounds.min.y.toFixed(4)}m`);
if (carpet.worldBounds.min.y < 0) {
  throw new Error(`Carpet penetrates floor: ${carpet.worldBounds.min.y}`);
}

console.log('✓ Test 2 Passed: All furniture elements achieve exact floor contact without hovering or sinking.');

// -----------------------------------------------------------------------------
// Test 3: Inter-Furniture Non-Intersection Verification
// -----------------------------------------------------------------------------
console.log('\n--- Test 3: Inter-Furniture Non-Intersection ---');

for (let i = 0; i < result.items.length; i++) {
  for (let j = i + 1; j < result.items.length; j++) {
    const a = result.items[i];
    const b = result.items[j];
    if (a.category === 'RUG' || b.category === 'RUG') continue;
    if (a.category === 'LIGHTING' || b.category === 'LIGHTING') continue;

    const intersects = a.worldBounds.intersectsBox(b.worldBounds);
    if (intersects) {
      throw new Error(`Inter-furniture intersection detected between ${a.name} and ${b.name}!`);
    }
  }
}
console.log(`✓ Test 3 Passed: Verified 0 intersections between physical furniture pieces.`);

// -----------------------------------------------------------------------------
// Test 4: Companion Clearance & Locomotion Collision Query System
// -----------------------------------------------------------------------------
console.log('\n--- Test 4: Locomotion Collision Query System ---');

// Companion at origin (0, 0, 0) with radius 0.35m must NOT collide with any furniture
const originCollision = FurnitureLayoutEngine.testPointCollision(
  new THREE.Vector3(0, 0, 0),
  0.35,
  result.colliders
);
console.log(`Collision at origin (0, 0, 0): ${originCollision} (Expected: false)`);
if (originCollision) {
  throw new Error('Collision detected at companion origin (0, 0, 0)!');
}

// Deep into credenza (0, 0, -3.20) must be detected as collision
const credenzaCollision = FurnitureLayoutEngine.testPointCollision(
  new THREE.Vector3(0, 0, -3.20),
  0.35,
  result.colliders
);
console.log(`Collision at credenza center (0, 0, -3.20): ${credenzaCollision} (Expected: true)`);
if (!credenzaCollision) {
  throw new Error('Collision query failed to detect credenza boundary!');
}

console.log('✓ Test 4 Passed: Spatial collision queries correctly protect companion clearance.');

console.log('\n=== ALL FURNITURE LAYOUT TESTS PASSED PERFECTLY! ===');
