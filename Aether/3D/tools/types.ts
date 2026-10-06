/**
 * Aether 3D Asset Inspection - TypeScript Type Definitions
 */

export type ConfidenceLevel = 'DETECTED' | 'INFERRED' | 'NOT_DETERMINED' | 'UNCONFIRMED';

export type ProcessingStatus = 'DISCOVERED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export type InspectionStatus = 'NOT_INSPECTED' | 'INSPECTED' | 'FAILED';

export type PreviewStatus =
  | 'WEB_READY'
  | 'STATIC_PREVIEW_ONLY'
  | 'CONVERSION_REQUIRED'
  | 'ASSET_NOT_AVAILABLE'
  | 'NOT_DETERMINED';

export type AssetCategory =
  | 'CHARACTER'
  | 'ROOM'
  | 'ENVIRONMENT'
  | 'FURNITURE'
  | 'OUTFIT'
  | 'CLOTHING'
  | 'HAIR'
  | 'FACE'
  | 'ACCESSORY'
  | 'PROP'
  | 'ANIMATION'
  | 'MOTION'
  | 'MUSIC'
  | 'AUDIO'
  | 'TEXTURE'
  | 'MATERIAL'
  | 'SHADER'
  | 'MODEL'
  | 'RIG'
  | 'SKELETON'
  | 'MORPH'
  | 'BLENDSHAPE'
  | 'CONFIG'
  | 'METADATA'
  | 'IMAGE'
  | 'VIDEO'
  | 'UNKNOWN'
  | 'NOT_DETERMINED';

export interface ArchiveInventoryItem {
  archive_id: string; // Deterministic: arch_<12-hex-sha256>
  alias_id?: string;   // Deterministic: archive_001, etc.
  original_filename: string;
  sha256: string;
  size_bytes: number;
  format: 'ZIP' | '7Z' | 'RAR' | 'TAR' | 'UNKNOWN';
  location: string;
  status: ProcessingStatus;
  inspection_status: InspectionStatus;
  discovered_at: string;
  last_inspected_at?: string | null;
  error_message?: string | null;
}

export interface ArchiveInventory {
  generated_at: string;
  total_archives_detected: number;
  total_zips: number;
  other_supported_archives: number;
  unsupported_formats_count: number;
  unreadable_archives_count: number;
  duplicate_archive_hashes: Record<string, string[]>;
  missing_unreadable_archives: string[];
  archives_already_processed: number;
  archives_not_yet_processed: number;
  queue: ArchiveInventoryItem[];
}

export interface ArchiveFileEntry {
  internal_path: string;
  file_name: string;
  extension: string;
  size_bytes: number;
  compressed_size_bytes: number;
  crc32: string;
  sha256: string; // exact SHA-256 or "NOT_DETERMINED"
  is_directory: boolean;
  is_nested_archive: boolean;
  is_suspicious_or_corrupt: boolean;
  corruption_notes: string | null;
  compression_method?: string;
  offset?: number;
}

export interface ArchiveManifest {
  archive_id: string;
  alias_id?: string;
  original_filename: string;
  sha256: string;
  size_bytes: number;
  format: string;
  location: string;
  inspected_at: string;
  inspection_status: 'COMPLETED' | 'FAILED';
  error_reason: string | null;
  file_count: number;
  folder_count: number;
  uncompressed_total_bytes: number;
  folders: string[];
  files: ArchiveFileEntry[];
  detected_3d_assets_count: number;
  nested_archives: string[];
  dependencies_detected: string[];
  warnings: string[];
}

export interface AssetTechnical3D {
  format: string;
  mesh_count?: number | 'NOT_DETERMINED';
  vertex_count?: number | 'NOT_DETERMINED';
  triangle_count?: number | 'NOT_DETERMINED';
  material_count?: number | 'NOT_DETERMINED';
  texture_count?: number | 'NOT_DETERMINED';
  texture_dimensions?: Record<string, string> | 'NOT_DETERMINED';
  texture_formats?: string[] | 'NOT_DETERMINED';
  skeleton?: boolean | 'NOT_DETERMINED';
  bone_count?: number | 'NOT_DETERMINED';
  bone_names?: string[] | 'NOT_DETERMINED';
  animation_count?: number | 'NOT_DETERMINED';
  animation_names?: string[] | 'NOT_DETERMINED';
  animation_duration?: number | 'NOT_DETERMINED';
  blend_shapes?: string[] | 'NOT_DETERMINED';
  facial_morphs?: string[] | 'NOT_DETERMINED';
  uv_channels?: number | 'NOT_DETERMINED';
  normal_information?: boolean | 'NOT_DETERMINED';
  tangent_information?: boolean | 'NOT_DETERMINED';
  embedded_textures?: boolean | 'NOT_DETERMINED';
  external_textures?: string[] | 'NOT_DETERMINED';
  external_dependencies?: string[] | 'NOT_DETERMINED';
  missing_dependencies?: string[] | 'NOT_DETERMINED';
  coordinate_system?: string;
  scale_information?: number | 'NOT_DETERMINED';
  import_warnings?: string[];
  compatibility_warnings?: string[];
  deep_analysis: 'COMPLETED' | 'PARTIAL' | 'NOT_DETERMINED';
}

export interface AssetManifest {
  asset_id: string; // Deterministic: e.g. char_<arch_hash>_<path_hash>
  archive_id: string;
  original_archive: string;
  internal_path: string;
  file_name: string;
  name?: string;
  source_format?: string;
  runtime_file?: string | null;
  size_bytes: number;
  category: AssetCategory;
  category_confidence: ConfidenceLevel;
  semantic_name?: string;
  semantic_description?: string;
  technical_3d?: AssetTechnical3D;
  dependencies: string[];
  relationships: {
    character_for?: string | null;
    outfit_for?: string | null;
    hair_for?: string | null;
    accessory_for?: string | null;
    textures?: string[];
    materials?: string[];
    skeleton?: string | null;
    animations?: string[];
    possible_duplicate_of?: string | null;
    possible_variant_of?: string | null;
  };
  preview_status?: PreviewStatus;
  preview_url?: string | null;
  preview_image_url?: string | null;
  conversion_requirement?: string | null;
  conversion_reason?: string | null;
  license_note?: string | null;
  warnings: string[];
}

export interface MasterIndex {
  generated_at: string;
  schema_version: string;
  total_archives: number;
  total_assets: number;
  categories_summary: Record<string, number>;
  archives: Record<string, {
    original_filename: string;
    sha256: string;
    size_bytes: number;
    format: string;
    file_count: number;
    manifest_path: string;
    status: string;
  }>;
  assets: Record<string, {
    archive_id: string;
    original_archive: string;
    internal_path: string;
    file_name: string;
    semantic_name?: string;
    category: AssetCategory;
    category_confidence: ConfidenceLevel;
    preview_status?: PreviewStatus;
    conversion_requirement?: string | null;
    technical_summary?: string;
    dependencies: string[];
    manifest_path: string;
    warnings: string[];
  }>;
}
