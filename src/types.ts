export type ViewState = 'jobs' | 'agenda' | 'log' | 'mood' | 'streaks' | 'month' | 'notes' | 'charts' | 'printing' | 'reminders' | 'pinterest' | 'habits' | 'wiki' | 'blog' | 'goals' | 'goals_streaks' | 'keychains' | 'minifurniture' | 'receipts' | 'settings' | 'shopping' | 'models';

export interface Model3DDimensions {
  x: number; // width in mm
  y: number; // height in mm
  z: number; // depth in mm
}

export interface SavedModel3D {
  id: string;
  name: string;
  originalFilename: string;
  driveFileId?: string;
  localFileKey?: string;
  driveFolderId?: string;
  fileSize: number; // in bytes
  triangleCount?: number;
  dimensions?: Model3DDimensions;
  thumbnailUrl?: string; // compressed base64 dataUrl preview
  createdAt: number;
  updatedAt?: number;
  notes?: string;
}
