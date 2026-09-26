// ==============================================================================
// ROADRISK AI — OFFLINE MAPS & REGIONAL STORAGE MANAGER MODAL
// Allows users to download, inspect, and delete regional map packages,
// view local road graphs, inspect storage quotas, and check sync status.
// ==============================================================================

import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Trash2,
  CheckCircle2,
  HardDrive,
  Wifi,
  WifiOff,
  AlertTriangle,
  RefreshCw,
  MapPin,
  Compass,
} from 'lucide-react';
import {
  offlineMapService,
  DownloadableRegionDef,
  AVAILABLE_REGIONS,
} from '../../services/offlineMapService.ts';
import { offlineStorageService, OfflineRegionMeta } from '../../services/offlineStorageService.ts';
import { networkStatusService } from '../../services/networkStatusService.ts';

interface OfflineMapManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRegion?: (region: DownloadableRegionDef) => void;
}

export const OfflineMapManagerModal: React.FC<OfflineMapManagerModalProps> = ({
  isOpen,
  onClose,
  onSelectRegion,
}) => {
  const [regions, setRegions] = useState<
    Array<DownloadableRegionDef & { isDownloaded: boolean; downloadedMeta?: OfflineRegionMeta }>
  >([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadStatusStep, setDownloadStatusStep] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(networkStatusService.isOnline());
  const [totalStorageBytes, setTotalStorageBytes] = useState<number>(0);

  const loadData = async () => {
    const list = await offlineMapService.getRegionsStatus();
    setRegions(list);

    let bytes = 0;
    list.forEach((r) => {
      if (r.downloadedMeta) {
        bytes += r.downloadedMeta.sizeBytes;
      }
    });
    setTotalStorageBytes(bytes);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    const unsub = networkStatusService.subscribe((h) => setIsOnline(h.isOnline));
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const handleDownload = async (regionId: string) => {
    setDownloadingId(regionId);
    setDownloadProgress(0);
    setDownloadStatusStep('Initializing download...');

    try {
      await offlineMapService.downloadRegion(regionId, (pct, step) => {
        setDownloadProgress(pct);
        setDownloadStatusStep(step);
      });
      await loadData();
    } catch (err: any) {
      alert(`Download failed: ${err.message || 'Network error'}`);
    } finally {
      setDownloadingId(null);
      setDownloadProgress(0);
      setDownloadStatusStep('');
    }
  };

  const handleDelete = async (regionId: string) => {
    if (confirm('Are you sure you want to remove this offline map region? Offline routing for this area will become unavailable.')) {
      await offlineMapService.deleteRegion(regionId);
      await loadData();
    }
  };

  const formatSizeMb = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const downloadedCount = regions.filter((r) => r.isDownloaded).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Offline Maps & Regional Routing
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-500/30">
                  v3.0 Local Graph
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Download high-precision road networks & map tiles for zero-connection navigation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Connectivity & Storage Overview */}
        <div className="grid grid-cols-2 gap-3 px-6 py-3.5 bg-slate-950/40 border-b border-slate-800/80 text-xs">
          <div className="flex items-center gap-2.5">
            {isOnline ? (
              <div className="flex items-center gap-2 text-emerald-400 font-medium">
                <Wifi className="w-4 h-4" />
                <span>Online (Ready to Download)</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-400 font-medium">
                <WifiOff className="w-4 h-4" />
                <span>Offline Mode (Using Downloaded Data)</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 text-slate-300">
            <HardDrive className="w-4 h-4 text-cyan-400" />
            <span>
              Storage: <strong className="text-white">{formatSizeMb(totalStorageBytes)}</strong> ({downloadedCount} region{downloadedCount !== 1 ? 's' : ''})
            </span>
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Available Offline Regions
            </h3>

            {regions.map((region) => {
              const isCurrentDownloading = downloadingId === region.id;

              return (
                <div
                  key={region.id}
                  className={`p-4 rounded-xl border transition-all ${
                    region.isDownloaded
                      ? 'bg-slate-800/60 border-emerald-500/40 hover:border-emerald-500/60'
                      : 'bg-slate-800/30 border-slate-700/60 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-white text-sm">{region.name}</span>
                        <span className="text-xs text-slate-400">({region.state}, {region.country})</span>
                        {region.isDownloaded && (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                            <CheckCircle2 className="w-3 h-3" /> Ready Offline
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 mb-2">{region.description}</p>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span className="bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">
                          Est. Size: {formatSizeMb(region.estimatedSizeBytes)}
                        </span>
                        <span className="bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">
                          Road Network: Fully Connected
                        </span>
                        {region.downloadedMeta && (
                          <span className="text-slate-400">
                            Downloaded: {new Date(region.downloadedMeta.downloadedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 items-end">
                      {region.isDownloaded ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              onSelectRegion?.(region);
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow"
                          >
                            <MapPin className="w-3.5 h-3.5" /> View
                          </button>
                          <button
                            onClick={() => handleDelete(region.id)}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors"
                            title="Delete downloaded map"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          disabled={!isOnline || isCurrentDownloading}
                          onClick={() => handleDownload(region.id)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                            !isOnline
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                              : isCurrentDownloading
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                              : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/25'
                          }`}
                        >
                          {isCurrentDownloading ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              Downloading...
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" />
                              Download Map
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar for Active Download */}
                  {isCurrentDownloading && (
                    <div className="mt-3 pt-3 border-t border-slate-700/60">
                      <div className="flex justify-between text-xs text-slate-300 mb-1">
                        <span className="font-mono text-cyan-400">{downloadStatusStep}</span>
                        <span className="font-bold text-white">{downloadProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700">
                        <div
                          className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-200"
                          style={{ width: `${downloadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer info banner */}
        <div className="px-6 py-3 bg-slate-950/80 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Offline navigation works without cellular or Wi-Fi data once a region is downloaded.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default OfflineMapManagerModal;
