import { isLocalUser } from '../lib/workspaceMode';
import { saveFileToIDB, deleteFileFromIDB } from '../lib/idb';
import { ACCOUNT_FILE_PREFIX, uploadAccountFile } from '../lib/accountFiles';
import { getAccountOwner } from '../lib/accountStore';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Upload,
  HardDrive,
  FolderOpen,
  RotateCcw,
  Maximize2,
  Eye,
  Grid,
  Compass,
  Palette,
  Camera,
  Layers,
  FileCode,
  Save,
  Check,
  AlertCircle,
  AlertTriangle,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
  Sparkles,
  Sliders,
  Sun,
  Moon
} from 'lucide-react';
import { STL3DCanvas, STL3DCanvasHandle, CameraPreset, CameraProjection } from './ModelViewer/STL3DCanvas';
import { DriveSTLPickerModal } from './ModelViewer/DriveSTLPickerModal';
import { SavedModelsList } from './ModelViewer/SavedModelsList';
import { SavedModel3D, Model3DDimensions } from '../types';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc } from '../lib/workspaceStore';
import { sanitizeFirestorePayload } from '../lib/firestoreUtils';
import { uploadSTLToDrive, fetchDriveSTLArrayBuffer, downloadSTLBuffer, deleteSTLFromDrive } from '../lib/stlDriveService';
import { generateSampleCalibrationCubeSTL } from '../lib/sampleSTL';
import { v4 as uuidv4 } from 'uuid';

const MODEL_COLORS = [
  { name: 'Warm Ivory', hex: '#F5F0EB', isLight: true },
  { name: 'Space Gray', hex: '#71717A', isLight: false },
  { name: 'Strawberry', hex: '#FFB8CD', isLight: true },
  { name: 'Lavender', hex: '#D8B4FE', isLight: true },
  { name: 'Mint Green', hex: '#86EFAC', isLight: true },
  { name: 'Coral Orange', hex: '#FB923C', isLight: false },
  { name: 'Silk Gold', hex: '#FCD34D', isLight: true },
  { name: 'Sky Blue', hex: '#93C5FD', isLight: true },
  { name: 'Dark Slate', hex: '#334155', isLight: false },
  { name: 'Pure White', hex: '#FFFFFF', isLight: true },
];

const BACKGROUND_COLORS = [
  { name: 'Soft Light Pink', hex: '#FFF0F6', isDark: false },
  { name: 'Rose Blush', hex: '#FFE4E6', isDark: false },
  { name: 'Clean White', hex: '#FFFFFF', isDark: false },
  { name: 'Warm Cream', hex: '#FFF7ED', isDark: false },
  { name: 'Petal Pink', hex: '#FCE4EF', isDark: false },
  { name: 'Soft Ivory', hex: '#FFFDF8', isDark: false },
];

