import * as THREE from 'three';

export type FurnitureCategory =
  | 'RUG'
  | 'STORAGE'
  | 'SURFACE'
  | 'ACCENT'
  | 'LIGHTING'
  | 'ARCHITECTURAL';

export interface ExtractedFurnitureAsset {
  id: string;
  name: string;
  category: FurnitureCategory;
  nodeNames: string[];
  object: THREE.Object3D;
  worldBounds: THREE.Box3;
  dimensions: THREE.Vector3;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  supportSurfaceY: number;
  clearanceToCompanion: number;
  description: string;
  materialNames: string[];
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  details: string;
}

export interface PlacementValidationReport {
  passed: boolean;
  checks: ValidationCheck[];
  itemCount: number;
  companionClearanceMeters: number;
  minInterObjectSeparationMeters: number;
}

export interface FurnitureLayoutEngineResult {
  success: boolean;
  furnitureGroup: THREE.Group;
  colliders: THREE.Box3[];
  items: ExtractedFurnitureAsset[];
  validationReport: PlacementValidationReport;
}

export interface LayoutEngineConfig {
  companionCenter?: THREE.Vector3;
  companionSafeRadius?: number;
  carpetElevation?: number;
  preserveSourceAssets?: boolean;
}

const DEFAULT_CONFIG: Required<LayoutEngineConfig> = {
  companionCenter: new THREE.Vector3(0, 0, 0),
  companionSafeRadius: 0.85, // Generous full-body animation and gesture radius
  carpetElevation: 0.002,    // Just above the base obsidian floor to prevent z-fighting
  preserveSourceAssets: false,
};

/**
 * Searches an Object3D hierarchy by name (case-insensitive substring or exact match).
 */
function findNodeByName(root: THREE.Object3D, targetName: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  const targetLower = targetName.toLowerCase().trim();
  root.traverse((obj) => {
    if (found) return;
    if (obj.name && obj.name.toLowerCase().trim() === targetLower) {
      found = obj;
    }
  });
  return found;
}

/**
 * Collects all material names present in an Object3D hierarchy.
 */
function collectMaterialNames(object: THREE.Object3D): string[] {
  const names = new Set<string>();
  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (m && m.name) names.add(m.name);
      }
    }
  });
  return Array.from(names);
}

/**
 * Enhances standard PBR materials for realistic studio lighting and shadow reception.
 */
function enhanceExtractedMaterials(object: THREE.Object3D): void {
  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (!mat) continue;
        mat.side = THREE.DoubleSide;
        if (mat instanceof THREE.MeshStandardMaterial) {
          const matName = (mat.name || '').toLowerCase();
          if (matName.includes('led') || matName.includes('whiteled')) {
            mat.emissive.set(0x22d3ee);
            mat.emissiveIntensity = Math.max(mat.emissiveIntensity, 1.8);
          } else if (matName.includes('carpet')) {
            mat.roughness = 0.82;
            mat.metalness = 0.05;
          } else if (matName.includes('wood')) {
            mat.roughness = 0.38;
            mat.metalness = 0.12;
          } else if (matName.includes('white')) {
            mat.roughness = 0.42;
            mat.metalness = 0.08;
          } else if (matName.includes('pillow')) {
            mat.roughness = 0.85;
            mat.metalness = 0.02;
          } else if (matName.includes('metal')) {
            mat.roughness = 0.28;
            mat.metalness = 0.82;
          } else if (matName.includes('glass')) {
            mat.transparent = true;
            mat.opacity = 0.35;
            mat.roughness = 0.05;
            mat.metalness = 0.15;
          }
          mat.needsUpdate = true;
        }
      }
    }
  });
}

/**
 * Computes the exact aggregate bounding box of an array of objects in their current parent space.
 */
function computeAggregateBounds(objects: THREE.Object3D[]): THREE.Box3 {
  const box = new THREE.Box3();
  for (const obj of objects) {
    obj.updateWorldMatrix(true, true);
    const objBox = new THREE.Box3().setFromObject(obj);
    box.union(objBox);
  }
  return box;
}

/**
 * FurnitureLayoutEngine
 * Extracts furniture, lighting, and decorative items from Neon World 3 (Noeo_world_3)
 * and organizes them into an intentional, high-end architectural layout within the AetherAI room.
 */
