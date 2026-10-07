import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRM, VRMUtils } from '@pixiv/three-vrm';

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

  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();
  root.traverse((obj) => {
    if (!('geometry' in obj)) return;
    const renderable = obj as THREE.Mesh | THREE.Line | THREE.Points;
    if (renderable.geometry && !disposedGeometries.has(renderable.geometry)) {
      disposedGeometries.add(renderable.geometry);
      renderable.geometry.dispose();
    }

    const materials = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
    for (const material of materials) {
      if (material && !disposedMaterials.has(material)) {
        disposedMaterials.add(material);
        disposeMaterial(material);
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
  isVrmHint: boolean = false,
  signal?: AbortSignal
): Promise<Load3DResult> {
  return new Promise((resolve) => {
    const manager = new THREE.LoadingManager();
    const loader = new GLTFLoader(manager);
    let settled = false;

    const complete = (result: Load3DResult) => {
      if (settled) {
        if (result.success) dispose3DResource(result.vrm?.scene || result.scene);
        return;
      }
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      resolve(result);
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      manager.abort();
      resolve({ success: false, error: '3D asset loading was aborted.' });
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });

    // Register VRM Plugin if file is or might be VRM
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const onLoad = (gltf: any) => {
      try {
        const vrm: VRM | undefined = gltf.userData?.vrm;
        const scene: THREE.Object3D = vrm ? vrm.scene : gltf.scene;
        if (settled || signal?.aborted) {
          dispose3DResource(scene);
          return;
        }
        if (vrm) {
          VRMUtils.rotateVRM0(vrm);
        }

        // Ensure shadow receiving and casting
        scene.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });

        // Compute metrics
        const stats = calculateSceneMetrics(scene);

        complete({
          success: true,
          scene,
          vrm,
          stats,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown scene extraction error';
        complete({
          success: false,
          error: `Failed to initialize scene hierarchy: ${message}`,
        });
      }
    };

    const onError = (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err || 'Failed to load model');
      complete({
        success: false,
        error: `3D Loader error: ${message}`,
      });
    };

    try {
      if (typeof source === 'string') {
        const resolvedUrl = new URL(source, typeof document !== 'undefined' ? document.baseURI : undefined);
        const resourcePath = resolvedUrl.href.startsWith('data:')
          ? ''
          : resolvedUrl.href.slice(0, resolvedUrl.href.lastIndexOf('/') + 1);
        fetch(resolvedUrl.href, { signal })
          .then((response) => {
            if (!response.ok && response.status !== 0) {
              throw new Error(`Asset request failed with HTTP ${response.status}.`);
            }
            return response.arrayBuffer();
          })
          .then((data) => {
            if (settled || signal?.aborted) return;
            loader.parse(data, resourcePath, onLoad, onError);
          })
          .catch(onError);
      } else {
        loader.parse(source, '', onLoad, onError);
      }
    } catch (parseErr: unknown) {
      const message = parseErr instanceof Error ? parseErr.message : 'Parser crash';
      complete({
        success: false,
        error: `Critical loader fault: ${message}`,
      });
    }
  });
}
