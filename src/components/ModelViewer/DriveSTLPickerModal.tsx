import React, { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, AlertCircle, Box, Loader2, LogIn, Search, HardDrive } from 'lucide-react';
import { getAccessToken } from '../../lib/AuthContext';
import { requestFreshDriveToken } from '../../lib/driveAuth';
import { listDriveSTLFiles, fetchDriveSTLArrayBuffer, DriveSTLFileItem } from '../../lib/stlDriveService';
import { 
  ModelCategoryType, 
  MODEL_CATEGORY_NAMES, 
  getOrResolveModelCategoryFolder 
} from '../../lib/driveFolderUtils';

interface DriveSTLPickerModalProps {
  onClose: () => void;
  onSelectSTL: (data: {
    arrayBuffer: ArrayBuffer;
    filename: string;
    fileSize: number;
    driveFileId: string;
  }) => void;
}

const CATEGORY_TABS: { id: ModelCategoryType; label: string }[] = [
  { id: 'charms', label: 'Charms' },
  { id: 'nailCharms', label: 'Nail Charms' },
  { id: 'figures', label: 'Figures' },
];

export function DriveSTLPickerModal({ onClose, onSelectSTL }: DriveSTLPickerModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<ModelCategoryType>('charms');
  const [files, setFiles] = useState<DriveSTLFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needAuth, setNeedAuth] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Track active category request to avoid race conditions
  const activeCategoryRef = useRef<ModelCategoryType>('charms');

  const loadFiles = async (categoryToLoad: ModelCategoryType, forceInteractiveAuth = false) => {
    activeCategoryRef.current = categoryToLoad;
    setLoading(true);
    setError(null);
    setNeedAuth(false);

    try {
      let token = getAccessToken();

      if (forceInteractiveAuth) {
        setIsAuthenticating(true);
        token = await requestFreshDriveToken(true);
        setIsAuthenticating(false);
      } else if (!token) {
        token = await requestFreshDriveToken(false);
      }

      if (!token) {
        setNeedAuth(true);
        setError('Google Drive connection needed to access files.');
        setLoading(false);
        return;
      }

      // Resolve the dedicated subfolder for the selected category
      const folderId = await getOrResolveModelCategoryFolder(categoryToLoad);
      
      const driveFiles = await listDriveSTLFiles(folderId);

      // Only update if this is still the active category
      if (activeCategoryRef.current === categoryToLoad) {
        setFiles(driveFiles);
      }
    } catch (err: any) {
      console.error(`Failed to list STL files for category ${categoryToLoad}:`, err);
      const msg = err?.message || String(err);
      if (msg.includes('authorization') || msg.includes('token') || msg.includes('401') || msg.includes('403')) {
        setNeedAuth(true);
        setError('Google Drive authorization expired. Please reconnect.');
      } else {
        setError(msg || `Failed to load STL files for ${MODEL_CATEGORY_NAMES[categoryToLoad]}.`);
      }
    } finally {
      if (activeCategoryRef.current === categoryToLoad) {
        setLoading(false);
        setIsAuthenticating(false);
      }
    }
  };

  useEffect(() => {
    loadFiles(selectedCategory, false);
  }, [selectedCategory]);

  const handleCategoryChange = (newCat: ModelCategoryType) => {
    if (newCat === selectedCategory && !loading) return;
    setSelectedCategory(newCat);
    setSearchQuery('');
  };

  const handleSelectFile = async (item: DriveSTLFileItem) => {
    try {
      setDownloadingId(item.id);
      setError(null);

      const arrayBuffer = await fetchDriveSTLArrayBuffer(item.id);
      
      onSelectSTL({
        arrayBuffer,
        filename: item.name,
        fileSize: item.size || arrayBuffer.byteLength,
        driveFileId: item.id,
      });

      onClose();
    } catch (err: any) {
      console.error('Error downloading STL from Drive:', err);
      setError(err?.message || 'Failed to download 3D model from Google Drive.');
      setDownloadingId(null);
    }
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const categoryName = MODEL_CATEGORY_NAMES[selectedCategory];

  return (
    <div role="dialog" aria-modal="true" aria-label="DriveSTLPicker dialog" tabIndex={-1} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-pink-100/90 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-black/10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-black/10 flex items-center justify-between bg-surface-variant/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[18px] font-bold text-[#111111] leading-tight">Select STL from Google Drive</h2>
              <p className="text-[12px] text-[#666666]">Open 3D models stored in your Drive categories</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#666666] hover:text-[#111111] hover:bg-pink-100/5 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Selector Tabs */}
        <div className="px-4 pt-3.5 pb-2.5 border-b border-black/5 bg-surface-container-lowest flex items-center justify-between flex-wrap gap-2">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[13px]">
            {CATEGORY_TABS.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer font-semibold ${
                    isSelected
                      ? 'bg-white text-primary shadow-xs font-bold'
                      : 'text-[#666666] hover:text-[#111111] hover:bg-pink-100/5'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => loadFiles(selectedCategory, false)}
            disabled={loading}
            title={`Refresh ${categoryName} file list`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-low hover:bg-surface-container-high text-[#666666] hover:text-[#111111] text-[12px] font-medium rounded-xl border border-outline-variant/30 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 sm:p-4 border-b border-black/10 bg-surface">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" />
            <input
              type="text"
              placeholder={`Search ${categoryName} models...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-surface-container-lowest border border-outline-variant/40 rounded-xl text-[14px] text-[#111111] placeholder-[#888888] focus:outline-hidden focus:border-primary transition-colors"
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[250px]">
          {needAuth ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                <LogIn className="w-6 h-6" />
              </div>
              <h3 className="text-[16px] font-bold text-[#111111] mb-1">Google Drive Access Required</h3>
              <p className="text-[13px] text-[#666666] max-w-sm mb-4">
                Connect your Google account to browse and load STL files from your Drive storage.
              </p>
              <button
                onClick={() => loadFiles(selectedCategory, true)}
                disabled={isAuthenticating}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-full font-semibold text-[14px] hover:bg-primary/90 shadow-sm transition-all cursor-pointer disabled:opacity-60"
              >
                {isAuthenticating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Connect Google Drive
                  </>
                )}
              </button>
            </div>
          ) : error ? (
            <div className="p-4 bg-error-container/40 text-on-error-container rounded-xl border border-error/20 flex items-start gap-3 my-4">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-error" />
              <div className="flex-1 text-[13px]">
                <p className="font-semibold text-error mb-1">Could not load files</p>
                <p>{error}</p>
                <button
                  onClick={() => loadFiles(selectedCategory, true)}
                  className="mt-2 text-[12px] font-semibold underline text-primary cursor-pointer hover:opacity-80"
                >
                  Reconnect Drive & Retry
                </button>
              </div>
            </div>
          ) : loading ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
              <p className="text-[14px] font-medium text-[#666666]">
                Loading {categoryName} models from Google Drive...
              </p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-surface-container-high text-[#888888] flex items-center justify-center mb-3">
                <Box className="w-6 h-6" />
              </div>
              <h3 className="text-[15px] font-bold text-[#222222] mb-1">
                {searchQuery 
                  ? `No matching models found in ${categoryName}` 
                  : `No STL files found in ${categoryName}.`}
              </h3>
              <p className="text-[13px] text-[#666666] max-w-sm mb-2">
                {searchQuery
                  ? `Try clearing your search query to see all ${categoryName} models.`
                  : `Store your 3D STL files in the "${categoryName}" models folder in Google Drive to view and load them here.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredFiles.map((file) => {
                const isDownloading = downloadingId === file.id;
                return (
                  <button
                    key={file.id}
                    onClick={() => handleSelectFile(file)}
                    disabled={Boolean(downloadingId)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant/30 bg-surface hover:bg-primary/5 hover:border-primary/40 transition-all text-left group cursor-pointer disabled:opacity-60"
                  >
                    <div className="p-2.5 rounded-lg bg-surface-container-high group-hover:bg-primary/10 text-[#555555] group-hover:text-primary transition-colors shrink-0">
                      {isDownloading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      ) : (
                        <Box className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#111111] truncate group-hover:text-primary transition-colors">
                        {file.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#777777]">
                        <span>{formatFileSize(file.size)}</span>
                        {file.modifiedTime && (
                          <>
                            <span>•</span>
                            <span>{new Date(file.modifiedTime).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-black/10 bg-surface-container-lowest flex items-center justify-between">
          <span className="text-[12px] text-[#777777]">
            {filteredFiles.length} {filteredFiles.length === 1 ? 'model' : 'models'} in {categoryName}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-[#333333] text-[13px] font-semibold rounded-full transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}

