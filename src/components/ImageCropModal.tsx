import React, { useState, useEffect, useRef } from 'react';
import { X, RotateCcw, ZoomIn, ZoomOut, Check, Crop, Move } from 'lucide-react';
import { SmartImage } from './SmartImage';

export interface ImageCropSettings {
  x: number;   // horizontal offset in percentage (-50 to +50)
  y: number;   // vertical offset in percentage (-50 to +50)
  zoom: number; // zoom factor (1.0 to 3.5)
}

interface ImageCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  storagePath?: string;
  driveFileId?: string;
  thumbDriveFileId?: string;
  title?: string;
  initialCrop?: ImageCropSettings;
  onSaveCrop: (newCrop: ImageCropSettings) => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  storagePath,
  driveFileId,
  thumbDriveFileId,
  title = 'Photo',
  initialCrop,
  onSaveCrop,
}) => {
  const [crop, setCrop] = useState<ImageCropSettings>({
    x: initialCrop?.x ?? 0,
    y: initialCrop?.y ?? 0,
    zoom: initialCrop?.zoom ?? 1.0,
  });

  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:3' | '1/2'>('1:1');
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);

  const isDraggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startCropRef = useRef({ x: 0, y: 0 });
  const pinchDistRef = useRef<number | null>(null);
  const startZoomRef = useRef(1.0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCrop({
        x: initialCrop?.x ?? 0,
        y: initialCrop?.y ?? 0,
        zoom: initialCrop?.zoom ?? 1.0,
      });
    }
  }, [isOpen, initialCrop]);

  if (!isOpen) return null;

  // Pointer/Mouse Dragging
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    startCropRef.current = { x: crop.x, y: crop.y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const deltaX = e.clientX - startPosRef.current.x;
    const deltaY = e.clientY - startPosRef.current.y;

    // Convert pixel delta to percentage offset
    const percentX = (deltaX / rect.width) * 100;
    const percentY = (deltaY / rect.height) * 100;

    const newX = Math.min(Math.max(-80, startCropRef.current.x + percentX), 80);
    const newY = Math.min(Math.max(-80, startCropRef.current.y + percentY), 80);

    setCrop(prev => ({
      ...prev,
      x: Math.round(newX * 10) / 10,
      y: Math.round(newY * 10) / 10,
    }));
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  // Touch Pinch Zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      isDraggingRef.current = false;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchDistRef.current = dist;
      startZoomRef.current = crop.zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scaleFactor = dist / pinchDistRef.current;
      const newZoom = Math.min(Math.max(0.1, startZoomRef.current * scaleFactor), 3.5);
      setCrop(prev => ({ ...prev, zoom: Math.round(newZoom * 100) / 100 }));
    }
  };

  const handleTouchEnd = () => {
    pinchDistRef.current = null;
  };

  // Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setCrop(prev => {
      const newZoom = Math.min(Math.max(0.1, prev.zoom + delta), 3.5);
      return { ...prev, zoom: Math.round(newZoom * 100) / 100 };
    });
  };

  const handleReset = () => {
    let resetZoom = 1.0;
    if (imageAspectRatio) {
      const cr = aspectRatio === '1:1' ? 1 : aspectRatio === '4:3' ? 4/3 : 0.5;
      resetZoom = Math.min(cr / imageAspectRatio, imageAspectRatio / cr);
      // add a small buffer so it doesn't leave 1 pixel gaps due to rounding
      resetZoom = Math.max(0.1, resetZoom - 0.01);
    }
    setCrop({ x: 0, y: 0, zoom: resetZoom });
  };

  const handleSave = () => {
    onSaveCrop(crop);
    onClose();
  };

  // Calculate container aspect ratio class
  const aspectClass = aspectRatio === '1:1' ? 'aspect-square max-w-[340px] sm:max-w-[380px]' :
                      aspectRatio === '4:3' ? 'aspect-[4/3] max-w-[380px] sm:max-w-[420px]' :
                      'aspect-[1/2] max-w-[220px] sm:max-w-[260px]';

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-pink-100/90 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="planner-dark-panel bg-pink-100 border border-white/10 text-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col my-auto max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-pink-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#FF6B9E]/20 text-[#FF6B9E] rounded-xl">
              <Crop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg leading-tight text-white">Edit Photo Crop</h3>
              <p className="text-xs text-white/60 truncate max-w-[200px] sm:max-w-[280px]">{title}</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Interactive Stage */}
        <div className="p-4 sm:p-6 flex flex-col items-center justify-center overflow-y-auto">
          {/* Instruction hint */}
          <div className="flex items-center gap-2 text-xs text-white/70 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full mb-4">
            <Move className="w-3.5 h-3.5 text-[#FF6B9E]" />
            <span>Drag photo to position • Scroll/pinch to zoom</span>
          </div>

          {/* Bounding Box Frame with Exact Aspect Ratio */}
          <div className="w-full flex items-center justify-center py-2">
            <div 
              ref={containerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={handleWheel}
              className={`w-full ${aspectClass} relative rounded-2xl overflow-hidden border-2 border-[#FF6B9E] shadow-2xl bg-white cursor-grab active:cursor-grabbing select-none touch-none group`}
            >
              {/* Photo being cropped */}
              <div className="w-full h-full relative overflow-hidden pointer-events-none">
                <SmartImage 
                  src={imageUrl} 
                  storagePath={storagePath} 
                  driveFileId={driveFileId}
                  fallbackDriveFileId={thumbDriveFileId}
                  alt={title} 
                  className="w-full h-full object-cover transition-transform duration-75"
                  crop={crop}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalWidth && img.naturalHeight) {
                      setImageAspectRatio(img.naturalWidth / img.naturalHeight);
                    }
                  }}
                />
              </div>

              {/* Rule of Thirds Grid Lines */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none border border-white/15">
                <div className="border-r border-b border-white/15"></div>
                <div className="border-r border-b border-white/15"></div>
                <div className="border-b border-white/15"></div>
                <div className="border-r border-b border-white/15"></div>
                <div className="border-r border-b border-white/15"></div>
                <div className="border-b border-white/15"></div>
                <div className="border-r border-white/15"></div>
                <div className="border-r border-white/15"></div>
                <div></div>
              </div>

              {/* Zoom & Offset Badge */}
              <div className="absolute bottom-2 right-2 bg-pink-100/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-md border border-white/10 pointer-events-none">
                {Math.round(crop.zoom * 100)}% • X: {Math.round(crop.x)}% Y: {Math.round(crop.y)}%
              </div>
            </div>
          </div>

          {/* Aspect Ratio Preview Selector */}
          <div className="flex items-center gap-2 mt-4">
            <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider mr-1">Preview Ratio:</span>
            <button
              type="button"
              onClick={() => setAspectRatio('1:1')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${aspectRatio === '1:1' ? 'bg-[#FF6B9E] text-white shadow-md' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
            >
              1:1 Square
            </button>
            <button
              type="button"
              onClick={() => setAspectRatio('4:3')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${aspectRatio === '4:3' ? 'bg-[#FF6B9E] text-white shadow-md' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
            >
              4:3 Card
            </button>
            <button
              type="button"
              onClick={() => setAspectRatio('1/2')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${aspectRatio === '1/2' ? 'bg-[#FF6B9E] text-white shadow-md' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
            >
              Split Half
            </button>
          </div>

          {/* Zoom Slider Controls */}
          <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-white/80 font-bold">
              <span className="flex items-center gap-1.5"><ZoomIn className="w-4 h-4 text-[#FF6B9E]" /> Zoom Level</span>
              <span className="text-[#FF6B9E] font-mono">{Math.round(crop.zoom * 100)}%</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCrop(prev => ({ ...prev, zoom: Math.max(0.1, Math.round((prev.zoom - 0.1) * 10) / 10) }))}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors shrink-0"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <input 
                type="range"
                min="0.1"
                max="3.0"
                step="0.05"
                value={crop.zoom}
                onChange={e => setCrop(prev => ({ ...prev, zoom: parseFloat(e.target.value) }))}
                className="w-full accent-[#FF6B9E] cursor-pointer h-2 bg-white/20 rounded-lg"
              />

              <button
                type="button"
                onClick={() => setCrop(prev => ({ ...prev, zoom: Math.min(3.0, Math.round((prev.zoom + 0.1) * 10) / 10) }))}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors shrink-0"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-pink-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4 text-white/70" />
            <span>Reset Crop</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-transparent hover:bg-white/10 text-white/80 text-xs sm:text-sm font-bold rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 bg-[#FF6B9E] text-white hover:bg-[#FF6B9E]/90 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 shadow-lg transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Save Crop</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
