import * as path from 'path';
import { ArchiveFileEntry } from './types';

export interface DetectedDependency {
  source_path: string;
  target_path: string;
  type: 'TEXTURE' | 'MATERIAL' | 'ANIMATION' | 'SUB_MODEL' | 'UNKNOWN';
}

/**
 * Detects internal relationships and dependencies between files inside a single archive.
 */
export function detectArchiveDependencies(files: ArchiveFileEntry[]): {
  dependencies: DetectedDependency[];
  missing: string[];
} {
  const dependencies: DetectedDependency[] = [];
  const missing: string[] = [];

  const fileMap = new Map<string, ArchiveFileEntry>();
  const normalizedSet = new Set<string>();

  for (const f of files) {
    const norm = f.internal_path.toLowerCase();
    fileMap.set(norm, f);
    normalizedSet.add(norm);
  }

  for (const file of files) {
    const ext = file.extension.toLowerCase();
    const dir = path.dirname(file.internal_path).toLowerCase();
    const baseName = path.basename(file.internal_path, file.extension).toLowerCase();

    // 1. OBJ -> MTL matching
    if (ext === '.obj') {
      const expectedMtl = dir === '.' ? `${baseName}.mtl` : `${dir}/${baseName}.mtl`;
      if (normalizedSet.has(expectedMtl)) {
        dependencies.push({
          source_path: file.internal_path,
          target_path: expectedMtl,
          type: 'MATERIAL',
        });
      }
    }

    // 2. Models -> Textures in same folder or /textures/ folder
    if (['.fbx', '.obj', '.pmx', '.pmd', '.gltf', '.blend'].includes(ext)) {
      for (const candidate of files) {
        if (candidate.internal_path === file.internal_path) continue;
        const cExt = candidate.extension.toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.tga', '.dds', '.bmp'].includes(cExt)) {
          const cDir = path.dirname(candidate.internal_path).toLowerCase();
          if (cDir === dir || cDir.startsWith(dir + '/textures') || cDir.startsWith(dir + '/tex')) {
            dependencies.push({
              source_path: file.internal_path,
              target_path: candidate.internal_path,
              type: 'TEXTURE',
            });
          }
        }
      }
    }
  }

  return { dependencies, missing };
}
