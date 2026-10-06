import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRM } from '@pixiv/three-vrm';

export interface Load3DResult {
  success: boolean;
  scene?: THREE.Object3D;
  vrm?: VRM;
  stats?: {
    meshCount: number;
    triangleCount: number;
    vertexCount: number;
    materialCount: number;
  };
  error?: string;
}

/**
 * Traverses a 3D hierarchy and cleans up GPU resources (geometries, textures, materials)
 * to avoid memory leaks on mobile devices.
 */
export function dispose3DResource(root: THREE.Object3D | null | undefined): void {
  if (!root) return;

  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;

      if (mesh.geometry) {
        mesh.geometry.dispose();
      }

      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => disposeMaterial(mat));
        } else {
          disposeMaterial(mesh.material);
        }
      }
    }
  });

  if (root.parent) {
    root.parent.remove(root);
  }
}

function disposeMaterial(mat: THREE.Material): void {
  // Dispose any mapped textures
  const standardMat = mat as unknown as Record<string, unknown>;
  for (const key of Object.keys(standardMat)) {
    const prop = standardMat[key];
    if (prop && typeof prop === 'object' && (prop as THREE.Texture).isTexture) {
      (prop as THREE.Texture).dispose();
    }
  }
  mat.dispose();
}

/**
 * Calculates real-time geometry metrics from a loaded Three.js scene graph.
 */
export function calculateSceneMetrics(scene: THREE.Object3D): {
  meshCount: number;
  triangleCount: number;
  vertexCount: number;
  materialCount: number;
} {
  let meshCount = 0;
  let triangleCount = 0;
  let vertexCount = 0;
  const materials = new Set<THREE.Material>();

  scene.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      meshCount++;

      if (mesh.geometry) {
        const geom = mesh.geometry;
        if (geom.index) {
          triangleCount += geom.index.count / 3;
        } else if (geom.attributes.position) {
          triangleCount += geom.attributes.position.count / 3;
        }

        if (geom.attributes.position) {
          vertexCount += geom.attributes.position.count;
        }
      }

      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => materials.add(m));
        } else {
          materials.add(mesh.material);
        }
      }
    }
  });

  return {
    meshCount,
    triangleCount: Math.round(triangleCount),
    vertexCount,
    materialCount: materials.size,
  };
}

/**
 * Safely loads a glTF, GLB, or VRM 3D asset from a URL or binary ArrayBuffer.
 */
export async function loadWeb3DAsset(
  source: string | ArrayBuffer,
  isVrmHint: boolean = false
): Promise<Load3DResult> {
  return new Promise((resolve) => {
    const loader = new GLTFLoader();

    // Register VRM Plugin if file is or might be VRM
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const onLoad = (gltf: any) => {
      try {
        const vrm: VRM | undefined = gltf.userData?.vrm;
        const scene: THREE.Object3D = vrm ? vrm.scene : gltf.scene;

        // Ensure shadow receiving and casting
        scene.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });

        // Compute metrics
        const stats = calculateSceneMetrics(scene);

        resolve({
          success: true,
          scene,
          vrm,
          stats,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown scene extraction error';
        resolve({
          success: false,
          error: `Failed to initialize scene hierarchy: ${message}`,
        });
      }
    };

    const onError = (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err || 'Failed to load model');
      resolve({
        success: false,
        error: `3D Loader error: ${message}`,
      });
    };

    try {
      if (typeof source === 'string') {
        loader.load(source, onLoad, undefined, onError);
      } else {
        loader.parse(source, '', onLoad, onError);
      }
    } catch (parseErr: unknown) {
      const message = parseErr instanceof Error ? parseErr.message : 'Parser crash';
      resolve({
        success: false,
        error: `Critical loader fault: ${message}`,
      });
    }
  });
}
