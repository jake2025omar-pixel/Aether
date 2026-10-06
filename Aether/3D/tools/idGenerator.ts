import { createHash } from 'crypto';
import { AssetCategory } from './types';

/**
 * Computes SHA-256 hex digest of a buffer or string.
 */
export function computeSha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Derives a deterministic stable archive ID from its SHA-256.
 * Format: arch_<first 12 chars of sha256>
 * Example: arch_a1b2c3d4e5f6
 */
export function deriveArchiveId(sha256: string): string {
  if (!sha256 || sha256.length < 12) {
    throw new Error(`Invalid SHA-256 for archive ID derivation: "${sha256}"`);
  }
  return `arch_${sha256.substring(0, 12).toLowerCase()}`;
}

/**
 * Derives a deterministic alias ID based on alphabetical order index (0-padded).
 * Example: archive_001
 */
export function deriveArchiveAlias(index: number): string {
  return `archive_${String(index + 1).padStart(3, '0')}`;
}

/**
 * Derives a deterministic stable asset ID.
 * Based on:
 * - Asset Category prefix (e.g. char, room, outfit, prop, model, tex, etc.)
 * - Archive SHA-256 short hash (6 chars)
 * - Internal Path normalized hash (8 chars)
 * - Normalized clean slug of the filename
 *
 * Guaranteed to be 100% deterministic, reproducible, collision-resistant,
 * and stable across rescans.
 */
export function deriveAssetId(
  category: AssetCategory,
  archiveSha256: string,
  internalPath: string
): string {
  const catPrefixMap: Record<AssetCategory, string> = {
    CHARACTER: 'char',
    ROOM: 'room',
    ENVIRONMENT: 'env',
    FURNITURE: 'furn',
    OUTFIT: 'outfit',
    CLOTHING: 'cloth',
    HAIR: 'hair',
    FACE: 'face',
    ACCESSORY: 'acc',
    PROP: 'prop',
    ANIMATION: 'anim',
    MOTION: 'motion',
    MUSIC: 'music',
    AUDIO: 'audio',
    TEXTURE: 'tex',
    MATERIAL: 'mat',
    SHADER: 'shader',
    MODEL: 'model',
    RIG: 'rig',
    SKELETON: 'skel',
    MORPH: 'morph',
    BLENDSHAPE: 'bshape',
    CONFIG: 'cfg',
    METADATA: 'meta',
    IMAGE: 'img',
    VIDEO: 'vid',
    UNKNOWN: 'unk',
    NOT_DETERMINED: 'ast',
  };

  const prefix = catPrefixMap[category] || 'ast';
  const archShort = archiveSha256.substring(0, 6).toLowerCase();

  // Normalize path and compute path hash
  const normPath = internalPath.replace(/\\/g, '/').toLowerCase().trim();
  const pathHash = createHash('sha256').update(normPath).digest('hex').substring(0, 8);

  // Derive human-readable clean slug from filename without extension
  const rawBaseName = normPath.split('/').pop() || 'asset';
  const nameWithoutExt = rawBaseName.replace(/\.[^/.]+$/, '');
  const cleanSlug = nameWithoutExt
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 24);

  return cleanSlug
    ? `${prefix}_${cleanSlug}_${archShort}_${pathHash}`
    : `${prefix}_${archShort}_${pathHash}`;
}
