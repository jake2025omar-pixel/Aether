import { AssetCategory, ConfidenceLevel } from './types';

export interface ClassificationResult {
  category: AssetCategory;
  confidence: ConfidenceLevel;
  reason: string;
}

const MODEL_EXTENSIONS = new Set([
  '.fbx',
  '.obj',
  '.gltf',
  '.glb',
  '.vrm',
  '.pmx',
  '.pmd',
  '.blend',
  '.dae',
  '.3ds',
  '.max',
  '.c4d',
  '.stl',
]);

const TEXTURE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.tga',
  '.dds',
  '.bmp',
  '.webp',
  '.psd',
  '.tif',
  '.tiff',
  '.exr',
  '.hdr',
]);

const MATERIAL_EXTENSIONS = new Set([
  '.mtl',
  '.mat',
  '.material',
  '.fx',
  '.hlsl',
  '.glsl',
]);

const ANIMATION_EXTENSIONS = new Set([
  '.bvh',
  '.vmd',
  '.anim',
  '.bip',
  '.motion',
]);

const AUDIO_EXTENSIONS = new Set([
  '.wav',
  '.mp3',
  '.ogg',
  '.flac',
  '.m4a',
  '.aac',
]);

const CONFIG_EXTENSIONS = new Set([
  '.json',
  '.xml',
  '.yaml',
  '.yml',
  '.ini',
  '.cfg',
  '.txt',
  '.csv',
]);

/**
 * Classifies an asset by internal path and file extension.
 * Never invents information; clearly separates DETECTED, INFERRED, NOT_DETERMINED, UNCONFIRMED.
 */
export function classifyAsset(internalPath: string): ClassificationResult {
  const normPath = internalPath.toLowerCase().replace(/\\/g, '/');
  const fileName = normPath.split('/').pop() || '';
  const ext = fileName.includes('.') ? '.' + fileName.split('.').pop()! : '';

  // 1. Direct extension matches (DETECTED)
  if (TEXTURE_EXTENSIONS.has(ext)) {
    return { category: 'TEXTURE', confidence: 'DETECTED', reason: `Image/texture file extension "${ext}"` };
  }
  if (MATERIAL_EXTENSIONS.has(ext)) {
    return { category: 'MATERIAL', confidence: 'DETECTED', reason: `Material file extension "${ext}"` };
  }
  if (ANIMATION_EXTENSIONS.has(ext)) {
    const isMotion = normPath.includes('motion') || normPath.includes('dance');
    return {
      category: isMotion ? 'MOTION' : 'ANIMATION',
      confidence: 'DETECTED',
      reason: `Motion/Animation file extension "${ext}"`,
    };
  }
  if (AUDIO_EXTENSIONS.has(ext)) {
    const isMusic = normPath.includes('bgm') || normPath.includes('music') || normPath.includes('song');
    return {
      category: isMusic ? 'MUSIC' : 'AUDIO',
      confidence: 'DETECTED',
      reason: `Audio file extension "${ext}"`,
    };
  }
  if (CONFIG_EXTENSIONS.has(ext)) {
    return { category: 'CONFIG', confidence: 'DETECTED', reason: `Configuration file extension "${ext}"` };
  }

  // 2. 3D Model extension detection and semantic path inference
  if (MODEL_EXTENSIONS.has(ext)) {
    // Specific path pattern checks (INFERRED)
    if (
      normPath.includes('/character') ||
      normPath.includes('/char/') ||
      normPath.includes('/miku') ||
      normPath.includes('/avatar') ||
      normPath.includes('figure')
    ) {
      return { category: 'CHARACTER', confidence: 'INFERRED', reason: `3D model in character directory/name: "${normPath}"` };
    }
    if (
      normPath.includes('/room') ||
      normPath.includes('/bedroom') ||
      normPath.includes('/house') ||
      normPath.includes('/interior')
    ) {
      return { category: 'ROOM', confidence: 'INFERRED', reason: `3D model in room/interior path: "${normPath}"` };
    }
    if (
      normPath.includes('/environment') ||
      normPath.includes('/env/') ||
      normPath.includes('/stage') ||
      normPath.includes('/world')
    ) {
      return { category: 'ENVIRONMENT', confidence: 'INFERRED', reason: `3D model in environment/stage path: "${normPath}"` };
    }
    if (
      normPath.includes('/furniture') ||
      normPath.includes('/chair') ||
      normPath.includes('/desk') ||
      normPath.includes('/table') ||
      normPath.includes('/bed')
    ) {
      return { category: 'FURNITURE', confidence: 'INFERRED', reason: `3D model in furniture path: "${normPath}"` };
    }
    if (
      normPath.includes('/outfit') ||
      normPath.includes('/costume') ||
      normPath.includes('/cloth') ||
      normPath.includes('/dress')
    ) {
      return { category: 'OUTFIT', confidence: 'INFERRED', reason: `3D model in outfit/costume path: "${normPath}"` };
    }
    if (normPath.includes('/hair')) {
      return { category: 'HAIR', confidence: 'INFERRED', reason: `3D model in hair path: "${normPath}"` };
    }
    if (normPath.includes('/accessory') || normPath.includes('/acc/')) {
      return { category: 'ACCESSORY', confidence: 'INFERRED', reason: `3D model in accessory path: "${normPath}"` };
    }
    if (normPath.includes('/prop')) {
      return { category: 'PROP', confidence: 'INFERRED', reason: `3D model in prop path: "${normPath}"` };
    }

    return { category: 'MODEL', confidence: 'DETECTED', reason: `Generic 3D model file extension "${ext}"` };
  }

  // 3. Fallback when cannot be determined
  return {
    category: 'NOT_DETERMINED',
    confidence: 'NOT_DETERMINED',
    reason: `Unrecognized extension "${ext}" and path pattern`,
  };
}
