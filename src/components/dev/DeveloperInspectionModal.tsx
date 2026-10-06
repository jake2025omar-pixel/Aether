import React, { useState } from 'react';
import { X, Layers, AlertCircle, RefreshCw, FileX, Copy, Check, Terminal } from 'lucide-react';
import { getRegisteredAssets, getAssetManifest } from '@/Aether/3D/Preview/manifestRegistry';

interface DeveloperInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeveloperInspectionModal: React.FC<DeveloperInspectionModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedAssetId, setSelectedAssetId] = useState<string>('char_dark_ice_c3256ebd4d660b1f');
  const [copiedId, setCopiedId] = useState(false);

  if (!isOpen) return null;

  const registeredAssets = getRegisteredAssets();
  const manifest = getAssetManifest(selectedAssetId);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id).catch(() => {});
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[85vh] crystal-surface rounded-2xl border border-white/15 p-5 flex flex-col gap-4 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-purple-300">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide">
                Aether Internal Developer Mode — 3D Asset Inspection
              </h2>
              <p className="text-[11px] text-white/50 font-mono">
                Manifest-driven technical telemetry • Hidden from end users
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close Developer Inspection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-navigation tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-white/5">
          {registeredAssets.map((asset) => {
            const isSelected = selectedAssetId === asset.asset_id;
            return (
              <button
                key={asset.asset_id}
                onClick={() => setSelectedAssetId(asset.asset_id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-purple-600/30 text-white border border-purple-400/50'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-purple-300" />
                <span>{asset.name}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    asset.preview_status === 'WEB_READY'
                      ? 'bg-emerald-400'
                      : asset.preview_status === 'CONVERSION_REQUIRED'
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Detailed Inspector Body */}
        {manifest && (
          <div className="flex-1 overflow-y-auto space-y-3 text-xs pr-1">
            {/* Status & Name Card */}
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono text-purple-400 uppercase font-semibold">
                  {manifest.category}
                </span>
                <h3 className="text-base font-bold text-white">
                  {manifest.semantic_name || manifest.file_name}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-[11px] font-mono font-semibold uppercase border ${
                    manifest.preview_status === 'WEB_READY'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : manifest.preview_status === 'CONVERSION_REQUIRED'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {manifest.preview_status}
                </span>
              </div>
            </div>

            {/* Stable Asset ID */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
              <div className="font-mono text-[11px]">
                <span className="text-white/40 block">STABLE ASSET ID</span>
                <code className="text-purple-200">{manifest.asset_id}</code>
              </div>

              <button
                onClick={() => handleCopyId(manifest.asset_id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 transition-colors cursor-pointer"
              >
                {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span className="text-[11px] font-mono">{copiedId ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Spec Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-white/40 block text-[10px]">SOURCE FORMAT</span>
                <span className="text-white font-semibold">{manifest.technical_3d?.format || 'NOT_DETERMINED'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-white/40 block text-[10px]">ARCHIVE FILE</span>
                <span className="text-white truncate block" title={manifest.original_archive}>
                  {manifest.original_archive}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-white/40 block text-[10px]">SKELETON</span>
                <span className="text-white">
                  {manifest.technical_3d?.skeleton ? `Yes (${manifest.technical_3d.bone_count} bones)` : 'No / None'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-white/40 block text-[10px]">RUNTIME STATUS</span>
                <span className="text-white">
                  {manifest.runtime_file ? 'Mounted' : 'Awaiting Binary'}
                </span>
              </div>
            </div>

            {/* Conversion & Compatibility Notice */}
            {manifest.conversion_requirement && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200">
                <div className="flex items-center gap-1.5 font-semibold text-amber-300 mb-1">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Required Conversion Pipeline</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {manifest.conversion_requirement}
                </p>
              </div>
            )}

            {/* Warnings & Notes */}
            {manifest.warnings && manifest.warnings.length > 0 && (
              <div className="p-3 rounded-xl bg-black/30 border border-white/10 text-white/80">
                <div className="flex items-center gap-1.5 font-semibold text-white/90 mb-1">
                  <AlertCircle className="w-3.5 h-3.5 text-purple-400" />
                  <span>Technical Observations</span>
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-white/60">
                  {manifest.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
