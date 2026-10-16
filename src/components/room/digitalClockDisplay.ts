import * as THREE from 'three';

export interface DigitalClockDisplay {
  group: THREE.Group;
  update: () => void;
}

/** Builds a crisp, scalable 24-hour seven-segment face for the supplied clock case. */
export function createDigitalClockDisplay(caseWidth: number, caseHeight: number): DigitalClockDisplay {
  const group = new THREE.Group();
  const screenWidth = Math.max(caseWidth * 0.68, 0.16);
  const screenHeight = Math.max(caseHeight * 0.55, 0.12);
  const bezel = THREE.MathUtils.clamp(screenHeight * 0.055, 0.006, 0.014);

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x263b47,
    metalness: 0.45,
    roughness: 0.32,
    side: THREE.DoubleSide,
  });

  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0x07121a,
    emissive: 0x0a2630,
    emissiveIntensity: 0.65,
    metalness: 0.18,
    roughness: 0.28,
    side: THREE.DoubleSide,
  });

  const segmentMaterial = new THREE.MeshStandardMaterial({
    color: 0x8af7ff,
    emissive: 0x22d3ee,
    emissiveIntensity: 1.7,
    roughness: 0.22,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(screenWidth + bezel * 2, screenHeight + bezel * 2, 0.008),
    frameMaterial,
  );
  frame.position.z = -0.004;
  group.add(frame);

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(screenWidth, screenHeight, 0.004),
    panelMaterial,
  );
  panel.position.z = 0.002;
  group.add(panel);

  const digitWidth = screenWidth * 0.13;
  const digitHeight = screenHeight * 0.64;
  const gap = screenWidth * 0.04;
  const colonWidth = screenWidth * 0.035;
  const thickness = Math.min(digitWidth * 0.19, digitHeight * 0.075);
  const horizontalLength = digitWidth - thickness;
  const verticalLength = (digitHeight - thickness * 3) / 2;
  const upperY = digitHeight / 4 - thickness / 4;
  const verticalX = digitWidth / 2 - thickness / 2;

  const segmentNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;
  const patterns: Record<string, string> = {
    '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg',
    '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg',
  };

  const horizontalGeometry = new THREE.BoxGeometry(horizontalLength, thickness, 0.003);
  const verticalGeometry = new THREE.BoxGeometry(thickness, verticalLength, 0.003);

  const digitSegments: THREE.Mesh[][] = [];
  let cursor = -((digitWidth * 4 + gap * 4 + colonWidth) / 2);
  let colonX = 0;

  for (let digitIndex = 0; digitIndex < 4; digitIndex += 1) {
    if (digitIndex === 2) {
      colonX = cursor + colonWidth / 2;
      cursor += colonWidth + gap;
    }
    const digitGroup = new THREE.Group();
    digitGroup.position.x = cursor + digitWidth / 2;
    group.add(digitGroup);

    const positions: Array<[string, THREE.BufferGeometry, number, number]> = [
      ['a', horizontalGeometry, 0, digitHeight / 2 - thickness / 2],
      ['b', verticalGeometry, verticalX, upperY],
      ['c', verticalGeometry, verticalX, -upperY],
      ['d', horizontalGeometry, 0, -digitHeight / 2 + thickness / 2],
      ['e', verticalGeometry, -verticalX, -upperY],
      ['f', verticalGeometry, -verticalX, upperY],
      ['g', horizontalGeometry, 0, 0],
    ];

    const meshes = positions.map(([, geometry, x, y]) => {
      const mesh = new THREE.Mesh(geometry, segmentMaterial);
      mesh.position.set(x, y, 0.008);
      mesh.visible = false;
      digitGroup.add(mesh);
      return mesh;
    });

    digitSegments.push(meshes);
    cursor += digitWidth + gap;
  }

  const dotGeometry = new THREE.CircleGeometry(thickness * 0.48, 12);
  for (const y of [-digitHeight * 0.18, digitHeight * 0.18]) {
    const dot = new THREE.Mesh(dotGeometry, segmentMaterial);
    dot.position.set(colonX, y, 0.008);
    group.add(dot);
  }

  return {
    group,
    update: () => {
      const now = new Date();
      const digits = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      digitSegments.forEach((meshes, digitIndex) => {
        const lit = patterns[digits[digitIndex]] || '';
        meshes.forEach((mesh, segmentIndex) => {
          mesh.visible = lit.includes(segmentNames[segmentIndex]);
        });
      });
    },
  };
}
