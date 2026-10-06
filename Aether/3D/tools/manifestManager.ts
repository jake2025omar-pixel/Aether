import * as fs from 'fs';
import * as path from 'path';
import {
  ArchiveInventory,
  ArchiveInventoryItem,
  ArchiveManifest,
  AssetManifest,
  MasterIndex,
} from './types';

export class ManifestManager {
  private baseDir: string;
  private archivesDir: string;
  private manifestsDir: string;
  private archiveManifestsDir: string;
  private assetManifestsDir: string;
  private archiveIndexPath: string;
  private masterIndexPath: string;
  private schemaPath: string;

  constructor(customBaseDir?: string) {
    this.baseDir = customBaseDir || path.resolve(process.cwd(), 'Aether/3D');
    this.archivesDir = path.join(this.baseDir, 'Archives');
    this.manifestsDir = path.join(this.baseDir, 'Manifests');
    this.archiveManifestsDir = path.join(this.manifestsDir, 'archives');
    this.assetManifestsDir = path.join(this.manifestsDir, 'assets');
    this.archiveIndexPath = path.join(this.manifestsDir, 'archive_index.json');
    this.masterIndexPath = path.join(this.manifestsDir, 'index.json');
    this.schemaPath = path.join(this.manifestsDir, 'schema.json');
  }

  public getPaths() {
    return {
      baseDir: this.baseDir,
      archivesDir: this.archivesDir,
      manifestsDir: this.manifestsDir,
      archiveManifestsDir: this.archiveManifestsDir,
      assetManifestsDir: this.assetManifestsDir,
      archiveIndexPath: this.archiveIndexPath,
      masterIndexPath: this.masterIndexPath,
      schemaPath: this.schemaPath,
    };
  }

  public async ensureDirectories(): Promise<void> {
    await fs.promises.mkdir(this.archivesDir, { recursive: true });
    await fs.promises.mkdir(this.manifestsDir, { recursive: true });
    await fs.promises.mkdir(this.archiveManifestsDir, { recursive: true });
    await fs.promises.mkdir(this.assetManifestsDir, { recursive: true });
  }

  private async atomicWriteJson(filePath: string, data: any): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    const serialized = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(tempPath, serialized, 'utf-8');
    await fs.promises.rename(tempPath, filePath);
  }

  public async readArchiveInventory(): Promise<ArchiveInventory | null> {
    if (!fs.existsSync(this.archiveIndexPath)) {
      return null;
    }
    try {
      const content = await fs.promises.readFile(this.archiveIndexPath, 'utf-8');
      return JSON.parse(content) as ArchiveInventory;
    } catch {
      return null;
    }
  }

  public async saveArchiveInventory(inventory: ArchiveInventory): Promise<void> {
    await this.atomicWriteJson(this.archiveIndexPath, inventory);
  }

  public async saveArchiveManifest(manifest: ArchiveManifest): Promise<string> {
    const manifestPath = path.join(this.archiveManifestsDir, `${manifest.archive_id}.json`);
    await this.atomicWriteJson(manifestPath, manifest);
    return manifestPath;
  }

  public async readArchiveManifest(archiveId: string): Promise<ArchiveManifest | null> {
    const manifestPath = path.join(this.archiveManifestsDir, `${archiveId}.json`);
    if (!fs.existsSync(manifestPath)) return null;
    try {
      const content = await fs.promises.readFile(manifestPath, 'utf-8');
      return JSON.parse(content) as ArchiveManifest;
    } catch {
      return null;
    }
  }

  public async hasArchiveManifest(archiveId: string): Promise<boolean> {
    const manifestPath = path.join(this.archiveManifestsDir, `${archiveId}.json`);
    return fs.existsSync(manifestPath);
  }

  public async saveAssetManifest(manifest: AssetManifest): Promise<string> {
    const manifestPath = path.join(this.assetManifestsDir, `${manifest.asset_id}.json`);
    await this.atomicWriteJson(manifestPath, manifest);
    return manifestPath;
  }

  public async saveMasterIndex(index: MasterIndex): Promise<void> {
    await this.atomicWriteJson(this.masterIndexPath, index);
  }

  public async readMasterIndex(): Promise<MasterIndex | null> {
    if (!fs.existsSync(this.masterIndexPath)) return null;
    try {
      const content = await fs.promises.readFile(this.masterIndexPath, 'utf-8');
      return JSON.parse(content) as MasterIndex;
    } catch {
      return null;
    }
  }

  public async getResumeState(): Promise<{
    completed: string[];
    failed: string[];
    not_started: string[];
  }> {
    const inventory = await this.readArchiveInventory();
    if (!inventory) {
      return { completed: [], failed: [], not_started: [] };
    }

    const completed: string[] = [];
    const failed: string[] = [];
    const not_started: string[] = [];

    for (const item of inventory.queue) {
      const hasManifest = await this.hasArchiveManifest(item.archive_id);
      if (hasManifest) {
        const manifest = await this.readArchiveManifest(item.archive_id);
        if (manifest?.inspection_status === 'COMPLETED') {
          completed.push(item.archive_id);
        } else {
          failed.push(item.archive_id);
        }
      } else {
        not_started.push(item.archive_id);
      }
    }

    return { completed, failed, not_started };
  }
}
