import React, { useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import {
  MVP_ASSET_IDS,
  MvpAssetId,
  getAssetManifest,
  evaluatePreviewStatus,
  getRegisteredAssets,
} from './manifestRegistry';
import { loadWeb3DAsset, dispose3DResource } from './AssetPreviewLoader';
import { AssetPreview3D } from './AssetPreview3D';
import { AssetPreviewFallback } from './AssetPreviewFallback';
import { AssetPreviewPanel } from './AssetPreviewPanel';
import { Loader2, Box, Layers, AlertTriangle } from 'lucide-react';

export type LoadingState = 'LOADING' | 'READY' | 'FAILED' | 'UNSUPPORTED' | 'UNAVAILABLE';

export interface AssetPreviewProps {
  initialAssetId?: MvpAssetId;
  className?: string;
}

export const AssetPreview: React.FC<AssetPreviewProps> = ({
  initialAssetId = 'char_dark_ice_c3256ebd4d660b1f',
  className = '',
}) => {
  const [selectedAssetId, setSelectedAssetId] = useState<MvpAssetId>(initialAssetId);
  const [loadingState, setLoadingState] = useState<LoadingState>('LOADING');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active 3D Scene object
  const [loadedScene, setLoadedScene] = useState<THREE.Object3D | null>(null);
  const [metrics, setMetrics] = useState<{ meshes: number; triangles: number } | undefined>(undefined);

  // Temporary developer session source (e.g. if developer dropped a test file)
  const [customSessionSource, setCustomSessionSource] = useState<{
    assetId: string;
    buffer: ArrayBuffer;
    fileName: string;
  } | null>(null);

  const manifest = getAssetManifest(selectedAssetId);
  const registeredAssets = getRegisteredAssets();

  // Evaluate capability
  const previewStatus = manifest
    ? evaluatePreviewStatus(
        manifest,
        Boolean(manifest.preview_url || (customSessionSource?.assetId === selectedAssetId))
      )
    : 'NOT_DETERMINED';

  // Dispose helper
  const clearActiveScene = useCallback(() => {
    if (loadedScene) {
      dispose3DResource(loadedScene);
      setLoadedScene(null);
    }
    setMetrics(undefined);
  }, [loadedScene]);

  // Load handler when asset selection changes
  useEffect(() => {
    let isCancelled = false;
    clearActiveScene();
    setErrorMessage(null);

    if (!manifest) {
      setLoadingState('FAILED');
      setErrorMessage(`Manifest for asset "${selectedAssetId}" could not be located.`);
      return;
    }

    const currentCap = evaluatePreviewStatus(
      manifest,
      Boolean(manifest.preview_url || (customSessionSource?.assetId === selectedAssetId))
    );

    if (currentCap === 'CONVERSION_REQUIRED') {
      setLoadingState('UNSUPPORTED');
      return;
    }

    if (currentCap === 'ASSET_NOT_AVAILABLE') {
      setLoadingState('UNAVAILABLE');
      return;
    }

    if (currentCap === 'STATIC_PREVIEW_ONLY') {
      setLoadingState('UNSUPPORTED');
      return;
    }

    // WEB_READY flow: load actual 3D binary
    setLoadingState('LOADING');

    const sourceToLoad =
      customSessionSource?.assetId === selectedAssetId
        ? customSessionSource.buffer
        : manifest.preview_url;

    if (!sourceToLoad) {
      setLoadingState('UNAVAILABLE');
      return;
    }

    const isVrm = manifest.technical_3d?.format === 'VRM' || manifest.file_name.endsWith('.vrm');

    loadWeb3DAsset(sourceToLoad, isVrm).then((res) => {
      if (isCancelled) {
        if (res.scene) dispose3DResource(res.scene);
        return;
      }

      if (res.success && res.scene) {
        setLoadedScene(res.scene);
        if (res.stats) {
          setMetrics({
            meshes: res.stats.meshCount,
            triangles: res.stats.triangleCount,
          });
        }
        setLoadingState('READY');
      } else {
        setLoadingState('FAILED');
        setErrorMessage(res.error || 'Failed to parse Web 3D geometry.');
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [selectedAssetId, customSessionSource]);

  // Handle local test file for developers
  const handleUploadTestFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      setCustomSessionSource({
        assetId: selectedAssetId,
        buffer,
        fileName: file.name,
      });
    } catch (err: unknown) {
      setErrorMessage('Could not read test file.');
    }
  };

  if (!manifest) {
    return (
      <div className="p-8 text-center text-rose-400 crystal-surface rounded-2xl">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
        <p>Asset manifest not found.</p>
      </div>
    );
  }

  return (
    <div className={`w-full h-full flex flex-col gap-4 select-none ${className}`}>
      {/* Top Asset Switcher Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 rounded-2xl bg-[#120C1C]/70 backdrop-blur-md border border-white/10">
        {/* Left: Asset Selection Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {registeredAssets.map((asset) => {
            const isSelected = selectedAssetId === asset.asset_id;
            return (
              <button
                key={asset.asset_id}
                type="button"
                onClick={() => setSelectedAssetId(asset.asset_id as MvpAssetId)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                  isSelected
                    ? 'bg-purple-600/40 text-white border border-purple-400/50 shadow-[0_0_15px_-3px_rgba(168,85,247,0.4)]'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.05] border border-transparent'
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
                  title={`Status: ${asset.preview_status}`}
                />
              </button>
            );
          })}
        </div>

        {/* Right: Active Status Indicator */}
        <div className="flex items-center gap-2 text-xs font-mono px-3 py-1 rounded-xl bg-white/[0.03] border border-white/5 self-start sm:self-auto">
          <span className="text-white/40 text-[10px]">PREVIEW CAPABILITY:</span>
          <span
            className={`font-semibold ${
              previewStatus === 'WEB_READY'
                ? 'text-emerald-300'
                : previewStatus === 'CONVERSION_REQUIRED'
                ? 'text-amber-300'
                : 'text-rose-300'
            }`}
          >
            {previewStatus}
          </span>
        </div>
      </div>

      {/* Main Responsive Grid Layout (3D Viewport on Left/Top, Inspector Panel on Right/Bottom) */}
      <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[460px] overflow-hidden">
        {/* Viewport Area (Span 7 or 8 on desktop, 12 on mobile) */}
        <div className="lg:col-span-7 xl:col-span-8 w-full h-[380px] lg:h-full relative rounded-2xl overflow-hidden flex flex-col">
          {loadingState === 'LOADING' && (
            <div className="w-full h-full min-h-[380px] rounded-2xl crystal-surface flex flex-col items-center justify-center gap-3 border border-white/10">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              <p className="text-xs font-mono tracking-wider uppercase text-white/60">
                Initializing WebGL Viewport...
              </p>
            </div>
          )}

          {loadingState === 'READY' && loadedScene && (
            <AssetPreview3D modelScene={loadedScene} onMetricsUpdate={setMetrics} />
          )}

          {loadingState === 'UNAVAILABLE' && (
            <AssetPreviewFallback
              manifest={manifest}
              status="ASSET_NOT_AVAILABLE"
              reason={
                manifest.warnings?.[0] ||
                'VRM file is not present in local runtime storage. Physical upload or URL hosting required.'
              }
              onUploadTestFile={handleUploadTestFile}
            />
          )}

          {loadingState === 'UNSUPPORTED' && (
            <AssetPreviewFallback
              manifest={manifest}
              status={previewStatus}
              reason={manifest.conversion_reason}
            />
          )}

          {loadingState === 'FAILED' && (
            <div className="w-full h-full min-h-[380px] p-6 rounded-2xl crystal-surface flex flex-col items-center justify-center text-center border border-rose-500/30">
              <AlertTriangle className="w-8 h-8 text-rose-400 mb-3" />
              <h4 className="text-sm font-semibold text-white mb-1">Preview Loading Failed</h4>
              <p className="text-xs text-rose-300/80 max-w-sm mb-4">
                {errorMessage || 'Encountered an unexpected loader failure.'}
              </p>
              <button
                type="button"
                onClick={() => setSelectedAssetId(selectedAssetId)}
                className="px-4 py-1.5 rounded-xl text-xs font-medium bg-white/10 hover:bg-white/15 text-white transition-colors"
              >
                Retry Inspection
              </button>
            </div>
          )}
        </div>

        {/* Inspector Panel Sidebar (Span 5 or 4 on desktop, 12 on mobile) */}
        <div className="lg:col-span-5 xl:col-span-4 w-full h-auto lg:h-full flex flex-col overflow-hidden">
          <AssetPreviewPanel
            manifest={manifest}
            previewStatus={previewStatus}
            metrics={metrics}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
};
