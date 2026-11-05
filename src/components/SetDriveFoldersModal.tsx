import React, { useState, useEffect } from 'react';
import { Folder, FolderCheck, Loader2, X, Check, Search, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { updateUserSettings, getUserSettings } from '../lib/settingsUtils';
import { searchOrResolveHuntrrSpaceFolders } from '../lib/driveFolderUtils';
import { useGoogleDrivePicker } from '../hooks/useGoogleDrivePicker';

interface SetDriveFoldersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (folders: { mainFolderId: string; printsFolderId: string; boardsFolderId: string }) => void;
}

export const SetDriveFoldersModal: React.FC<SetDriveFoldersModalProps> = ({
  isOpen,
  onClose,
  onSaved
}) => {
  const { user } = useAuth();
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mainFolderId, setMainFolderId] = useState<string>('');
  const [printsFolderId, setPrintsFolderId] = useState<string>('');
  const [boardsFolderId, setBoardsFolderId] = useState<string>('');
  const [wikiFolderId, setWikiFolderId] = useState<string>('');

  useEffect(() => {
    if (isOpen && user && !user.isAnonymous) {
      getUserSettings(user.uid).then(settings => {
        if (settings?.driveFolders) {
          if (settings.driveFolders.mainFolderId) setMainFolderId(settings.driveFolders.mainFolderId);
          if (settings.driveFolders.printsFolderId) setPrintsFolderId(settings.driveFolders.printsFolderId);
          if (settings.driveFolders.boardsFolderId) setBoardsFolderId(settings.driveFolders.boardsFolderId);
          if (settings.driveFolders.wikiFolderId) setWikiFolderId(settings.driveFolders.wikiFolderId);
        }
      });
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleAutoDetect = async () => {
    setIsSearching(true);
    setError(null);
    try {
      const resolved = await searchOrResolveHuntrrSpaceFolders(mainFolderId || undefined);
      setMainFolderId(resolved.mainFolderId);
      setPrintsFolderId(resolved.printsFolderId);
      setBoardsFolderId(resolved.boardsFolderId);
      setWikiFolderId(resolved.wikiFolderId);
    } catch (err: any) {
      console.error("Auto detect drive folders failed:", err);
      setError(err?.message || 'Could not auto-detect folders. Please ensure you are connected to Google Drive.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSave = async () => {
    if (!user || user.isAnonymous) {
      setError("Please log in to save preferences.");
      return;
    }
    if (!printsFolderId) {
      setError("Please detect or set the prints folder ID first.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const folders = {
        mainFolderId: mainFolderId || '',
        printsFolderId,
        boardsFolderId: boardsFolderId || '',
        wikiFolderId: wikiFolderId || ''
      };
      await updateUserSettings(user.uid, { driveFolders: folders });
      onSaved(folders);
      onClose();
    } catch (err: any) {
      console.error("Failed to save drive folders preference:", err);
      setError(err?.message || 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="SetDriveFolders dialog" tabIndex={-1} className="fixed inset-0 z-[100] bg-pink-100/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-outline-variant/30">
        <div className="px-6 py-4 border-b border-outline-variant/20 flex justify-between items-center bg-white">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Folder className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-on-surface">Set Drive Photo Folders</h2>
          </div>
          <button onClick={onClose} className="p-2 text-on-surface-variant hover:bg-surface-variant/50 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-sm text-on-surface">
          <p className="text-on-surface-variant leading-relaxed">
            Configure your permanent Google Drive folders for photo storage. Print photos will be selected directly from:
            <br />
            <span className="font-semibold text-primary">My Drive / huntrr-space photos / prints</span>
          </p>

          {error && (
            <div className="p-3 bg-error/10 text-error rounded-xl text-xs font-semibold border border-error/20">
              {error}
            </div>
          )}

          <div className="space-y-3 bg-surface-variant/20 p-4 rounded-2xl border border-outline-variant/30">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Parent Folder (huntrr-space photos)
              </label>
              <div className="font-mono text-xs bg-white px-3 py-2 rounded-lg border border-outline-variant/40 flex items-center justify-between">
                <span className="truncate">{mainFolderId || 'Not set yet'}</span>
                {mainFolderId && <Check className="w-4 h-4 text-green-600 shrink-0" />}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Prints Folder (huntrr-space photos/prints)
              </label>
              <div className="font-mono text-xs bg-white px-3 py-2 rounded-lg border border-outline-variant/40 flex items-center justify-between">
                <span className="truncate">{printsFolderId || 'Not set yet'}</span>
                {printsFolderId && <Check className="w-4 h-4 text-green-600 shrink-0" />}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Boards Folder (huntrr-space photos/boards)
              </label>
              <div className="font-mono text-xs bg-white px-3 py-2 rounded-lg border border-outline-variant/40 flex items-center justify-between">
                <span className="truncate">{boardsFolderId || 'Not set yet'}</span>
                {boardsFolderId && <Check className="w-4 h-4 text-green-600 shrink-0" />}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Wiki Folder (huntrr-space photos/wiki)
              </label>
              <div className="font-mono text-xs bg-white px-3 py-2 rounded-lg border border-outline-variant/40 flex items-center justify-between">
                <span className="truncate">{wikiFolderId || 'Not set yet'}</span>
                {wikiFolderId && <Check className="w-4 h-4 text-green-600 shrink-0" />}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleAutoDetect}
              disabled={isSearching}
              className="w-full py-2.5 px-4 bg-surface-variant/50 hover:bg-surface-variant text-on-surface rounded-xl font-bold flex items-center justify-center gap-2 transition-colors border border-outline-variant/30 disabled:opacity-50"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Search className="w-4 h-4 text-primary" />}
              <span>{mainFolderId ? 'Re-Detect / Update Subfolders' : 'Detect "huntrr-space photos" Folder'}</span>
            </button>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-outline-variant/20 flex justify-end gap-3 bg-surface-container-lowest">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-on-surface-variant hover:bg-surface-variant/50 rounded-xl font-bold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !printsFolderId}
            className="px-5 py-2 bg-primary text-white hover:bg-primary/90 disabled:opacity-50 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-colors"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Save & Use Folder</span>
          </button>
        </div>
      </div>
    </div>
  );
};
