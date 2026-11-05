import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, AlertCircle, RefreshCw } from 'lucide-react';
import { useImageCache } from '../hooks/useImageCache';

export interface ImageCropSettings {
  x: number;
  y: number;
  zoom: number;
}

export interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  storagePath?: string;
  driveFileId?: string;
  fallbackDriveFileId?: string;
  isThumbnail?: boolean;
  fallbackIcon?: React.ReactNode;
  crop?: ImageCropSettings;
  priority?: boolean;
}

export const SmartImage: React.FC<SmartImageProps> = ({ 
  src, 
  storagePath, 
  driveFileId, 
  fallbackDriveFileId,
  isThumbnail,
  priority,
  fallbackIcon, 
  crop,
  alt, 
  className = '', 
  style, 
  ...props 
}) => {
  const [retried, setRetried] = useState(false);

  const { displayUrl, isLoading, hasError, errorMessage, retry } = useImageCache(
    storagePath, 
    src, 
    driveFileId, 
    fallbackDriveFileId
  );

  useEffect(() => {
    setRetried(false);
  }, [src, storagePath, driveFileId, fallbackDriveFileId]);

  const handleError = () => {
    if (!retried) {
      setRetried(true);
      retry(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-pink-100/5 animate-pulse ${className || ''}`} style={style}>
        <ImageIcon className="w-6 h-6 text-black/20" />
      </div>
    );
  }

  // Error state
  if (hasError || !displayUrl) {
    if (fallbackIcon) return <>{fallbackIcon}</>;
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center bg-pink-100/5 text-black/40 p-2 text-center select-none ${className || ''}`} style={style}>
        <AlertCircle className="w-5 h-5 mb-1 opacity-50 text-amber-600/70" />
        <span className="text-[10px] line-clamp-1 mb-1">{errorMessage || 'Image not found'}</span>
        <button 
          type="button"
          onClick={(e) => { e.stopPropagation(); retry(true); }}
          className="flex items-center gap-1 text-[10px] font-semibold bg-white/90 hover:bg-white text-black/70 px-2 py-0.5 rounded-full shadow-xs border border-black/10 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  // Cropped Image Rendering
  if (crop) {
    return (
      <div 
        className={`relative overflow-hidden ${className || ''}`.replace('object-cover', '')}
        style={style}
      >
        <div 
          className="w-full h-full relative"
          style={{
            transform: `translate(${crop.x || 0}%, ${crop.y || 0}%) scale(${crop.zoom ?? 1})`,
            transformOrigin: 'center center'
          }}
        >
          <img
            src={displayUrl}
            alt={alt || ''}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            onError={handleError}
            {...props}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              minWidth: '100%',
              minHeight: '100%',
              width: 'auto',
              height: 'auto',
              transform: 'translate(-50%, -50%)',
              maxWidth: 'none',
              maxHeight: 'none'
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <img
      src={displayUrl}
      alt={alt || ''}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={className}
      style={style}
      onError={handleError}
      {...props}
    />
  );
};