export function ModelViewerView() {
  const { user } = useAuth();
  const canvasRef = useRef<STL3DCanvasHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Model State
  const [activeTab, setActiveTab] = useState<'viewer' | 'saved'>('viewer');
  const [currentSTLBuffer, setCurrentSTLBuffer] = useState<ArrayBuffer | null>(null);
  const [currentFilename, setCurrentFilename] = useState<string>('sample_calibration_cube.stl');
  const [currentFileSize, setCurrentFileSize] = useState<number>(0);
  const [currentDriveFileId, setCurrentDriveFileId] = useState<string | undefined>(undefined);
  const [currentActiveModelId, setCurrentActiveModelId] = useState<string | null>(null);
  const [modelStats, setModelStats] = useState<{
    dimensions: Model3DDimensions;
    triangleCount: number;
    volume: number;
  } | null>(null);

  // Display and Render Settings
  const [modelColor, setModelColor] = useState<string>('#FFB8CD');
  const [backgroundColor, setBackgroundColor] = useState<string>('#FFF0F6');
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showAxes, setShowAxes] = useState<boolean>(true);
  const [cameraProjection, setCameraProjection] = useState<CameraProjection>('perspective');

  // UI Control states
  const [isDragOver, setIsDragOver] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveModelName, setSaveModelName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);
  const [showColorDrawer, setShowColorDrawer] = useState(false);
  const [showViewPresetsDrawer, setShowViewPresetsDrawer] = useState(false);

  // Large File Warning Modal State
  const [pendingLargeFile, setPendingLargeFile] = useState<{
    file: File;
    buffer: ArrayBuffer;
  } | null>(null);

  // Saved Models from Firestore / Local Storage
  const [savedModels, setSavedModels] = useState<SavedModel3D[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);

  // Load initial sample calibration cube if no model is loaded yet
  useEffect(() => {
    if (!currentSTLBuffer) {
      const sample = generateSampleCalibrationCubeSTL();
      setCurrentSTLBuffer(sample);
      setCurrentFilename('calibration_cube_30mm.stl');
      setCurrentFileSize(sample.byteLength);
    }
  }, []);

  // Listen to Firestore saved models
  useEffect(() => {
    if (!user || user.isAnonymous) {
      // Local session storage for guest mode
      try {
        const stored = localStorage.getItem('huntrr_saved_models_guest');
        if (stored) {
          setSavedModels(JSON.parse(stored));
        }
      } catch (e) {
        console.warn('Error reading local saved models:', e);
      }
      setLoadingSaved(false);
      return;
    }

    const unsub = onSnapshot(
      collection(db, `users/${user.uid}/saved_models`),
      (snapshot) => {
        const list: SavedModel3D[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        list.sort((a, b) => b.createdAt - a.createdAt);
        setSavedModels(list);
        setLoadingSaved(false);
      },
      (err) => {
        console.error('Error fetching saved models:', err);
        setLoadingSaved(false);
      }
    );

    return () => unsub();
  }, [user]);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processSelectedFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processSelectedFile(file);
    }
    // reset input so same file can be selected again if desired
    e.target.value = '';
  };

  const processSelectedFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.stl')) {
      setErrorMessage('Please select a valid .stl 3D file.');
      return;
    }

    setErrorMessage(null);

    // Large file check (> 35MB)
    const MAX_SAFE_SIZE = 35 * 1024 * 1024;
    try {
      const buffer = await file.arrayBuffer();

      if (file.size > MAX_SAFE_SIZE) {
        setPendingLargeFile({ file, buffer });
        return;
      }

      loadSTLBufferIntoViewer(buffer, file.name, file.size);
    } catch (err: any) {
      console.error('Failed to read file:', err);
      setErrorMessage('Failed to read the selected file.');
    }
  };

  const loadSTLBufferIntoViewer = (
    buffer: ArrayBuffer,
    filename: string,
    fileSize: number,
    driveFileId?: string,
    modelId?: string
  ) => {
    setCurrentSTLBuffer(buffer);
    setCurrentFilename(filename);
    setCurrentFileSize(fileSize);
    setCurrentDriveFileId(driveFileId);
    setCurrentActiveModelId(modelId || null);
    setSaveModelName(filename.replace(/\.stl$/i, ''));
    setActiveTab('viewer');
  };

  const handleDriveSTLSelected = (data: {
    arrayBuffer: ArrayBuffer;
    filename: string;
    fileSize: number;
    driveFileId: string;
  }) => {
    loadSTLBufferIntoViewer(data.arrayBuffer, data.filename, data.fileSize, data.driveFileId);
  };

  const handleOpenSavedModel = (model: SavedModel3D, arrayBuffer: ArrayBuffer) => {
    loadSTLBufferIntoViewer(
      arrayBuffer,
      model.originalFilename,
      model.fileSize,
      model.driveFileId,
      model.id
    );
  };

  const handleSaveModel = async () => {
    if (!currentSTLBuffer) return;
    setIsSaving(true);
    setErrorMessage(null);
    setUploadProgress(0);

    try {
      const customName = saveModelName.trim() || currentFilename.replace(/\.stl$/i, '');
      let driveId = currentDriveFileId;

      // 1. If not already on Google Drive, upload original STL to Drive dedicated models folder
      const cloudAccount = getAccountOwner() === user.uid;
      if (!driveId && !isLocalUser(user) && !cloudAccount) {
        const blob = new Blob([currentSTLBuffer], { type: 'model/stl' });
        const uploadRes = await uploadSTLToDrive(blob, currentFilename, (percent) => {
          setUploadProgress(percent);
        });
        driveId = uploadRes.driveFileId;
        setCurrentDriveFileId(driveId);
      }

      // 2. Capture clean snapshot thumbnail from Canvas
      let thumbnailDataUrl: string | undefined = undefined;
      if (canvasRef.current) {
        thumbnailDataUrl = canvasRef.current.captureSnapshot() || undefined;
      }

      // 3. Create document record
      const modelRecordId = currentActiveModelId || uuidv4();
      const modelFile = new Blob([currentSTLBuffer], { type: 'model/stl' });
      const localFileKey = cloudAccount
        ? await uploadAccountFile(user.uid, modelFile)
        : isLocalUser(user) ? `huntrr_local_stl_${modelRecordId}` : undefined;
      if (localFileKey && !cloudAccount) await saveFileToIDB(localFileKey, modelFile);
      const modelRecord: SavedModel3D = {
        localFileKey,
        id: modelRecordId,
        name: customName,
        originalFilename: currentFilename,
        driveFileId: driveId,
        fileSize: currentFileSize || currentSTLBuffer.byteLength,
        triangleCount: modelStats?.triangleCount,
        dimensions: modelStats?.dimensions,
        thumbnailUrl: thumbnailDataUrl,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      if (user && !user.isAnonymous) {
        const sanitized = sanitizeFirestorePayload(modelRecord);
        await setDoc(doc(db, `users/${user.uid}/saved_models`, modelRecordId), sanitized);
      } else {
        // Guest mode local storage
        const currentList = [...savedModels];
        const existingIdx = currentList.findIndex((m) => m.id === modelRecordId);
        if (existingIdx >= 0) {
          currentList[existingIdx] = modelRecord;
        } else {
          currentList.unshift(modelRecord);
        }
        setSavedModels(currentList);
        try {
          localStorage.setItem('huntrr_saved_models_guest', JSON.stringify(currentList));
        } catch (_) {}
      }

      setCurrentActiveModelId(modelRecordId);
      setShowSaveModal(false);
      setSaveSuccessMessage('Model saved to your library!');
      setTimeout(() => setSaveSuccessMessage(null), 3500);
    } catch (err: any) {
      console.error('Error saving model:', err);
      setErrorMessage(err?.message || 'Failed to save model to Google Drive / Database.');
    } finally {
      setIsSaving(false);
      setUploadProgress(null);
    }
  };

  const handleRenameSavedModel = async (model: SavedModel3D, newName: string) => {
    if (user && !user.isAnonymous) {
      await updateDoc(doc(db, `users/${user.uid}/saved_models`, model.id), {
        name: newName,
        updatedAt: Date.now(),
      });
    } else {
      const updated = savedModels.map((m) =>
        m.id === model.id ? { ...m, name: newName, updatedAt: Date.now() } : m
      );
      setSavedModels(updated);
      try {
        localStorage.setItem('huntrr_saved_models_guest', JSON.stringify(updated));
      } catch (_) {}
    }
  };

  const handleDeleteSavedModel = async (
    modelId: string,
    driveFileId?: string,
    deleteFromDriveFlag = false
  ) => {
    if (user && !user.isAnonymous) {
      await deleteDoc(doc(db, `users/${user.uid}/saved_models`, modelId));
      const deleted = savedModels.find(m => m.id === modelId);
      if (deleted?.localFileKey && !deleted.localFileKey.startsWith(ACCOUNT_FILE_PREFIX)) await deleteFileFromIDB(deleted.localFileKey);
    } else {
      const updated = savedModels.filter((m) => m.id !== modelId);
      setSavedModels(updated);
      try {
        localStorage.setItem('huntrr_saved_models_guest', JSON.stringify(updated));
      } catch (_) {}
    }

    if (currentActiveModelId === modelId) {
      setCurrentActiveModelId(null);
    }
  };

  const handleDownloadActiveSTL = () => {
    if (!currentSTLBuffer) return;
    downloadSTLBuffer(currentSTLBuffer, currentFilename);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className="flex flex-col w-full h-[100dvh] md:h-[100dvh] overflow-hidden bg-surface"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden File Input for .stl files */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".stl,model/stl,application/sla"
        className="hidden"
      />

      {/* Top Header Bar */}
      <header className="shrink-0 bg-white/95 backdrop-blur-md border-b border-outline-variant/30 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0">
            <Box className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[16px] sm:text-[18px] font-bold text-[#111111] truncate leading-tight">
              3D Model Viewer
            </h1>
            <p className="text-[11px] sm:text-[12px] text-[#666666] truncate font-mono">
              {currentFilename} ({formatFileSize(currentFileSize)})
            </p>
          </div>
        </div>

        {/* View / Saved Segmented Switcher & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Tab switch */}
          <div className="flex bg-surface-container-low p-0.5 rounded-xl border border-outline-variant/30 text-[12px]">
            <button
              onClick={() => setActiveTab('viewer')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'viewer'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-[#666666] hover:text-[#111111]'
              }`}
            >
              3D Viewer
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'saved'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-[#666666] hover:text-[#111111]'
              }`}
            >
              <span>Saved</span>
              <span className="bg-primary/10 text-primary px-1.5 py-0.2 rounded-full text-[10px]">
                {savedModels.length}
              </span>
            </button>
          </div>

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload .stl file from computer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-[#222222] rounded-xl text-[12px] font-semibold transition-colors cursor-pointer border border-outline-variant/30"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Upload STL</span>
          </button>

          {/* Google Drive Picker Button */}
          <button
            onClick={() => setShowDrivePicker(true)}
            title="Choose STL from Google Drive"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-[#222222] rounded-xl text-[12px] font-semibold transition-colors cursor-pointer border border-outline-variant/30"
          >
            <HardDrive className="w-4 h-4 text-[#4285F4]" />
            <span className="hidden md:inline">Drive</span>
          </button>

          {/* Save to Library Button */}
          <button
            onClick={() => {
              setSaveModelName(currentFilename.replace(/\.stl$/i, ''));
              setShowSaveModal(true);
            }}
            title="Save model to library"
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-on-primary hover:bg-primary/90 rounded-xl text-[12px] font-semibold shadow-xs transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">Save</span>
          </button>
        </div>
      </header>

      {/* Notification Toast Banners */}
      {saveSuccessMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-600 text-white rounded-full text-[13px] font-semibold shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Check className="w-4 h-4" />
          {saveSuccessMessage}
        </div>
      )}

      {errorMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-error text-on-error rounded-xl text-[13px] font-medium shadow-lg flex items-center gap-3 animate-in fade-in duration-200 max-w-md">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-white/20 rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main View Area */}
      <div className="flex-1 relative w-full h-full overflow-hidden">
        {activeTab === 'saved' ? (
          <SavedModelsList
            models={savedModels}
            activeModelId={currentActiveModelId}
            onOpenModel={handleOpenSavedModel}
            onRenameModel={handleRenameSavedModel}
            onDeleteModel={handleDeleteSavedModel}
            onUploadClick={() => fileInputRef.current?.click()}
          />
        ) : (
          <div className="relative w-full h-full">
            
            {/* 3D WebGL Canvas */}
            <STL3DCanvas
              ref={canvasRef}
              stlData={currentSTLBuffer}
              modelColor={modelColor}
              backgroundColor={backgroundColor}
              wireframe={wireframe}
              showGrid={showGrid}
              showAxes={showAxes}
              projection={cameraProjection}
              onModelLoaded={(info) => {
                setModelStats(info);
              }}
              onError={(err) => {
                setErrorMessage(err);
              }}
            />

            {/* Drag & Drop Visual Overlay */}
            {isDragOver && (
              <div className="absolute inset-0 bg-primary/20 backdrop-blur-xs border-4 border-dashed border-primary z-40 flex flex-col items-center justify-center pointer-events-none">
                <div className="p-4 bg-white rounded-2xl shadow-xl flex flex-col items-center gap-2">
                  <Upload className="w-10 h-10 text-primary animate-bounce" />
                  <p className="text-[16px] font-bold text-[#111111]">Drop .stl file to render 3D Model</p>
                  <p className="text-[12px] text-[#666666]">Supports Binary and ASCII STL files</p>
                </div>
              </div>
            )}

            {/* Floating Top-Left Stats HUD (Collapsible) */}
            <div className="absolute top-3 left-3 z-20 max-w-[280px] sm:max-w-xs transition-all">
              <div className="bg-white/95 backdrop-blur-md text-[#222222] rounded-2xl border border-[#fbcfe8] shadow-md overflow-hidden">
                <button
                  onClick={() => setIsStatsCollapsed(!isStatsCollapsed)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left cursor-pointer hover:bg-[#FFF0F6]/80 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-primary" />
                    <span className="text-[12px] font-bold tracking-wide uppercase text-[#333333]">
                      Model Dimensions & Stats
                    </span>
                  </div>
                  {isStatsCollapsed ? (
                    <ChevronDown className="w-4 h-4 text-[#666666]" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-[#666666]" />
                  )}
                </button>

                {!isStatsCollapsed && (
                  <div className="px-3.5 pb-3.5 pt-1 space-y-2 text-[12px] border-t border-[#fbcfe8]/60">
                    <div className="grid grid-cols-3 gap-2 text-center py-1">
                      <div className="bg-[#FFF0F6] border border-[#fbcfe8]/60 rounded-lg p-1.5">
                        <span className="text-[10px] text-[#666666] block font-mono">WIDTH (X)</span>
                        <span className="font-bold text-[13px] text-[#111111]">
                          {modelStats?.dimensions?.x ?? 0} <span className="text-[10px]">mm</span>
                        </span>
                      </div>
                      <div className="bg-[#FFF0F6] border border-[#fbcfe8]/60 rounded-lg p-1.5">
                        <span className="text-[10px] text-[#666666] block font-mono">HEIGHT (Y)</span>
                        <span className="font-bold text-[13px] text-[#111111]">
                          {modelStats?.dimensions?.y ?? 0} <span className="text-[10px]">mm</span>
                        </span>
                      </div>
                      <div className="bg-[#FFF0F6] border border-[#fbcfe8]/60 rounded-lg p-1.5">
                        <span className="text-[10px] text-[#666666] block font-mono">DEPTH (Z)</span>
                        <span className="font-bold text-[13px] text-[#111111]">
                          {modelStats?.dimensions?.z ?? 0} <span className="text-[10px]">mm</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#555555] pt-1 border-t border-[#fbcfe8]/60">
                      <span>Triangles (Faces):</span>
                      <span className="font-mono font-semibold text-[#111111]">
                        {modelStats?.triangleCount?.toLocaleString() ?? 0}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#555555]">
                      <span>Bounding Volume:</span>
                      <span className="font-mono font-semibold text-[#111111]">
                        {modelStats?.volume ? `${(modelStats.volume / 1000).toFixed(1)} cm³` : '0 cm³'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#555555]">
                      <span>File Size:</span>
                      <span className="font-mono font-semibold text-[#111111]">
                        {formatFileSize(currentFileSize)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Floating Camera Presets Bar (Top Right) */}
            <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-1.5">
              <div className="bg-white/95 backdrop-blur-md p-1.5 rounded-2xl border border-[#fbcfe8] shadow-md flex items-center gap-1">
                <button
                  onClick={() => canvasRef.current?.setCameraPreset('reset')}
                  title="Reset View / Isometric"
                  className="px-2.5 py-1.5 hover:bg-[#FFF0F6] text-[#333333] hover:text-[#111111] rounded-xl text-[12px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden sm:inline">Reset</span>
                </button>

                <button
                  onClick={() => canvasRef.current?.setCameraPreset('fit')}
                  title="Fit to Screen"
                  className="px-2.5 py-1.5 hover:bg-[#FFF0F6] text-[#333333] hover:text-[#111111] rounded-xl text-[12px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden sm:inline">Fit</span>
                </button>

                <div className="h-4 w-px bg-[#fbcfe8] mx-0.5" />

                {/* View Angle Presets Dropdown/Toggle */}
                <button
                  onClick={() => setShowViewPresetsDrawer(!showViewPresetsDrawer)}
                  className={`px-2.5 py-1.5 rounded-xl text-[12px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    showViewPresetsDrawer ? 'bg-primary text-on-primary shadow-xs' : 'text-[#333333] hover:bg-[#FFF0F6] hover:text-[#111111]'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Views</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Angle Presets Panel */}
              {showViewPresetsDrawer && (
                <div className="bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-[#fbcfe8] shadow-xl grid grid-cols-3 gap-1.5 text-[#333333] animate-in fade-in slide-in-from-top-1 duration-150">
                  {(['front', 'back', 'left', 'right', 'top', 'bottom'] as CameraPreset[]).map(
                    (viewKey) => (
                      <button
                        key={viewKey}
                        onClick={() => {
                          canvasRef.current?.setCameraPreset(viewKey);
                          setShowViewPresetsDrawer(false);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#FFF0F6] hover:bg-primary hover:text-white text-[11px] font-semibold capitalize transition-colors text-center cursor-pointer border border-[#fbcfe8]/50"
                      >
                        {viewKey}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Floating Bottom Viewport Controls Toolbar */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 max-w-[95vw] overflow-x-auto p-1.5 bg-white/95 backdrop-blur-md rounded-2xl border border-[#fbcfe8] shadow-xl text-[#333333]">
              
              {/* Build Plate Grid Toggle */}
              <button
                onClick={() => setShowGrid(!showGrid)}
                title="Toggle Build Plate Grid"
                className={`p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-[12px] font-semibold ${
                  showGrid ? 'bg-primary text-on-primary shadow-xs' : 'text-[#444444] hover:bg-[#FFF0F6] hover:text-[#111111]'
                }`}
              >
                <Grid className="w-4 h-4" />
                <span className="hidden sm:inline">Grid</span>
              </button>

              {/* Axes Helper Toggle */}
              <button
                onClick={() => setShowAxes(!showAxes)}
                title="Toggle XYZ Coordinate Axes"
                className={`p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-[12px] font-semibold ${
                  showAxes ? 'bg-primary text-on-primary shadow-xs' : 'text-[#444444] hover:bg-[#FFF0F6] hover:text-[#111111]'
                }`}
              >
                <Compass className="w-4 h-4" />
                <span className="hidden sm:inline">Axes</span>
              </button>

              {/* Wireframe Mode Toggle */}
              <button
                onClick={() => setWireframe(!wireframe)}
                title="Toggle Wireframe Mesh"
                className={`p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-[12px] font-semibold ${
                  wireframe ? 'bg-primary text-on-primary shadow-xs' : 'text-[#444444] hover:bg-[#FFF0F6] hover:text-[#111111]'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span className="hidden sm:inline">Wireframe</span>
              </button>

              {/* Perspective vs Orthographic */}
              <button
                onClick={() =>
                  setCameraProjection((prev) => (prev === 'perspective' ? 'orthographic' : 'perspective'))
                }
                title={`Switch camera mode (Current: ${cameraProjection})`}
                className="p-2 hover:bg-[#FFF0F6] text-[#444444] hover:text-[#111111] rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-[12px] font-semibold"
              >
                <Camera className="w-4 h-4" />
                <span className="hidden sm:inline capitalize">{cameraProjection}</span>
              </button>

              <div className="h-5 w-px bg-[#fbcfe8] mx-0.5" />

              {/* Colors Drawer Button */}
              <button
                onClick={() => setShowColorDrawer(!showColorDrawer)}
                title="Change Model & Canvas Colors"
                className={`p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-[12px] font-semibold ${
                  showColorDrawer ? 'bg-primary text-on-primary shadow-xs' : 'text-[#444444] hover:bg-[#FFF0F6] hover:text-[#111111]'
                }`}
              >
                <Palette className="w-4 h-4" />
                <span className="hidden sm:inline">Colors</span>
              </button>

              {/* Download STL Button */}
              <button
                onClick={handleDownloadActiveSTL}
                title="Download current .stl file"
                className="p-2 hover:bg-[#FFF0F6] text-[#444444] hover:text-[#111111] rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-[12px] font-semibold"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download</span>
              </button>
            </div>

            {/* Floating Colors Drawer */}
            {showColorDrawer && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 w-[90vw] max-w-md bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-[#fbcfe8] shadow-2xl text-[#222222] animate-in fade-in slide-in-from-bottom-2 duration-150">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[13px] font-bold tracking-wide uppercase text-[#222222] flex items-center gap-2">
                    <Palette className="w-4 h-4 text-primary" />
                    Color Appearance
                  </h4>
                  <button
                    onClick={() => setShowColorDrawer(false)}
                    className="p-1 text-[#666666] hover:text-[#111111] rounded-full cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Model Filament Colors */}
                <div className="mb-3.5">
                  <span className="text-[11px] text-[#555555] block mb-2 font-medium">Model Color</span>
                  <div className="flex items-center flex-wrap gap-2">
                    {MODEL_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        onClick={() => setModelColor(c.hex)}
                        title={c.name}
                        style={{ backgroundColor: c.hex }}
                        className={`w-7 h-7 rounded-full transition-transform cursor-pointer border ${
                          modelColor.toLowerCase() === c.hex.toLowerCase()
                            ? 'scale-125 ring-2 ring-primary border-transparent'
                            : 'border-outline-variant/40 hover:scale-110'
                        }`}
                      />
                    ))}
                    <div className="flex items-center gap-1 ml-1 bg-[#FFF0F6] px-2 py-0.5 rounded-lg border border-[#fbcfe8]">
                      <span className="text-[10px] text-[#666666]">HEX</span>
                      <input
                        type="color"
                        value={modelColor}
                        onChange={(e) => setModelColor(e.target.value)}
                        className="w-5 h-5 bg-transparent border-0 cursor-pointer p-0"
                      />
                    </div>
                  </div>
                </div>

                {/* Background Theme Selector */}
                <div>
                  <span className="text-[11px] text-[#555555] block mb-2 font-medium">Background Tone</span>
                  <div className="flex items-center flex-wrap gap-2">
                    {BACKGROUND_COLORS.map((b) => (
                      <button
                        key={b.hex}
                        onClick={() => setBackgroundColor(b.hex)}
                        title={b.name}
                        style={{ backgroundColor: b.hex }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                          backgroundColor.toLowerCase() === b.hex.toLowerCase()
                            ? 'ring-2 ring-primary border-primary font-bold shadow-xs'
                            : 'border-outline-variant/50 hover:border-primary/50'
                        } ${b.isDark ? 'text-white' : 'text-[#222222]'}`}
                      >
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* Large File Warning Modal */}
      {pendingLargeFile && (
        <div role="dialog" aria-modal="true" aria-label="Modeler dialog" tabIndex={-1} className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-pink-100/90 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-black/10 animate-in fade-in zoom-in-95 duration-150 text-left">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <div className="p-2.5 bg-amber-100 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-[17px] font-bold text-[#111111]">Large STL File Warning</h3>
            </div>

            <p className="text-[13px] text-[#555555] mb-3 leading-relaxed">
              <span className="font-bold text-[#111111]">{pendingLargeFile.file.name}</span> is{' '}
              <span className="font-bold text-amber-700">{formatFileSize(pendingLargeFile.file.size)}</span>.
            </p>
            <p className="text-[12px] text-[#666666] mb-5 bg-surface-container-low p-3 rounded-xl">
              Parsing very large 3D models with hundreds of thousands of triangles may take a few moments and use extra device memory.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setPendingLargeFile(null)}
                className="px-4 py-2 text-[13px] font-semibold text-[#666666] hover:bg-surface-container-high rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  loadSTLBufferIntoViewer(
                    pendingLargeFile.buffer,
                    pendingLargeFile.file.name,
                    pendingLargeFile.file.size
                  );
                  setPendingLargeFile(null);
                }}
                className="px-5 py-2 text-[13px] font-semibold bg-primary text-on-primary rounded-xl hover:bg-primary/90 transition-colors cursor-pointer shadow-xs"
              >
                Continue & Render Model
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Model Modal */}
      {showSaveModal && (
        <div role="dialog" aria-modal="true" aria-label="Modeler dialog" tabIndex={-1} className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-pink-100/90 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-black/10 animate-in fade-in zoom-in-95 duration-150 text-left">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                  <Save className="w-5 h-5" />
                </div>
                <h3 className="text-[17px] font-bold text-[#111111]">Save 3D Model to Library</h3>
              </div>
              <button
                onClick={() => setShowSaveModal(false)}
                disabled={isSaving}
                className="p-1 text-[#666666] hover:text-[#111111] rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[13px] text-[#666666] mb-4">
              Saves model dimensions, triangle count, and stores original STL file in your Google Drive Models folder.
            </p>

            <div className="space-y-4 mb-5">
              <div>
                <label className="block text-[12px] font-bold text-[#333333] mb-1.5 uppercase tracking-wide">
                  Model Custom Name
                </label>
                <input
                  type="text"
                  value={saveModelName}
                  onChange={(e) => setSaveModelName(e.target.value)}
                  placeholder="e.g., Cat Planter Small"
                  className="w-full px-4 py-2.5 border border-outline-variant/60 rounded-xl text-[14px] text-[#111111] focus:outline-hidden focus:border-primary"
                />
              </div>

              <div className="bg-surface-container-low p-3 rounded-xl space-y-1.5 text-[12px] text-[#555555]">
                <div className="flex justify-between">
                  <span className="text-[#777777]">Original File:</span>
                  <span className="font-mono font-medium text-[#111111]">{currentFilename}</span>
                </div>
                {modelStats?.dimensions && (
                  <div className="flex justify-between">
                    <span className="text-[#777777]">Dimensions:</span>
                    <span className="font-semibold text-[#111111]">
                      {modelStats.dimensions.x} × {modelStats.dimensions.y} × {modelStats.dimensions.z} mm
                    </span>
                  </div>
                )}
                {modelStats?.triangleCount && (
                  <div className="flex justify-between">
                    <span className="text-[#777777]">Triangles:</span>
                    <span className="font-semibold text-[#111111]">
                      {modelStats.triangleCount.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {uploadProgress !== null && uploadProgress > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-[#666666] font-medium">
                    <span>Uploading STL to Google Drive...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowSaveModal(false)}
                disabled={isSaving}
                className="px-4 py-2 text-[13px] font-semibold text-[#666666] hover:bg-surface-container-high rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveModel}
                disabled={!saveModelName.trim() || isSaving}
                className="flex items-center gap-2 px-5 py-2 text-[13px] font-semibold bg-primary text-on-primary rounded-xl hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving Model...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Model
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Drive STL Picker Modal */}
      {showDrivePicker && (
        <DriveSTLPickerModal
          onClose={() => setShowDrivePicker(false)}
          onSelectSTL={handleDriveSTLSelected}
        />
      )}
    </div>
  );
}
