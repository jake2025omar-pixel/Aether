import React from 'react';
import { AssetManifest, PreviewStatus } from '../tools/types';
import { AlertCircle, FileX, RefreshCw, Box, Upload } from 'lucide-react';

export interface AssetPreviewFallbackProps {
  manifest: AssetManifest;
  status: PreviewStatus;
  reason?: string | null;
  onUploadTestFile?: (file: File) => void;
  className?: string;
}

export const AssetPreviewFallback: React.FC<AssetPreviewFallbackProps> = ({
  manifest,
  status,
  reason,
  onUploadTestFile,
  className = '',
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const getStatusBadge = () => {
    switch (status) {
      case 'CONVERSION_REQUIRED':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Conversion Required</span>
          </div>
        );
      case 'ASSET_NOT_AVAILABLE':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <FileX className="w-3.5 h-3.5" />
            <span>Asset Not Available</span>
          </div>
        );
      case 'STATIC_PREVIEW_ONLY':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <Box className="w-3.5 h-3.5" />
            <span>Static Preview Only</span>
          </div>
        );
      default:
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-white/10 text-white/70 border border-white/20">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Not Determined</span>
          </div>
        );
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadTestFile) {
      onUploadTestFile(file);
    }
  };

  return (
    <div
      className={`relative w-full h-full min-h-[380px] p-6 rounded-2xl crystal-surface flex flex-col justify-between overflow-hidden border border-white/10 ${className}`}
    >
      {/* Background ambient gradient glow */}
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

      {/* Top Header State */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-mono tracking-[2px] uppercase text-white/40">
            3D Inspection Diagnostic
          </span>
          <h3 className="text-lg font-semibold text-white tracking-wide mt-0.5">
            {manifest.semantic_name || manifest.file_name}
          </h3>
        </div>
        <div>{getStatusBadge()}</div>
      </div>

      {/* Center Informational State */}
      <div className="relative z-10 my-6 flex flex-col items-center text-center max-w-lg mx-auto">
        {manifest.preview_image_url ? (
          <div className="w-40 h-40 rounded-xl overflow-hidden border border-white/15 mb-4 shadow-xl">
            <img
              src={manifest.preview_image_url}
              alt={manifest.semantic_name || manifest.file_name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-purple-400 mb-4 shadow-[0_0_30px_-5px_rgba(168,85,247,0.2)]">
            {status === 'CONVERSION_REQUIRED' ? (
              <RefreshCw className="w-7 h-7 text-amber-400" />
            ) : status === 'ASSET_NOT_AVAILABLE' ? (
              <FileX className="w-7 h-7 text-rose-400" />
            ) : (
              <Box className="w-7 h-7" />
            )}
          </div>
        )}

        <p className="text-sm text-white/80 font-medium mb-2">
          {reason || manifest.conversion_reason || 'This asset cannot be previewed directly as interactive 3D in the web browser.'}
        </p>

        {manifest.conversion_requirement && (
          <div className="mt-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-left w-full">
            <span className="text-[10px] font-mono tracking-wider uppercase text-amber-400 block font-semibold mb-1">
              Required Phase Action
            </span>
            <p className="text-xs text-amber-200/90 leading-relaxed">
              {manifest.conversion_requirement}
            </p>
          </div>
        )}

        {/* Developer Sandbox Testing Dropzone */}
        {status === 'ASSET_NOT_AVAILABLE' && onUploadTestFile && (
          <div className="mt-4 w-full p-4 rounded-xl bg-white/[0.03] border border-dashed border-white/20 flex flex-col items-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".vrm,.glb,.gltf"
              className="hidden"
            />
            <p className="text-xs text-white/60 mb-2">
              Have a local <code className="text-purple-300 font-mono">.vrm</code> or <code className="text-purple-300 font-mono">.glb</code> file to verify this session?
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium text-white bg-purple-600/40 hover:bg-purple-600/60 border border-purple-400/40 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Select 3D File for Session Preview</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Diagnostics Footer */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 border-t border-white/10 text-left text-xs font-mono">
        <div>
          <span className="text-white/40 block text-[10px]">FORMAT</span>
          <span className="text-white/90 font-semibold">{manifest.technical_3d?.format || 'NOT_DETERMINED'}</span>
        </div>
        <div>
          <span className="text-white/40 block text-[10px]">CATEGORY</span>
          <span className="text-white/90 font-semibold">{manifest.category}</span>
        </div>
        <div>
          <span className="text-white/40 block text-[10px]">ARCHIVE</span>
          <span className="text-white/90 truncate block" title={manifest.original_archive}>
            {manifest.original_archive}
          </span>
        </div>
        <div>
          <span className="text-white/40 block text-[10px]">STABLE ID</span>
          <span className="text-purple-300/90 truncate block" title={manifest.asset_id}>
            {manifest.asset_id}
          </span>
        </div>
      </div>
    </div>
  );
};
