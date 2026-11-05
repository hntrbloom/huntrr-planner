import { getFileFromIDB } from '../../lib/idb';
import { ACCOUNT_FILE_PREFIX, readAccountFile } from '../../lib/accountFiles';
import React, { useState } from 'react';
import { Box, Eye, Edit3, Download, Trash2, Search, Calendar, Ruler, Layers, Loader2, HardDrive, AlertTriangle } from 'lucide-react';
import { SavedModel3D } from '../../types';
import { fetchDriveSTLArrayBuffer, downloadSTLBuffer, deleteSTLFromDrive } from '../../lib/stlDriveService';

interface SavedModelsListProps {
  models: SavedModel3D[];
  activeModelId?: string | null;
  onOpenModel: (model: SavedModel3D, arrayBuffer: ArrayBuffer) => void;
  onRenameModel: (model: SavedModel3D, newName: string) => Promise<void>;
  onDeleteModel: (modelId: string, driveFileId?: string, deleteFromDrive?: boolean) => Promise<void>;
  onUploadClick: () => void;
}

export function SavedModelsList({
  models,
  activeModelId,
  onOpenModel,
  onRenameModel,
  onDeleteModel,
  onUploadClick,
}: SavedModelsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingModelId, setLoadingModelId] = useState<string | null>(null);
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  const [editingModel, setEditingModel] = useState<SavedModel3D | null>(null);
  const [renameText, setRenameText] = useState('');
  const [deletingModel, setDeletingModel] = useState<SavedModel3D | null>(null);
  const [deleteDriveFileChecked, setDeleteDriveFileChecked] = useState(false);
  const [isProcessingDelete, setIsProcessingDelete] = useState(false);
  const [isProcessingRename, setIsProcessingRename] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filteredModels = models.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.originalFilename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleViewModel = async (model: SavedModel3D) => {
    if (!model.driveFileId && !model.localFileKey) {
      setErrorMsg('This model does not have a Google Drive file ID attached.');
      return;
    }

    try {
      setLoadingModelId(model.id);
      setErrorMsg(null);
      const file = model.localFileKey?.startsWith(ACCOUNT_FILE_PREFIX)
        ? await readAccountFile(model.localFileKey)
        : model.localFileKey ? await getFileFromIDB(model.localFileKey) : undefined;
      const buffer = file ? await file.arrayBuffer() : model.driveFileId ? await fetchDriveSTLArrayBuffer(model.driveFileId) : null;
      if (!buffer) throw new Error('This local STL file is missing. Restore a backup or upload it again.');
      onOpenModel(model, buffer);
    } catch (err: any) {
      console.error('Failed to open saved model:', err);
      setErrorMsg(err?.message || 'Could not load STL from Google Drive. Please verify your connection.');
    } finally {
      setLoadingModelId(null);
    }
  };

  const handleDownloadModel = async (model: SavedModel3D) => {
    if (!model.driveFileId && !model.localFileKey) {
      setErrorMsg('This model does not have a Google Drive file attached.');
      return;
    }

    try {
      setDownloadingModelId(model.id);
      setErrorMsg(null);
      const file = model.localFileKey?.startsWith(ACCOUNT_FILE_PREFIX)
        ? await readAccountFile(model.localFileKey)
        : model.localFileKey ? await getFileFromIDB(model.localFileKey) : undefined;
      const buffer = file ? await file.arrayBuffer() : model.driveFileId ? await fetchDriveSTLArrayBuffer(model.driveFileId) : null;
      if (!buffer) throw new Error('This local STL file is missing. Restore a backup or upload it again.');
      downloadSTLBuffer(buffer, model.originalFilename || model.name);
    } catch (err: any) {
      console.error('Failed to download saved model:', err);
      setErrorMsg(err?.message || 'Failed to download model file.');
    } finally {
      setDownloadingModelId(null);
    }
  };

  const submitRename = async () => {
    if (!editingModel || !renameText.trim()) return;
    try {
      setIsProcessingRename(true);
      await onRenameModel(editingModel, renameText.trim());
      setEditingModel(null);
      setRenameText('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to rename model.');
    } finally {
      setIsProcessingRename(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingModel) return;
    try {
      setIsProcessingDelete(true);
      if (deleteDriveFileChecked && deletingModel.driveFileId) {
        try {
          await deleteSTLFromDrive(deletingModel.driveFileId);
        } catch (e) {
          console.warn('Failed to delete from Drive:', e);
        }
      }
      await onDeleteModel(deletingModel.id, deletingModel.driveFileId, deleteDriveFileChecked);
      setDeletingModel(null);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete model record.');
    } finally {
      setIsProcessingDelete(false);
    }
  };

  return (
    <div className="w-full flex flex-col h-full overflow-hidden p-4 sm:p-6 bg-surface-container-lowest">
      
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#888888]" />
          <input
            type="text"
            placeholder="Search saved 3D models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-outline-variant/40 rounded-xl text-[14px] text-[#111111] placeholder-[#888888] focus:outline-hidden focus:border-primary transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[13px] text-[#666666] font-medium hidden sm:inline">
            {models.length} {models.length === 1 ? 'model' : 'models'} saved
          </span>
          <button
            onClick={onUploadClick}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl font-semibold text-[13px] hover:bg-primary/90 shadow-xs transition-all cursor-pointer"
          >
            <Box className="w-4 h-4" />
            Upload New STL
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3.5 bg-error-container/40 text-on-error-container rounded-xl border border-error/20 flex items-center justify-between gap-3 text-[13px]">
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            className="font-bold underline cursor-pointer text-error"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Models Grid */}
      <div className="flex-1 overflow-y-auto pr-1">
        {filteredModels.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
              <Box className="w-7 h-7" />
            </div>
            <h3 className="text-[17px] font-bold text-[#111111] mb-1">
              {searchQuery ? 'No matching models found' : 'No saved 3D models yet'}
            </h3>
            <p className="text-[13px] text-[#666666] max-w-sm mb-5 leading-relaxed">
              {searchQuery
                ? 'Try a different search term.'
                : 'Upload an STL file or choose one from Google Drive in the 3D Viewer, then click "Save Model" to keep it organized here.'}
            </p>
            {!searchQuery && (
              <button
                onClick={onUploadClick}
                className="px-5 py-2.5 bg-primary text-on-primary rounded-full font-semibold text-[13px] hover:bg-primary/90 shadow-sm transition-all cursor-pointer"
              >
                Upload STL File
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredModels.map((model) => {
              const isActive = activeModelId === model.id;
              const isLoading = loadingModelId === model.id;
              const isDownloading = downloadingModelId === model.id;

              return (
                <div
                  key={model.id}
                  className={`flex flex-col bg-white rounded-2xl border transition-all overflow-hidden ${
                    isActive
                      ? 'border-primary shadow-md ring-2 ring-primary/20'
                      : 'border-outline-variant/30 hover:border-outline-variant/70 hover:shadow-xs'
                  }`}
                >
                  {/* Thumbnail / Header Area */}
                  <div
                    onClick={() => handleViewModel(model)}
                    className="relative aspect-16/10 bg-surface-container-high cursor-pointer group flex items-center justify-center overflow-hidden"
                  >
                    {model.thumbnailUrl ? (
                      <img
                        src={model.thumbnailUrl}
                        alt={model.name}
                        className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-[#888888] gap-1">
                        <Box className="w-10 h-10 group-hover:text-primary transition-colors" />
                        <span className="text-[11px] font-medium">3D STL Preview</span>
                      </div>
                    )}

                    {/* Active Badge */}
                    {isActive && (
                      <div className="absolute top-2.5 left-2.5 bg-primary text-on-primary px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-xs">
                        Viewing Now
                      </div>
                    )}

                    {/* Drive Badge */}
                    {model.driveFileId && (
                      <div className="absolute top-2.5 right-2.5 bg-pink-100/90 backdrop-blur-xs text-white p-1 rounded-md text-[10px] flex items-center gap-1">
                        <HardDrive className="w-3 h-3" />
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-pink-100/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      {isLoading ? (
                        <div className="flex items-center gap-2 bg-pink-100/90 px-3 py-1.5 rounded-full text-[12px] font-medium">
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          Loading 3D...
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 bg-pink-100/90 px-3.5 py-1.5 rounded-full text-[12px] font-semibold">
                          <Eye className="w-4 h-4" />
                          Open in 3D Viewer
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-[15px] font-bold text-[#111111] leading-snug line-clamp-1">
                          {model.name}
                        </h4>
                        <span className="text-[11px] font-medium text-[#777777] shrink-0 bg-surface-container-low px-2 py-0.5 rounded-md">
                          {formatFileSize(model.fileSize)}
                        </span>
                      </div>

                      <p className="text-[12px] text-[#666666] truncate mt-0.5 font-mono">
                        {model.originalFilename}
                      </p>

                      {/* Dimensions & Stats */}
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-[#555555]">
                        {model.dimensions && (
                          <div className="flex items-center gap-1.5 bg-surface-container-low px-2 py-1 rounded-lg">
                            <Ruler className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="truncate">
                              {model.dimensions.x} × {model.dimensions.y} × {model.dimensions.z} mm
                            </span>
                          </div>
                        )}

                        {model.triangleCount && model.triangleCount > 0 ? (
                          <div className="flex items-center gap-1.5 bg-surface-container-low px-2 py-1 rounded-lg">
                            <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>{model.triangleCount.toLocaleString()} triangles</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-surface-container-low px-2 py-1 rounded-lg">
                            <Calendar className="w-3.5 h-3.5 text-[#888888] shrink-0" />
                            <span>{new Date(model.createdAt).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-4 pt-3 border-t border-outline-variant/30 flex items-center justify-between gap-1">
                      <button
                        onClick={() => handleViewModel(model)}
                        disabled={isLoading}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-primary/10 hover:bg-primary text-primary hover:text-on-primary rounded-lg text-[12px] font-semibold transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                        View
                      </button>

                      <button
                        onClick={() => {
                          setEditingModel(model);
                          setRenameText(model.name);
                        }}
                        title="Rename Model"
                        className="p-2 text-[#666666] hover:text-[#111111] hover:bg-surface-container-high rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDownloadModel(model)}
                        disabled={isDownloading}
                        title="Download STL File"
                        className="p-2 text-[#666666] hover:text-[#111111] hover:bg-surface-container-high rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isDownloading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        onClick={() => {
                          setDeletingModel(model);
                          setDeleteDriveFileChecked(false);
                        }}
                        title="Delete Model"
                        className="p-2 text-[#888888] hover:text-error hover:bg-error-container/30 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rename Modal */}
      {editingModel && (
        <div role="dialog" aria-modal="true" aria-label="SavedModelsList dialog" tabIndex={-1} className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-pink-100/90 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-black/10 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-[17px] font-bold text-[#111111] mb-2">Rename 3D Model</h3>
            <p className="text-[13px] text-[#666666] mb-4">
              Enter a new custom name for <span className="font-semibold text-[#111111]">{editingModel.originalFilename}</span>.
            </p>
            <input
              type="text"
              value={renameText}
              onChange={(e) => setRenameText(e.target.value)}
              placeholder="Model Name"
              autoFocus
              className="w-full px-4 py-2.5 border border-outline-variant/60 rounded-xl text-[14px] text-[#111111] focus:outline-hidden focus:border-primary mb-5"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingModel(null)}
                disabled={isProcessingRename}
                className="px-4 py-2 text-[13px] font-semibold text-[#666666] hover:bg-surface-container-high rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={submitRename}
                disabled={!renameText.trim() || isProcessingRename}
                className="flex items-center gap-2 px-5 py-2 text-[13px] font-semibold bg-primary text-on-primary rounded-xl hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isProcessingRename ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save Name
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingModel && (
        <div role="dialog" aria-modal="true" aria-label="SavedModelsList dialog" tabIndex={-1} className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-pink-100/90 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-black/10 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-error mb-3">
              <div className="p-2.5 bg-error-container/40 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-error" />
              </div>
              <h3 className="text-[17px] font-bold text-[#111111]">Delete 3D Model</h3>
            </div>
            
            <p className="text-[13px] text-[#555555] mb-4 leading-relaxed">
              Are you sure you want to remove <span className="font-bold text-[#111111]">"{deletingModel.name}"</span> from your saved models library?
            </p>

            {deletingModel.driveFileId && (
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 cursor-pointer mb-5 text-[13px] text-[#333333]">
                <input
                  type="checkbox"
                  checked={deleteDriveFileChecked}
                  onChange={(e) => setDeleteDriveFileChecked(e.target.checked)}
                  className="mt-0.5 rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="font-semibold block">Also delete file from Google Drive</span>
                  <span className="text-[11px] text-[#777777]">
                    Permanently removes the original .stl file from your Google Drive models folder.
                  </span>
                </div>
              </label>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeletingModel(null)}
                disabled={isProcessingDelete}
                className="px-4 py-2 text-[13px] font-semibold text-[#666666] hover:bg-surface-container-high rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isProcessingDelete}
                className="flex items-center gap-2 px-5 py-2 text-[13px] font-semibold bg-error text-on-error rounded-xl hover:bg-error/90 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isProcessingDelete ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
