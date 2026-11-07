import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ensureModernRoomFurniture } from './modernRoomFurniture';
import { applyNeonWorld3SpatialLayout } from './neonWorld3Layout';
import { getTimeOfDayProfile } from './timeOfDay';
import { FurnitureLayoutEngine } from '../../lib/environment/FurnitureLayoutEngine';

function addBox(parent: THREE.Object3D, name: string, size: [number, number, number], position: [number, number, number]): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ name }));
  mesh.name = name;
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

function localTime(hour: number, minute = 0): Date {
  return new Date(2026, 5, 1, hour, minute, 0, 0);
}

console.log('=== AETHER ROOM EXPERIENCE TESTS ===');

// Local-clock phases cover the requested day/evening transitions; no geolocation or network is used.
const cases = [
  [0, 'night'], [3, 'dawn'], [4, 'fajr'], [5, 'sunrise'], [8, 'morning'],
  [12, 'noon'], [15, 'afternoon'], [17, 'sunset'], [19, 'maghrib'], [20, 'evening'], [22, 'night'],
] as const;
for (const [hour, expected] of cases) {
  assert.equal(getTimeOfDayProfile(localTime(hour)).phase, expected, `hour ${hour} should map to ${expected}`);
}
for (let hour = 0; hour < 24; hour += 1) {
  const profile = getTimeOfDayProfile(localTime(hour));
  assert.equal(profile.sunVisible, profile.phase === 'sunrise' || profile.phase === 'sunset', `sun must be visible only at sunrise/sunset (hour ${hour})`);
  for (const key of [profile.ambient, profile.key, profile.fill]) {
    const saturation = new THREE.Color(key).getHSL({ h: 0, s: 0, l: 0 }).s;
    assert.ok(saturation < 0.12, `indoor light should remain soft neutral white during ${profile.phase}`);
  }
}
console.log('✓ Local-time phases and sunrise/sunset-only sun visibility pass.');
const exteriorRoom = new THREE.Group();
const exteriorScene = new THREE.Scene();
const exteriorLights = {
  ambient: new THREE.AmbientLight(),
  key: new THREE.DirectionalLight(),
  fill: new THREE.DirectionalLight(),
  rim: new THREE.DirectionalLight(),
};
const exteriorController = attachNeonWorld3TimeOfDay(exteriorRoom, exteriorScene, exteriorLights, localTime(22));
const exteriorNodeNames: string[] = [];
exteriorRoom.traverse((node) => exteriorNodeNames.push(node.name));
assert.ok(exteriorNodeNames.includes('NeonWorld3_GradientSky'));
assert.ok(exteriorNodeNames.includes('NeonWorld3_NightStars'));
assert.equal(exteriorNodeNames.some((name) => name.startsWith('CityBuilding_') || name.startsWith('CityWindow_')), false, 'exterior must not create fake box-building silhouettes or window squares');
exteriorController.update(0.05);
console.log('✓ Exterior avoids synthetic box-building silhouettes and retains local-time sky effects.');

const room = new THREE.Group();
addBox(room, 'Base1', [7.5, 4.25, 9.25], [0, 2.125, 0]);
addBox(room, 'Nightstand', [1, 0.35, 0.5], [-2.75, 0.775, -4.125]);
addBox(room, 'Drawer Base', [4, 0.88, 0.5], [0, 0.44, 4.38]);
addBox(room, 'Window', [0.06, 3.9, 5.9], [-3.60, 2, -1.375]);

const created = ensureModernRoomFurniture(room);
assert.ok(created.includes('BoxBed_BoxBed_Root'), 'missing source bed should be supplied by the procedural room asset');
assert.ok(created.includes('Aether_Modern_Sofa_Root'));
assert.ok(created.includes('Aether_Sliding_Wardrobe_Root'));
assert.deepEqual(ensureModernRoomFurniture(room), [], 'setup must not create duplicate furniture on repeated calls');

const layoutAudit = applyNeonWorld3SpatialLayout(room);
room.updateMatrixWorld(true);
assert.ok(layoutAudit.bedMeters, 'bed must have measurable world bounds');
assert.ok((layoutAudit.bedMeters?.[2] ?? 0) > 2.4, 'bed should have a realistic full-size sleeping length');
assert.ok(Math.abs(layoutAudit.bedFloorGapMeters ?? 1) < 0.01, 'bed must sit on the wood floor');
assert.equal(layoutAudit.outsideRoom.length, 0, `layout items must stay inside the room: ${layoutAudit.outsideRoom.join(', ')}`);

const measured = FurnitureLayoutEngine.extractAndOrganize(room, {
  companionCenter: new THREE.Vector3(0, 0, 0),
  companionSafeRadius: 0.42,
  preserveSourceAssets: true,
});
assert.equal(measured.success, true, 'room assets should be measured without cloning or re-layout');
assert.equal(measured.validationReport.passed, true, measured.validationReport.checks.map((check) => `${check.name}: ${check.details}`).join('\n'));
for (const id of ['bed_primary', 'lounge_sofa', 'reading_chair', 'sliding_wardrobe', 'lounge_table', 'floor_lamp', 'indoor_plant']) {
  assert.ok(measured.items.some((item) => item.id === id), `expected measured furniture item ${id}`);
}
console.log(`✓ Generated/reused furniture passes room-bound, floor-contact, clearance, and collision checks (${measured.items.length} measured objects).`);
console.log('=== ALL ROOM EXPERIENCE TESTS PASSED ===');
import { attachNeonWorld3TimeOfDay } from './timeOfDay';