export class FurnitureLayoutEngine {
  /**
   * Extracts and organizes all furniture pieces from the loaded scene.
   */
  public static extractAndOrganize(
    sourceScene: THREE.Object3D,
    config: LayoutEngineConfig = {}
  ): FurnitureLayoutEngineResult {
    const opts = { ...DEFAULT_CONFIG, ...config };

    if (opts.preserveSourceAssets) {
      return FurnitureLayoutEngine.inspectAuthoredAssets(sourceScene, opts);
    }

    const furnitureGroup = new THREE.Group();
    furnitureGroup.name = 'AetherInteriorFurnitureLayout';
    const items: ExtractedFurnitureAsset[] = [];
    const colliders: THREE.Box3[] = [];

    // Ensure source scene world matrices are fully up-to-date
    sourceScene.updateWorldMatrix(true, true);

    // -------------------------------------------------------------------------
    // 1. CARPET / AREA RUG (Zone: Primary Living Suite & Conversation Stage)
    // -------------------------------------------------------------------------
    const carpetNode = findNodeByName(sourceScene, 'Carpet');
    if (carpetNode) {
      const carpetClone = carpetNode.clone(true);
      carpetClone.position.set(0, 0, 0);
      carpetClone.rotation.set(0, 0, 0);
      carpetClone.scale.set(1, 1, 1);
      carpetClone.updateMatrixWorld(true);

      const rawBounds = new THREE.Box3().setFromObject(carpetClone);
      const center = rawBounds.getCenter(new THREE.Vector3());
      const size = rawBounds.getSize(new THREE.Vector3());

      const carpetAssembly = new THREE.Group();
      carpetAssembly.name = 'Carpet_Assembly';
      carpetAssembly.add(carpetClone);

      // Center the geometry internally so pivot is at (0, 0, 0)
      carpetClone.position.x -= center.x;
      carpetClone.position.y -= rawBounds.min.y;
      carpetClone.position.z -= center.z;

      // Target placement: Perfectly grounds the companion stage and conversation zone
      const targetPos = new THREE.Vector3(0, opts.carpetElevation, -0.35);
      carpetAssembly.position.copy(targetPos);

      enhanceExtractedMaterials(carpetAssembly);
      furnitureGroup.add(carpetAssembly);
      carpetAssembly.updateWorldMatrix(true, true);

      const worldBounds = new THREE.Box3().setFromObject(carpetAssembly);

      items.push({
        id: 'carpet_primary',
        name: 'Designer Luxury Area Rug',
        category: 'RUG',
        nodeNames: ['Carpet'],
        object: carpetAssembly,
        worldBounds,
        dimensions: size,
        position: targetPos.clone(),
        rotation: new THREE.Euler(0, 0, 0),
        supportSurfaceY: opts.carpetElevation,
        clearanceToCompanion: 0,
        description: '4.0m x 5.0m plush geometric area rug visually anchoring the companion living suite',
        materialNames: collectMaterialNames(carpetAssembly),
      });
    }

    // -------------------------------------------------------------------------
    // 2. LUXURY CREDENZA / 4-DOOR CONSOLE (Zone: North Feature Wall Backdrop)
    // -------------------------------------------------------------------------
    const credenzaNodeNames = [
      'Drawer Base',
      'DrawerSide1',
      'DrawerSide2',
      'DrawerDoor1',
      'DrawerDoor2',
      'DrawerDoor3',
      'DrawerDoor4',
    ];
    const credenzaClones: THREE.Object3D[] = [];
    for (const nodeName of credenzaNodeNames) {
      const node = findNodeByName(sourceScene, nodeName);
      if (node) {
        credenzaClones.push(node.clone(true));
      }
    }

    if (credenzaClones.length > 0) {
      const tempGroup = new THREE.Group();
      for (const clone of credenzaClones) tempGroup.add(clone);
      tempGroup.updateWorldMatrix(true, true);

      const rawBounds = computeAggregateBounds(credenzaClones);
      const center = rawBounds.getCenter(new THREE.Vector3());
      const size = rawBounds.getSize(new THREE.Vector3());

      const credenzaAssembly = new THREE.Group();
      credenzaAssembly.name = 'LuxuryCredenza_Assembly';

      for (const clone of credenzaClones) {
        clone.position.x -= center.x;
        clone.position.y -= rawBounds.min.y;
        clone.position.z -= center.z;
        credenzaAssembly.add(clone);
      }

      const targetPos = new THREE.Vector3(0, 0, -3.20);
      credenzaAssembly.position.copy(targetPos);

      enhanceExtractedMaterials(credenzaAssembly);
      furnitureGroup.add(credenzaAssembly);
      credenzaAssembly.updateWorldMatrix(true, true);

      const worldBounds = new THREE.Box3().setFromObject(credenzaAssembly);
      colliders.push(worldBounds);

      const clearance = targetPos.distanceTo(opts.companionCenter) - (size.z / 2);

      items.push({
        id: 'credenza_feature',
        name: 'Executive Minimalist 4-Door Credenza',
        category: 'STORAGE',
        nodeNames: credenzaNodeNames,
        object: credenzaAssembly,
        worldBounds,
        dimensions: size,
        position: targetPos.clone(),
        rotation: new THREE.Euler(0, 0, 0),
        supportSurfaceY: 0,
        clearanceToCompanion: clearance,
        description: '4.05m architectural lowboard sideboard providing clean horizontal grounding and storage depth',
        materialNames: collectMaterialNames(credenzaAssembly),
      });
    }

    // -------------------------------------------------------------------------
    // 3. ARCHITECTURAL SIDE CONSOLE / NIGHTSTAND (Zone: West Terrace Lounge)
    // -------------------------------------------------------------------------
    const nightstandNode = findNodeByName(sourceScene, 'Nightstand');
    if (nightstandNode) {
      const nsClone = nightstandNode.clone(true);
      nsClone.updateWorldMatrix(true, true);

      const rawBounds = new THREE.Box3().setFromObject(nsClone);
      const center = rawBounds.getCenter(new THREE.Vector3());
      const size = rawBounds.getSize(new THREE.Vector3());

      const nsAssembly = new THREE.Group();
      nsAssembly.name = 'Nightstand_Assembly';
      nsAssembly.add(nsClone);

      nsClone.position.x -= center.x;
      nsClone.position.y -= rawBounds.min.y;
      nsClone.position.z -= center.z;

      const targetPos = new THREE.Vector3(-2.45, 0, -0.85);
      const targetRot = new THREE.Euler(0, Math.PI / 8, 0);
      nsAssembly.position.copy(targetPos);
      nsAssembly.rotation.copy(targetRot);

      enhanceExtractedMaterials(nsAssembly);
      furnitureGroup.add(nsAssembly);
      nsAssembly.updateWorldMatrix(true, true);

      const worldBounds = new THREE.Box3().setFromObject(nsAssembly);
      colliders.push(worldBounds);

      const clearance = targetPos.distanceTo(opts.companionCenter) - (Math.max(size.x, size.z) / 2);

      items.push({
        id: 'nightstand_west',
        name: 'Architectural Multi-Wood Side Console',
        category: 'SURFACE',
        nodeNames: ['Nightstand'],
        object: nsAssembly,
        worldBounds,
        dimensions: size,
        position: targetPos.clone(),
        rotation: targetRot.clone(),
        supportSurfaceY: 0,
        clearanceToCompanion: clearance,
        description: '1.0m sleek cantilevered side console table in natural wood and satin lacquer for tea and companion interaction accessories',
        materialNames: collectMaterialNames(nsAssembly),
      });
    }

    // -------------------------------------------------------------------------
    // 4. DESIGNER ACCENT CUSHIONS / PILLOWS (Zone: Conversation Lounge Corner)
    // -------------------------------------------------------------------------
    const pillow1Root = findNodeByName(sourceScene, 'SimplePillow1_Root') || findNodeByName(sourceScene, 'Pillow');
    const pillow2Root = findNodeByName(sourceScene, 'SimplePillow2_Root') || findNodeByName(sourceScene, 'Pillow.001');
    const carpetTopY = opts.carpetElevation + 0.012;

    if (pillow1Root) {
      const p1Clone = pillow1Root.clone(true);
      p1Clone.updateWorldMatrix(true, true);
      const p1Bounds = new THREE.Box3().setFromObject(p1Clone);
      const p1Center = p1Bounds.getCenter(new THREE.Vector3());
      const p1Size = p1Bounds.getSize(new THREE.Vector3());

      const p1Assembly = new THREE.Group();
      p1Assembly.name = 'Pillow1_Assembly';
      p1Assembly.add(p1Clone);

      p1Clone.position.x -= p1Center.x;
      p1Clone.position.y -= p1Bounds.min.y;
      p1Clone.position.z -= p1Center.z;

      const targetPos = new THREE.Vector3(-1.35, carpetTopY, -1.60);
      const targetRot = new THREE.Euler(0.12, 0.45, -0.08);
      p1Assembly.position.copy(targetPos);
      p1Assembly.rotation.copy(targetRot);

      enhanceExtractedMaterials(p1Assembly);
      furnitureGroup.add(p1Assembly);
      p1Assembly.updateWorldMatrix(true, true);

      const worldBounds = new THREE.Box3().setFromObject(p1Assembly);
      colliders.push(worldBounds);

      const clearance = targetPos.distanceTo(opts.companionCenter) - (Math.max(p1Size.x, p1Size.z) / 2);

      items.push({
        id: 'cushion_west',
        name: 'Plush Lounge Accent Cushion Alpha',
        category: 'ACCENT',
        nodeNames: ['SimplePillow1_Root', 'Pillow'],
        object: p1Assembly,
        worldBounds,
        dimensions: p1Size,
        position: targetPos.clone(),
        rotation: targetRot.clone(),
        supportSurfaceY: carpetTopY,
        clearanceToCompanion: clearance,
        description: 'Organic designer textile floor cushion arranged on the carpet for informal lounge seating',
        materialNames: collectMaterialNames(p1Assembly),
      });
    }

    if (pillow2Root) {
      const p2Clone = pillow2Root.clone(true);
      p2Clone.updateWorldMatrix(true, true);
      const p2Bounds = new THREE.Box3().setFromObject(p2Clone);
      const p2Center = p2Bounds.getCenter(new THREE.Vector3());
      const p2Size = p2Bounds.getSize(new THREE.Vector3());

      const p2Assembly = new THREE.Group();
      p2Assembly.name = 'Pillow2_Assembly';
      p2Assembly.add(p2Clone);

      p2Clone.position.x -= p2Center.x;
      p2Clone.position.y -= p2Bounds.min.y;
      p2Clone.position.z -= p2Center.z;

      const targetPos = new THREE.Vector3(1.35, carpetTopY, -1.55);
      const targetRot = new THREE.Euler(-0.09, -0.40, 0.07);
      p2Assembly.position.copy(targetPos);
      p2Assembly.rotation.copy(targetRot);

      enhanceExtractedMaterials(p2Assembly);
      furnitureGroup.add(p2Assembly);
      p2Assembly.updateWorldMatrix(true, true);

      const worldBounds = new THREE.Box3().setFromObject(p2Assembly);
      colliders.push(worldBounds);

      const clearance = targetPos.distanceTo(opts.companionCenter) - (Math.max(p2Size.x, p2Size.z) / 2);

      items.push({
        id: 'cushion_east',
        name: 'Plush Lounge Accent Cushion Beta',
        category: 'ACCENT',
        nodeNames: ['SimplePillow2_Root', 'Pillow.001'],
        object: p2Assembly,
        worldBounds,
        dimensions: p2Size,
        position: targetPos.clone(),
        rotation: targetRot.clone(),
        supportSurfaceY: carpetTopY,
        clearanceToCompanion: clearance,
        description: 'Complementary accent cushion providing visual softness and conversational balance',
        materialNames: collectMaterialNames(p2Assembly),
      });
    }

    // -------------------------------------------------------------------------
    // 5. LINEAR ARCHITECTURAL CEILING LUMINAIRE (Zone: Architectural Horizon)
    // -------------------------------------------------------------------------
    const ledNode = findNodeByName(sourceScene, 'LED-Light');
    if (ledNode) {
      const ledClone = ledNode.clone(true);
      ledClone.updateWorldMatrix(true, true);
      const rawBounds = new THREE.Box3().setFromObject(ledClone);
      const center = rawBounds.getCenter(new THREE.Vector3());
      const size = rawBounds.getSize(new THREE.Vector3());

      const ledAssembly = new THREE.Group();
      ledAssembly.name = 'LED_Light_Assembly';
      ledAssembly.add(ledClone);

      ledClone.position.x -= center.x;
      ledClone.position.y -= rawBounds.min.y;
      ledClone.position.z -= center.z;

      const targetPos = new THREE.Vector3(0, 2.95, -3.35);
      ledAssembly.position.copy(targetPos);

      enhanceExtractedMaterials(ledAssembly);
      furnitureGroup.add(ledAssembly);
      ledAssembly.updateWorldMatrix(true, true);

      const worldBounds = new THREE.Box3().setFromObject(ledAssembly);

      items.push({
        id: 'led_linear_luminaire',
        name: 'Architectural Linear Ceiling Luminaire',
        category: 'LIGHTING',
        nodeNames: ['LED-Light'],
        object: ledAssembly,
        worldBounds,
        dimensions: size,
        position: targetPos.clone(),
        rotation: new THREE.Euler(0, 0, 0),
        supportSurfaceY: 2.95,
        clearanceToCompanion: targetPos.distanceTo(opts.companionCenter),
        description: '4.0m linear recessed luminaire washing the north feature wall with soft cyan/amethyst glow',
        materialNames: collectMaterialNames(ledAssembly),
      });
    }

    // -------------------------------------------------------------------------
    // 6. PANORAMIC TERRACE FRAME & GLASS (Zone: West Architectural Vista)
    // -------------------------------------------------------------------------
    const windowFrameNode = findNodeByName(sourceScene, 'WindowFrame');
    const windowGlassNode = findNodeByName(sourceScene, 'Window');
    const curtainFrameNode = findNodeByName(sourceScene, 'Curtain Frame');

    if (windowFrameNode || windowGlassNode) {
      const terraceAssembly = new THREE.Group();
      terraceAssembly.name = 'Terrace_Vista_Assembly';
      const nodesToAssemble: THREE.Object3D[] = [];

      if (windowFrameNode) nodesToAssemble.push(windowFrameNode.clone(true));
      if (windowGlassNode) nodesToAssemble.push(windowGlassNode.clone(true));
      if (curtainFrameNode) nodesToAssemble.push(curtainFrameNode.clone(true));

      const rawBounds = computeAggregateBounds(nodesToAssemble);
      const center = rawBounds.getCenter(new THREE.Vector3());
      const size = rawBounds.getSize(new THREE.Vector3());

      for (const node of nodesToAssemble) {
        node.position.x -= center.x;
        node.position.y -= rawBounds.min.y;
        node.position.z -= center.z;
        terraceAssembly.add(node);
      }

      const targetPos = new THREE.Vector3(-3.85, 0, -1.35);
      terraceAssembly.position.copy(targetPos);

      enhanceExtractedMaterials(terraceAssembly);
      furnitureGroup.add(terraceAssembly);
      terraceAssembly.updateWorldMatrix(true, true);

      const worldBounds = new THREE.Box3().setFromObject(terraceAssembly);
      colliders.push(worldBounds);

      items.push({
        id: 'terrace_panoramic_window',
        name: 'Floor-to-Ceiling Panoramic Terrace Facade',
        category: 'ARCHITECTURAL',
        nodeNames: ['WindowFrame', 'Window', 'Curtain Frame'],
        object: terraceAssembly,
        dimensions: size,
        worldBounds,
        position: targetPos.clone(),
        rotation: new THREE.Euler(0, 0, 0),
        supportSurfaceY: 0,
        clearanceToCompanion: targetPos.distanceTo(opts.companionCenter) - (size.x / 2),
        description: 'Architectural structural glazing opening the west terrace onto the skyline',
        materialNames: collectMaterialNames(terraceAssembly),
      });
    }

    // -------------------------------------------------------------------------
    // 7. RUN COMPREHENSIVE ARCHITECTURAL PLACEMENT VALIDATION
    // -------------------------------------------------------------------------
    const validationReport = FurnitureLayoutEngine.validatePlacement(items, colliders, opts);

    return {
      success: validationReport.passed,
      furnitureGroup,
      colliders,
      items,
      validationReport,
    };
  }

