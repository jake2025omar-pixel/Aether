import React, { useState } from 'react';
import { AssetManifest, PreviewStatus } from '../tools/types';
import { Copy, Check, Info, ShieldAlert, Award, FileCode2 } from 'lucide-react';

export interface AssetPreviewPanelProps {
  manifest: AssetManifest;
  previewStatus: PreviewStatus;
  metrics?: {
    meshes: number;
    triangles: number;
  };
  className?: string;
}

export const AssetPreviewPanel: React.FC<AssetPreviewPanelProps> = ({
  manifest,
  previewStatus,
  metrics,
  className = '',
}) => {
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(manifest.asset_id).catch(() => {});
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return 'NOT_DETERMINED';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div
      className={`crystal-surface rounded-2xl p-5 border border-white/10 flex flex-col gap-4 overflow-y-auto max-h-[85vh] text-left select-text ${className}`}
    >
      {/* 1. Header Information */}
      <div className="border-b border-white/10 pb-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[10px] font-mono tracking-widest text-purple-400 uppercase font-semibold">
            {manifest.category}
          </span>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              previewStatus === 'WEB_READY'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : previewStatus === 'CONVERSION_REQUIRED'
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}
          >
            {previewStatus}
          </span>
        </div>

        <h2 className="text-xl font-bold text-white tracking-tight">
          {manifest.semantic_name || manifest.file_name}
        </h2>
        <p className="text-xs text-white/60 mt-1 leading-relaxed">
          {manifest.semantic_description || 'NOT_DETERMINED'}
        </p>
      </div>

      {/* 2. Stable Identity Block */}
      <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] text-white/50 font-mono">
          <span>STABLE ASSET ID</span>
          <button
            type="button"
            onClick={handleCopyId}
            className="flex items-center gap-1 text-purple-300 hover:text-purple-200 transition-colors cursor-pointer"
            title="Copy Stable Asset ID"
          >
            {copiedId ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy ID</span>
              </>
            )}
          </button>
        </div>
        <code className="text-xs text-purple-200 font-mono break-all font-medium">
          {manifest.asset_id}
        </code>
      </div>

      {/* 3. Provenance & File Specs */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-[10px] text-white/40 block font-mono">SOURCE ARCHIVE</span>
          <span className="text-white/90 font-medium truncate block" title={manifest.original_archive}>
            {manifest.original_archive}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-[10px] text-white/40 block font-mono">INTERNAL PATH</span>
          <span className="text-white/90 font-medium truncate block font-mono text-[11px]" title={manifest.internal_path}>
            {manifest.internal_path}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-[10px] text-white/40 block font-mono">FORMAT</span>
          <span className="text-white/90 font-semibold">
            {manifest.technical_3d?.format || 'NOT_DETERMINED'}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-[10px] text-white/40 block font-mono">FILE SIZE</span>
          <span className="text-white/90 font-medium">{formatBytes(manifest.size_bytes)}</span>
        </div>
      </div>

      {/* 4. Technical 3D Analysis */}
      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white/80 mb-2">
          <FileCode2 className="w-3.5 h-3.5 text-purple-400" />
          <span>Technical 3D Metadata</span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-mono">
          <div className="flex justify-between border-b border-white/5 py-0.5">
            <span className="text-white/40">Meshes:</span>
            <span className="text-white/80">
              {metrics ? metrics.meshes : (manifest.technical_3d?.mesh_count ?? 'NOT_DETERMINED')}
            </span>
          </div>
          <div className="flex justify-between border-b border-white/5 py-0.5">
            <span className="text-white/40">Triangles:</span>
            <span className="text-white/80">
              {metrics ? metrics.triangles : (manifest.technical_3d?.triangle_count ?? 'NOT_DETERMINED')}
            </span>
          </div>
          <div className="flex justify-between border-b border-white/5 py-0.5">
            <span className="text-white/40">Skeleton:</span>
            <span className="text-white/80">
              {manifest.technical_3d?.skeleton ? 'Rigged (Yes)' : 'Static (No)'}
            </span>
          </div>
          <div className="flex justify-between border-b border-white/5 py-0.5">
            <span className="text-white/40">Bones:</span>
            <span className="text-white/80">
              {manifest.technical_3d?.bone_count ?? 'NOT_DETERMINED'}
            </span>
          </div>
          <div className="flex justify-between border-b border-white/5 py-0.5">
            <span className="text-white/40">Morphs:</span>
            <span className="text-white/80">
              {manifest.technical_3d?.blend_shapes?.length
                ? `${manifest.technical_3d.blend_shapes.length} shapes`
                : 'NOT_DETERMINED'}
            </span>
          </div>
          <div className="flex justify-between border-b border-white/5 py-0.5">
            <span className="text-white/40">Deep Analysis:</span>
            <span className="text-white/80">
              {manifest.technical_3d?.deep_analysis ?? 'NOT_DETERMINED'}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Warnings and Compatibility Notes */}
      {manifest.warnings && manifest.warnings.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-amber-300 mb-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Inspection Notes & Warnings</span>
          </div>
          <ul className="space-y-1 text-amber-200/80 pl-4 list-disc">
            {manifest.warnings.map((w, idx) => (
              <li key={idx} className="leading-relaxed">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 6. License & Compliance Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[11px] text-white/40">
        <span className="flex items-center gap-1">
          <Award className="w-3 h-3 text-purple-400" />
          <span>License: {manifest.license_note || 'NOT_DETERMINED'}</span>
        </span>
        <span className="font-mono text-[10px]">Phase 05.2 Inspector</span>
      </div>
    </div>
  );
};
