import { AssetManifest, MasterIndex, PreviewStatus } from '../tools/types';
import masterIndexJson from '../Manifests/index.json';
import darkIceManifest from '../Manifests/assets/char_dark_ice_c3256ebd4d660b1f.json';
import roomNManifest from '../Manifests/assets/room_n_1c2f4f69.json';
import milkDressManifest from '../Manifests/assets/outfit_milk_re165_b453c59c.json';
import mayaNegligeeManifest from '../Manifests/assets/outfit_maya_re124_0ecf7a74.json';

const rawManifests: Record<string, AssetManifest> = {
  char_dark_ice_c3256ebd4d660b1f: darkIceManifest as unknown as AssetManifest,
  room_n_1c2f4f69: roomNManifest as unknown as AssetManifest,
  outfit_milk_re165_b453c59c: milkDressManifest as unknown as AssetManifest,
  outfit_maya_re124_0ecf7a74: mayaNegligeeManifest as unknown as AssetManifest,
};

export const masterIndex: MasterIndex = masterIndexJson as unknown as MasterIndex;

/**
 * Standard MVP asset IDs in inspected order
 */
export const MVP_ASSET_IDS = [
  'char_dark_ice_c3256ebd4d660b1f',
  'room_n_1c2f4f69',
  'outfit_milk_re165_b453c59c',
  'outfit_maya_re124_0ecf7a74',
] as const;

export type MvpAssetId = (typeof MVP_ASSET_IDS)[number];

export interface AssetSummary {
  asset_id: string;
  name: string;
  category: string;
  format: string;
  preview_status: PreviewStatus;
  conversion_requirement: string | null;
  archive_name: string;
}

/**
 * Evaluates the runtime preview capability of an asset manifest.
 * Rules:
 * 1. If format is Unity-specific (unitypackage/scene) -> CONVERSION_REQUIRED.
 * 2. If format is unretargeted FBX authored for different avatar base -> CONVERSION_REQUIRED.
 * 3. If format is web-ready (VRM/GLB/glTF) but physical binary is not loaded/available -> ASSET_NOT_AVAILABLE.
 * 4. If actual web-compatible buffer or URL is provided -> WEB_READY.
 * 5. If static image thumbnail exists without 3D stream -> STATIC_PREVIEW_ONLY.
 */
export function evaluatePreviewStatus(
  manifest: AssetManifest,
  hasLive3DSource: boolean = false
): PreviewStatus {
  const format = (manifest.technical_3d?.format || '').toUpperCase();

  if (format === 'UNITYPACKAGE' || format === 'UNITY' || manifest.file_name.endsWith('.unity')) {
    return 'CONVERSION_REQUIRED';
  }

  if (format === 'FBX') {
    return 'CONVERSION_REQUIRED';
  }

  if (format === 'VRM' || format === 'GLB' || format === 'GLTF') {
    if (hasLive3DSource || manifest.preview_url) {
      return 'WEB_READY';
    }
    return 'ASSET_NOT_AVAILABLE';
  }

  if (manifest.preview_image_url) {
    return 'STATIC_PREVIEW_ONLY';
  }

  return 'NOT_DETERMINED';
}

/**
 * Retrieve an asset manifest by its stable deterministic ID
 */
export function getAssetManifest(assetId: string): AssetManifest | undefined {
  return rawManifests[assetId];
}

/**
 * Retrieve all registered MVP asset summaries for list rendering
 */
export function getRegisteredAssets(): AssetSummary[] {
  return MVP_ASSET_IDS.map((id) => {
    const m = rawManifests[id];
    const status = evaluatePreviewStatus(m, Boolean(m.preview_url));
    return {
      asset_id: id,
      name: m.semantic_name || m.file_name,
      category: m.category,
      format: m.technical_3d?.format || 'NOT_DETERMINED',
      preview_status: status,
      conversion_requirement: m.conversion_requirement || null,
      archive_name: m.original_archive,
    };
  });
}