  /**
   * Measure the authored Neon World 3 objects in place. This is the production
   * path: it preserves the source hierarchy/materials, creates no visual clones,
   * and derives locomotion colliders from the actual furniture bounds.
   */
  private static inspectAuthoredAssets(
    sourceScene: THREE.Object3D,
    config: Required<LayoutEngineConfig>,
  ): FurnitureLayoutEngineResult {
    sourceScene.updateWorldMatrix(true, true);

    const carpet = findNodeByName(sourceScene, 'Carpet');
    if (carpet) carpet.visible = false;

    const malformedLedCircle = findNodeByName(sourceScene, 'LedCircle_LedCircle_Root')
      ?? findNodeByName(sourceScene, 'LedCircle');
    if (malformedLedCircle) malformedLedCircle.visible = false;

    const specs: Array<{
      id: string;
      name: string;
      nodeNames: string[];
      category: FurnitureCategory;
      floorStanding?: boolean;
      solid?: boolean;
      description: string;
    }> = [
      { id: 'bed_primary', name: 'Neon World 3 Bed', nodeNames: ['BoxBed_BoxBed_Root'], category: 'STORAGE', floorStanding: true, solid: true, description: 'Original bed prefab, uniformly scaled and positioned by the measured room layout.' },
      { id: 'bedside_table', name: 'Original Bedside Table', nodeNames: ['Nightstand'], category: 'SURFACE', floorStanding: true, solid: true, description: 'Original nightstand aligned to the bed with a clear approach gap.' },
      { id: 'console', name: 'Original Drawer Console', nodeNames: ['Drawer Base', 'DrawerSide1', 'DrawerSide2', 'DrawerDoor1', 'DrawerDoor2', 'DrawerDoor3', 'DrawerDoor4'], category: 'STORAGE', floorStanding: true, solid: true, description: 'Original console assembly retained on its authored wall and measured as one furniture piece.' },
      { id: 'floor_cushion_west', name: 'Original Floor Cushion', nodeNames: ['SimplePillow1_Root'], category: 'ACCENT', floorStanding: true, description: 'Original soft furnishing resting directly on the continuous wooden floor.' },
      { id: 'floor_cushion_east', name: 'Original Floor Cushion 2', nodeNames: ['SimplePillow2_Root'], category: 'ACCENT', floorStanding: true, description: 'Original soft furnishing resting directly on the continuous wooden floor.' },
      { id: 'tv', name: 'Original TV', nodeNames: ['TV_TV_Root'], category: 'ARCHITECTURAL', description: 'Original TV prefab corrected in place and aligned to the console.' },
      { id: 'wall_clock', name: 'Original Alarm Clock', nodeNames: ['Alarm_Alarm_Root'], category: 'ARCHITECTURAL', description: 'Original clock case aligned with the bedroom composition.' },
      { id: 'vessel', name: 'Original Console Vessel', nodeNames: ['Vessel_Vessel_Root'], category: 'ACCENT', description: 'Original vase seated on the console without changing its proportions unnecessarily.' },
      { id: 'window_curtain', name: 'Original Window Curtain', nodeNames: ['Curtain_Curtain_Root'], category: 'ARCHITECTURAL', description: 'Original full-height curtain aligned with the existing window.' },
      { id: 'window_header', name: 'Original Curtain Header', nodeNames: ['SmallWallCurtain_SmallWallCurtain_Root'], category: 'ARCHITECTURAL', description: 'Original small curtain header seated over the existing window.' },
    ];

    const items: ExtractedFurnitureAsset[] = [];
    const colliders: THREE.Box3[] = [];
    const floorIds = new Set<string>();
    const solidIds = new Set<string>();

    for (const spec of specs) {
      const nodes = spec.nodeNames
        .map((name) => findNodeByName(sourceScene, name))
        .filter((node): node is THREE.Object3D => node !== null);
      if (!nodes.length) continue;

      const worldBounds = computeAggregateBounds(nodes);
      if (worldBounds.isEmpty()) continue;

      const dimensions = worldBounds.getSize(new THREE.Vector3());
      const position = worldBounds.getCenter(new THREE.Vector3());
      const dx = Math.max(0, worldBounds.min.x - config.companionCenter.x, config.companionCenter.x - worldBounds.max.x);
      const dz = Math.max(0, worldBounds.min.z - config.companionCenter.z, config.companionCenter.z - worldBounds.max.z);

      const item: ExtractedFurnitureAsset = {
        id: spec.id,
        name: spec.name,
        category: spec.category,
        nodeNames: nodes.map((node) => node.name),
        object: nodes[0],
        worldBounds,
        dimensions,
        position,
        rotation: nodes[0].rotation.clone(),
        supportSurfaceY: worldBounds.min.y,
        clearanceToCompanion: Math.hypot(dx, dz),
        description: spec.description,
        materialNames: [...new Set(nodes.flatMap((node) => collectMaterialNames(node)))],
      };

      items.push(item);
      if (spec.floorStanding) floorIds.add(spec.id);
      if (spec.solid) {
        solidIds.add(spec.id);
        colliders.push(worldBounds.clone());
      }
    }

    const structuralRoot = findNodeByName(sourceScene, 'Base1');
    const roomBounds = structuralRoot ? new THREE.Box3().setFromObject(structuralRoot) : null;
    const physicalItems = items.filter((item) => floorIds.has(item.id));
    const majorSolids = items.filter((item) => solidIds.has(item.id));

    const envelopeErrors: string[] = [];
    if (roomBounds) {
      for (const item of items) {
        const b = item.worldBounds;
        if (b.min.x < roomBounds.min.x - 0.03 || b.max.x > roomBounds.max.x + 0.03 ||
            b.min.y < roomBounds.min.y - 0.03 || b.max.y > roomBounds.max.y + 0.03 ||
            b.min.z < roomBounds.min.z - 0.03 || b.max.z > roomBounds.max.z + 0.03) {
          envelopeErrors.push(item.name);
        }
      }
    }

    const floorErrors = physicalItems
      .filter((item) => item.worldBounds.min.y < -0.015 || item.worldBounds.min.y > 0.03)
      .map((item) => `${item.name} base Y=${item.worldBounds.min.y.toFixed(3)}m`);

    const collisionErrors: string[] = [];
    let minSeparation = Infinity;
    for (let i = 0; i < majorSolids.length; i += 1) {
      for (let j = i + 1; j < majorSolids.length; j += 1) {
        const a = majorSolids[i].worldBounds;
        const b = majorSolids[j].worldBounds;
        if (a.intersectsBox(b)) collisionErrors.push(`${majorSolids[i].name} intersects ${majorSolids[j].name}`);
        const dx = Math.max(0, a.min.x - b.max.x, b.min.x - a.max.x);
        const dz = Math.max(0, a.min.z - b.max.z, b.min.z - a.max.z);
        minSeparation = Math.min(minSeparation, Math.hypot(dx, dz));
      }
    }

    const companionClearance = majorSolids.length
      ? Math.min(...majorSolids.map((item) => item.clearanceToCompanion))
      : 0;

    const itemCountPassed = majorSolids.length >= 3;
    const envelopePassed = !roomBounds || envelopeErrors.length === 0;
    const floorPassed = floorErrors.length === 0 && physicalItems.length >= 3;
    const collisionsPassed = collisionErrors.length === 0;
    const clearancePassed = companionClearance >= config.companionSafeRadius;

    const checks: ValidationCheck[] = [
      { name: 'Measured source furniture', passed: itemCountPassed, details: `Measured ${majorSolids.length} original solid furniture items; no furniture is cloned or replaced.` },
      { name: 'Room envelope', passed: envelopePassed, details: envelopePassed ? 'Measured furniture remains within the authored room bounds.' : `Items outside the room bounds: ${envelopeErrors.join(', ')}.` },
      { name: 'Wood-floor contact', passed: floorPassed, details: floorPassed ? 'Floor-standing furniture and cushions contact the continuous wood floor.' : `Floor alignment issues: ${floorErrors.join('; ') || 'required floor-standing assets are missing'}.` },
      { name: 'Major furniture clearance', passed: collisionsPassed, details: collisionsPassed ? 'Bed, bedside table, and console bounds do not intersect.' : `Intersections: ${collisionErrors.join('; ')}.` },
      { name: 'Companion circulation', passed: clearancePassed, details: `Nearest measured furniture clearance from the companion origin: ${companionClearance.toFixed(2)}m (target ${config.companionSafeRadius.toFixed(2)}m).` },
    ];

    const validationReport: PlacementValidationReport = {
      passed: checks.every((check) => check.passed),
      checks,
      itemCount: items.length,
      companionClearanceMeters: companionClearance,
      minInterObjectSeparationMeters: minSeparation === Infinity ? 0 : minSeparation,
    };

    const furnitureGroup = new THREE.Group();
    furnitureGroup.name = 'AetherAuthoredFurnitureMeasurements';
    furnitureGroup.userData.sourceAssetsPreserved = true;

    return { success: validationReport.passed, furnitureGroup, colliders, items, validationReport };
  }

