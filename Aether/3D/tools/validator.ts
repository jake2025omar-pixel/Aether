import * as fs from 'fs';
import * as path from 'path';
import { ManifestManager } from './manifestManager';

export interface ValidationReport {
  passed: boolean;
  timestamp: string;
  total_archives_in_inventory: number;
  total_archive_manifests: number;
  total_asset_manifests: number;
  issues: string[];
  warnings: string[];
}

export async function validateLibrary(manager: ManifestManager): Promise<ValidationReport> {
  const issues: string[] = [];
  const warnings: string[] = [];
  const paths = manager.getPaths();

  const inventory = await manager.readArchiveInventory();
  if (!inventory) {
    return {
      passed: true,
      timestamp: new Date().toISOString(),
      total_archives_in_inventory: 0,
      total_archive_manifests: 0,
      total_asset_manifests: 0,
      issues: [],
      warnings: ['No archive_index.json present yet (Phase B not yet executed).'],
    };
  }

  // Check archive manifests
  const archiveFiles = fs.existsSync(paths.archiveManifestsDir)
    ? (await fs.promises.readdir(paths.archiveManifestsDir)).filter((f) => f.endsWith('.json'))
    : [];

  const assetFiles = fs.existsSync(paths.assetManifestsDir)
    ? (await fs.promises.readdir(paths.assetManifestsDir)).filter((f) => f.endsWith('.json'))
    : [];

  const seenArchiveIds = new Set<string>();
  const seenArchiveHashes = new Set<string>();

  for (const item of inventory.queue) {
    if (!item.archive_id) issues.push(`Inventory item missing archive_id: ${item.original_filename}`);
    if (!item.sha256 || item.sha256.length !== 64) issues.push(`Invalid SHA256 for archive ${item.archive_id}`);
    if (seenArchiveIds.has(item.archive_id)) issues.push(`Duplicate archive_id in inventory: ${item.archive_id}`);
    seenArchiveIds.add(item.archive_id);

    // Check if manifest exists
    const manifest = await manager.readArchiveManifest(item.archive_id);
    if (!manifest) {
      warnings.push(`Archive ${item.archive_id} has not been inspected yet.`);
    } else {
      if (manifest.sha256 !== item.sha256) {
        issues.push(`SHA-256 mismatch in manifest vs inventory for ${item.archive_id}`);
      }
    }
  }

  // Check asset manifests for duplicate IDs and broken archive refs
  const seenAssetIds = new Set<string>();
  for (const assetFile of assetFiles) {
    try {
      const fullPath = path.join(paths.assetManifestsDir, assetFile);
      const content = await fs.promises.readFile(fullPath, 'utf-8');
      const asset = JSON.parse(content);

      if (!asset.asset_id) {
        issues.push(`Asset manifest ${assetFile} missing asset_id`);
      } else if (seenAssetIds.has(asset.asset_id)) {
        issues.push(`Duplicate asset_id detected: ${asset.asset_id}`);
      } else {
        seenAssetIds.add(asset.asset_id);
      }

      if (!asset.archive_id || !seenArchiveIds.has(asset.archive_id)) {
        issues.push(`Asset ${asset.asset_id} references nonexistent archive_id: ${asset.archive_id}`);
      }
    } catch (err: any) {
      issues.push(`Failed to parse asset manifest ${assetFile}: ${err.message}`);
    }
  }

  return {
    passed: issues.length === 0,
    timestamp: new Date().toISOString(),
    total_archives_in_inventory: inventory.queue.length,
    total_archive_manifests: archiveFiles.length,
    total_asset_manifests: assetFiles.length,
    issues,
    warnings,
  };
}
