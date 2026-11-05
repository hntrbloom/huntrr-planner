import React, { useState, useEffect } from 'react';
import { X, RefreshCw, AlertCircle, Image as ImageIcon, Loader2, LogIn, Check, Upload } from 'lucide-react';
import { getAccessToken, useAuth } from '../lib/AuthContext';
import { uploadImageToService } from '../lib/imageService';
import { searchOrResolveHuntrrSpaceFolders } from '../lib/driveFolderUtils';
import { requestFreshDriveToken } from '../lib/driveAuth';
import { SmartImage } from './SmartImage';
import { flattenImageOverWhite } from '../lib/imageFlattening';

interface DriveImage {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  url?: string;
}

interface SharedDriveImagePickerProps {
  onClose: () => void;
  onSelect: (image: DriveImage) => void;
}

export function SharedDriveImagePicker({ onClose, onSelect, folderId, title = 'Select Photo', uploadSection = 'general' }: SharedDriveImagePickerProps & { folderId: string, title?: string, uploadSection?: string }) {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [images, setImages] = useState<DriveImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needAuth, setNeedAuth] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchImages = async (forceInteractiveAuth = false) => {
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
        // Attempt silent token refresh without showing a popup
        token = await requestFreshDriveToken(false);
      }

      if (!token) {
        setNeedAuth(true);
        setError('Google Drive connection needed.');
        setLoading(false);
        return;
      }

      

      const query = `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`;
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,thumbnailLink,webContentLink)&pageSize=100`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setNeedAuth(true);
          setError('Google Drive access expired or permission denied.');
          setLoading(false);
          return;
        }
        throw new Error(`Drive API error (${res.status})`);
      }

      const data = await res.json();

      setImages((data.files || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        thumbnailLink: f.thumbnailLink,
        url: f.webContentLink || `https://drive.google.com/thumbnail?id=${f.id}`
      })));
    } catch (err: any) {
      console.error('Failed to load wiki images:', err);
      setError(err.message || 'Failed to load images from Google Drive.');
    } finally {
      setLoading(false);
      setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    fetchImages(false);
  }, []);

  
  const handleLocalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setError(null);
      let token = getAccessToken();
      if (!token) {
        token = await requestFreshDriveToken(false);
      }
      if (!token) {
        throw new Error("Google Drive connection needed to upload.");
      }

      
      
      let uploadFile: File | Blob = file;
      let uploadFilename = file.name;
      let uploadWidth: number | undefined;
      let uploadHeight: number | undefined;

      if (uploadSection === 'wiki') {
        const flattened = await flattenImageOverWhite(file);
        uploadFile = flattened.blob;
        uploadWidth = flattened.width;
        uploadHeight = flattened.height;
        if (!uploadFilename.toLowerCase().endsWith('.png')) {
          uploadFilename = `${uploadFilename.replace(/\.[^/.]+$/, '')}.png`;
        }
      }

      const result = await uploadImageToService({
        file: uploadFile,
        userId: user?.uid || 'guest',
        section: uploadSection,
        recordId: 'wiki-upload',
        filename: uploadFilename,
        width: uploadWidth,
        height: uploadHeight,
        driveFolderId: folderId,
      });

      if (!result.driveFileId) {
        throw new Error("Upload succeeded but no Drive File ID was returned.");
      }

      const newImg = {
        id: result.driveFileId,
        name: file.name,
        mimeType: result.mimeType || file.type,
        thumbnailLink: result.downloadURL,
        url: result.downloadURL, 
      };

      setImages(prev => [newImg, ...prev]);
      setSelectedId(newImg.id);
      
    } catch (err: any) {
      console.error('Failed to upload image:', err);
      setError(err.message || 'Failed to upload image.');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };


  const handleUsePhoto = () => {
    const selected = images.find(img => img.id === selectedId);
    if (selected) {
      onSelect(selected);
    }
  };

  return (
    <div 
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-4 bg-pink-100/90 backdrop-blur-sm"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-none sm:rounded-[24px] w-full max-w-2xl h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#FFB8CD]/30 bg-[#FFF0F4] shrink-0">
          <h2 className="text-[18px] font-bold text-black flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-[#FFB8CD]" /> {title}
          </h2>
          
          <div className="flex items-center gap-2">
            <label className={`px-3 py-1.5 sm:px-4 bg-[#FFB8CD] hover:bg-[#FFB8CD]/90 text-white text-[13px] font-bold rounded-full cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span className="hidden sm:inline">{isUploading ? 'Uploading...' : 'Upload Photo'}</span>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                disabled={isUploading}
                onChange={handleLocalUpload} 
              />
            </label>
            <button

              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fetchImages(false);
              }}
              className="p-2 text-black/40 hover:text-black hover:bg-white rounded-full transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-2 text-black/40 hover:text-black hover:bg-white rounded-full transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-white relative">
          {needAuth ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-4 my-auto">
              <div className="w-16 h-16 bg-[#FFF0F4] rounded-full flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-[#FFB8CD]" />
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-black mb-1">Connect Google Drive</h3>
                <p className="text-[13px] text-black/60 max-w-xs mx-auto">
                  Authorize access to view and choose photos from this Google Drive folder.
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fetchImages(true);
                }}
                disabled={isAuthenticating}
                className="px-6 py-2.5 bg-[#FFB8CD] hover:bg-[#FFB8CD]/90 text-white rounded-full font-bold text-[14px] shadow-md flex items-center gap-2 cursor-pointer transition-transform active:scale-95 disabled:opacity-50"
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
            <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-4 my-auto">
              <AlertCircle className="w-12 h-12 text-red-400" />
              <p className="text-[14px] text-black/60 max-w-sm">{error}</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fetchImages(true);
                }}
                className="px-5 py-2 bg-[#FFB8CD] hover:bg-[#FFB8CD]/90 text-white rounded-full font-bold text-[13px] shadow-sm cursor-pointer"
              >
                Reconnect Google Drive
              </button>
            </div>
          ) : loading && images.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3 my-auto">
              <Loader2 className="w-10 h-10 text-[#FFB8CD] animate-spin" />
              <p className="text-[14px] font-medium text-black/50">Loading photos from Drive...</p>
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3 my-auto">
              <div className="w-20 h-20 bg-[#FFF0F4] rounded-full flex items-center justify-center mb-2">
                <ImageIcon className="w-10 h-10 text-[#FFB8CD]/50" />
              </div>
              <p className="text-[16px] font-bold text-black">No photos found in this folder</p>
              <p className="text-[13px] text-black/60 max-w-xs">
                Upload image files to this folder in Google Drive, or use the Upload Photo button, then tap refresh above.
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fetchImages(false);
                }}
                className="mt-2 px-4 py-2 bg-[#FFF0F4] hover:bg-[#FFB8CD]/20 text-[#FFB8CD] font-bold text-[13px] rounded-full transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" /> Refresh Folder
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {images.map(img => (
                <div
                  key={img.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(img.id);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onSelect(img);
                  }}
                  className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer group border-2 transition-all ${
                    selectedId === img.id 
                      ? 'border-[#FFB8CD] ring-2 ring-[#FFB8CD]/40 shadow-md' 
                      : 'border-transparent hover:border-[#FFB8CD]/50'
                  }`}
                >
                  <SmartImage
                    driveFileId={img.id}
                    src={img.thumbnailLink || img.url}
                    alt={img.name}
                    className="w-full h-full object-cover"
                  />
                  {selectedId === img.id && (
                    <div className="absolute inset-0 bg-[#FFB8CD]/25 z-20 flex items-center justify-center">
                      <div className="bg-[#FFB8CD] text-white p-1.5 rounded-full shadow-lg transform scale-110">
                        <Check className="w-5 h-5 stroke-[3]" />
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 z-20">
                    <p className="text-white text-[10px] truncate font-medium text-center">{img.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div 
          onClick={(e) => e.stopPropagation()}
          className="p-4 pb-[max(env(safe-area-inset-bottom),16px)] sm:pb-4 border-t border-[#FFB8CD]/30 bg-gray-50 flex justify-end gap-3 sm:rounded-b-[24px] shrink-0 z-30"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="px-5 py-2 text-[14px] font-bold text-black/60 hover:text-black hover:bg-pink-100/5 rounded-full transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleUsePhoto();
            }}
            disabled={!selectedId}
            className={`px-6 py-2 text-[14px] font-bold rounded-full transition-all shadow-sm cursor-pointer ${
              selectedId 
                ? 'bg-[#FFB8CD] hover:bg-[#FFB8CD]/90 text-white active:scale-95' 
                : 'bg-pink-100/5 text-black/30 cursor-not-allowed'
            }`}
          >
            Use Photo
          </button>
        </div>
      </div>
    </div>
  );
}