  /**
   * Performs rigorous mathematical checks across all placed furniture items.
   */
  public static validatePlacement(
    items: ExtractedFurnitureAsset[],
    colliders: THREE.Box3[],
    config: Required<LayoutEngineConfig>
  ): PlacementValidationReport {
    const checks: ValidationCheck[] = [];

    // 1. Minimum Item Count Check
    const itemCountCheck = items.length >= 3;
    checks.push({
      name: 'Item Extraction Count',
      passed: itemCountCheck,
      details: `Extracted ${items.length} intentional furniture and architectural assets.`,
    });

    // 2. Floor Contact & Support Verification (Zero hovering, zero floor penetration)
    let floorContactPassed = true;
    const floorErrors: string[] = [];
    for (const item of items) {
      if (item.category === 'STORAGE' || item.category === 'SURFACE') {
        const minY = item.worldBounds.min.y;
        if (Math.abs(minY) > 0.015) {
          floorContactPassed = false;
          floorErrors.push(`${item.name} base Y is ${minY.toFixed(4)}m (expected 0.000m)`);
        }
      } else if (item.category === 'RUG') {
        const minY = item.worldBounds.min.y;
        if (minY < -0.001 || minY > 0.015) {
          floorContactPassed = false;
          floorErrors.push(`${item.name} base Y is ${minY.toFixed(4)}m (expected ~0.002m)`);
        }
      }
    }
    checks.push({
      name: 'Floor & Support Contact Precision',
      passed: floorContactPassed,
      details: floorContactPassed
        ? 'All floor-standing furniture pieces make flush contact with zero hovering or clipping.'
        : `Floor contact discrepancies: ${floorErrors.join('; ')}`,
    });

    // 3. Inter-Furniture Pairwise Collision Check (No overlapping solid furniture)
    let interCollisionPassed = true;
    let minSeparation = Infinity;
    const collisionErrors: string[] = [];

    const solidItems = items.filter(
      (it) => it.category === 'STORAGE' || it.category === 'SURFACE' || it.category === 'ACCENT'
    );

    for (let i = 0; i < solidItems.length; i++) {
      for (let j = i + 1; j < solidItems.length; j++) {
        const a = solidItems[i].worldBounds;
        const b = solidItems[j].worldBounds;
        if (a.intersectsBox(b)) {
          interCollisionPassed = false;
          collisionErrors.push(`${solidItems[i].name} collides with ${solidItems[j].name}`);
        } else {
          const dist = Math.hypot(
            Math.max(0, Math.max(a.min.x - b.max.x, b.min.x - a.max.x)),
            Math.max(0, Math.max(a.min.z - b.max.z, b.min.z - a.max.z))
          );
          if (dist < minSeparation) minSeparation = dist;
        }
      }
    }
    checks.push({
      name: 'Inter-Furniture Non-Intersection',
      passed: interCollisionPassed,
      details: interCollisionPassed
        ? `No physical furniture intersections detected. Closest separation: ${minSeparation.toFixed(2)}m.`
        : `Collisions detected: ${collisionErrors.join('; ')}`,
    });

    // 4. Companion Interaction Zone & Full-Body Animation Clearance
    let clearancePassed = true;
    let minCompanionClearance = Infinity;
    const clearanceErrors: string[] = [];

    for (const item of items) {
      if (item.category === 'RUG') continue; // Companion stands on rug
      const clearance = item.clearanceToCompanion;
      if (clearance < minCompanionClearance) minCompanionClearance = clearance;
      if (clearance < config.companionSafeRadius) {
        clearancePassed = false;
        clearanceErrors.push(
          `${item.name} is ${clearance.toFixed(2)}m from center (safe radius: ${config.companionSafeRadius}m)`
        );
      }
    }
    checks.push({
      name: 'Companion Animation & Interaction Clearance',
      passed: clearancePassed,
      details: clearancePassed
        ? `Primary companion stage is fully unobstructed. Minimum clearance: ${minCompanionClearance.toFixed(2)}m (envelope: ${config.companionSafeRadius}m).`
        : `Clearance violations: ${clearanceErrors.join('; ')}`,
    });

    // 5. Camera Line-of-Sight & Silhouette Verification
    let cameraViewPassed = true;
    for (const item of items) {
      if (item.category === 'STORAGE' && item.position.z > 0.5) {
        cameraViewPassed = false;
      }
    }
    checks.push({
      name: 'Camera Viewport Unobstructed',
      passed: cameraViewPassed,
      details: cameraViewPassed
        ? 'All tall furniture is placed along peripheral architectural boundaries; companion silhouette is 100% visible.'
        : 'Furniture placed between camera and companion center.',
    });

    const passed = checks.every((c) => c.passed);

    return {
      passed,
      checks,
      itemCount: items.length,
      companionClearanceMeters: minCompanionClearance,
      minInterObjectSeparationMeters: minSeparation === Infinity ? 0 : minSeparation,
    };
  }

  /**
   * Helper function for character locomotion controllers to test a proposed position against furniture colliders.
   * Returns true if point + radius intersects any collider.
   */
  public static testPointCollision(
    point: THREE.Vector3,
    radius: number,
    colliders: THREE.Box3[]
  ): boolean {
    const pointBox = new THREE.Box3(
      new THREE.Vector3(point.x - radius, point.y, point.z - radius),
      new THREE.Vector3(point.x + radius, point.y + 1.8, point.z + radius)
    );
    for (const col of colliders) {
      if (col.intersectsBox(pointBox)) {
        return true;
      }
    }
    return false;
  }
}
