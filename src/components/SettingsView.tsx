import { isLocalUser } from '../lib/workspaceMode';
import React, { useState, useEffect, useRef } from 'react';
import { Download, Upload, Save, AlertCircle, RefreshCw, Image as ImageIcon, Database, Folder, CheckCircle, ExternalLink, FolderOpen, Check, Loader2, RotateCcw } from 'lucide-react';
import { useAuth, getAccessToken, setAccessToken } from '../lib/AuthContext';
import { requestFreshDriveToken, getLastOAuthDiagnostic, OAuthDiagnosticInfo } from '../lib/driveAuth';
import { gatherAllData, restoreData, validateBackup } from '../lib/backup';
import { deleteAllData, deleteTabData, TabId } from '../lib/reset';
import { uploadToDrive } from '../lib/drive';
import { runPhotoMigration, MigrationReport } from '../lib/imageService';
import { getUserSettings, initializeDriveFolders, updateUserSettings } from '../lib/settingsUtils';
import { SetDriveFoldersModal } from './SetDriveFoldersModal';
import { getAllPrintTypes, getPrintFolderId, extractDriveFolderId, testDriveFolderAccess, DEFAULT_PRINT_TYPES, PrintTypeDefinition } from '../lib/driveFolderUtils';
import { db, safeGetDoc } from '../lib/firebase';
import { collection, getDocs, doc } from '../lib/workspaceStore';
import { getAccountOwner } from '../lib/accountStore';
import { portableBackup } from '../lib/accountMigration';
import { AccountSettings } from './AccountSettings';

const TAB_RESETS: { id: TabId; label: string; confirmText: string; keyword: string }[] = [
  { id: 'sets', label: 'Reset All Sets', confirmText: 'This will permanently delete all Sets.', keyword: 'SETS' },
  { id: 'charms', label: 'Reset All Charms', confirmText: 'This will permanently delete all Charms.', keyword: 'CHARMS' },
  { id: 'objects', label: 'Reset All Objects', confirmText: 'This will permanently delete all Objects.', keyword: 'OBJECTS' },
  { id: 'nail_charms', label: 'Reset All Nail Charms', confirmText: 'This will permanently delete all Nail Charms.', keyword: 'NAIL CHARMS' },
  { id: 'mini_furniture', label: 'Reset All Mini Furniture', confirmText: 'This will permanently delete all Mini Furniture.', keyword: 'MINI FURNITURE' },
  { id: 'prints', label: 'Reset All Prints', confirmText: 'This will permanently delete all Prints.', keyword: 'PRINTS' },
  { id: 'goals', label: 'Reset All Goals', confirmText: 'This will permanently delete all Goals.', keyword: 'GOALS' },
  { id: 'habits', label: 'Reset All Habits', confirmText: 'This will permanently delete all Habits.', keyword: 'HABITS' },
  { id: 'boards', label: 'Reset All Boards', confirmText: 'This will permanently delete all Boards.', keyword: 'BOARDS' },
  { id: 'receipts', label: 'Reset All Receipts', confirmText: 'This will permanently delete all Receipts.', keyword: 'RECEIPTS' },
  { id: 'shopping', label: 'Reset All Shopping Lists', confirmText: 'This will permanently delete all Shopping Lists.', keyword: 'SHOPPING' },
  { id: 'dailylogs', label: 'Reset All Daily Logs', confirmText: 'This will permanently delete all Daily Logs and Moods.', keyword: 'LOGS' },
  { id: 'notes', label: 'Reset All Notes', confirmText: 'This will permanently delete all Notes.', keyword: 'NOTES' },
  { id: 'reminders', label: 'Reset All Reminders', confirmText: 'This will permanently delete all Reminders.', keyword: 'REMINDERS' },
  { id: 'keychains', label: 'Reset All Keychains', confirmText: 'This will permanently delete all Keychains.', keyword: 'KEYCHAINS' },
  { id: 'wiki', label: 'Reset Character Wiki', confirmText: 'This will permanently delete all Character Wiki entries.', keyword: 'WIKI' },
  { id: 'blog', label: 'Reset All Blog Posts', confirmText: 'This will permanently delete all Blog posts.', keyword: 'BLOG' },
];

export function SettingsView() {
  const { user, signIn, logOut } = useAuth();
  const emailAccount = Boolean(getAccountOwner());
  const restoreInput = useRef<HTMLInputElement>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [migrationReport, setMigrationReport] = useState<MigrationReport | null>(null);
  const [driveFolders, setDriveFolders] = useState<any>(null);
  const [showDriveFoldersModal, setShowDriveFoldersModal] = useState(false);
  
  const [resetTab, setResetTab] = useState<TabId | null>(null);
  const [resetKeyword, setResetKeyword] = useState('');

  // Drive Folder IDs state for Print types
  const [printFolderMap, setPrintFolderMap] = useState<Record<string, string>>({});
  const [printTypesList, setPrintTypesList] = useState<PrintTypeDefinition[]>(DEFAULT_PRINT_TYPES);
  const [testingStatus, setTestingStatus] = useState<Record<string, { loading: boolean; success?: boolean; error?: string }>>({});
  const [isSavingFolderIds, setIsSavingFolderIds] = useState(false);
  const [savedFolderIdsConfirm, setSavedFolderIdsConfirm] = useState(false);

  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [driveOAuthDiag, setDriveOAuthDiag] = useState<OAuthDiagnosticInfo | null>(null);

  const handleConnectDrive = async () => {
    if (isLocalUser(user)) { await signIn(); return; }
    setIsConnectingDrive(true);
    setStatus(null);
    setDriveOAuthDiag(null);
    try {
      const token = await requestFreshDriveToken(true);
      if (token) {
        setAccessToken(token);
        setStatus({ type: 'success', message: 'Google Drive connected successfully!' });
        if (user && !user.isAnonymous) {
          try {
            const folders = await initializeDriveFolders(user.uid, true);
            setDriveFolders(folders);
          } catch (e) {
            console.error("Failed to initialize folders after login", e);
          }
        }
      } else {
        const diag = getLastOAuthDiagnostic();
        setDriveOAuthDiag(diag);
        if (diag.lastErrorType === 'popup_closed') {
          setStatus({ type: 'info', message: 'Google sign-in popup was closed before completing authorization.' });
        } else if (diag.lastErrorType === 'popup_failed_to_open') {
          setStatus({ type: 'error', message: 'Popup was blocked by iPad Safari. Please allow popups or tap "Try Again".' });
        } else if (diag.lastErrorType === 'missing_client_id') {
          setStatus({ type: 'error', message: 'Google OAuth Client ID is missing. Please check your app settings.' });
        } else {
          setStatus({ type: 'error', message: diag.lastErrorMessage || 'Failed to connect Google Drive. Tap Try Again.' });
        }
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err?.message || 'Error connecting to Google Drive.' });
    } finally {
      setIsConnectingDrive(false);
    }
  };

  useEffect(() => {
    const loadSettingsAndTypes = async () => {
      let customTypes: string[] = [];
      try {
        if (user && !user.isAnonymous) {
          const catSnap = await safeGetDoc(doc(db, `users/${user.uid}/preferences`, 'miniFurnitureCategories'));
          if (catSnap.exists() && catSnap.data().categories) {
            customTypes = catSnap.data().categories.map((c: any) => c.name || c).filter(Boolean);
          }
        }
      } catch (_) {}

      const allTypes = getAllPrintTypes(customTypes);
      setPrintTypesList(allTypes);

      let currentSettings: any = null;
      if (user && !user.isAnonymous) {
        currentSettings = await getUserSettings(user.uid);
        if (currentSettings?.driveFolders) {
          setDriveFolders(currentSettings.driveFolders);
        }
      }

      const initialMap: Record<string, string> = {};
      for (const def of allTypes) {
        initialMap[def.name] = getPrintFolderId(def.name, currentSettings || undefined);
      }
      setPrintFolderMap(initialMap);
    };

    loadSettingsAndTypes();
  }, [user]);

  const handlePrintFolderChange = (typeName: string, val: string) => {
    const extracted = extractDriveFolderId(val);
    setPrintFolderMap(prev => ({
      ...prev,
      [typeName]: extracted
    }));
    setSavedFolderIdsConfirm(false);
  };

  const handleSavePrintFolderIds = async () => {
    setIsSavingFolderIds(true);
    try {
      const sanitizedMap: Record<string, string> = {};
      for (const [k, v] of Object.entries(printFolderMap)) {
        sanitizedMap[k] = extractDriveFolderId(String(v || ''));
      }

      // 1. Save to localStorage
      localStorage.setItem('huntrr_print_folder_ids', JSON.stringify(sanitizedMap));

      // 2. Save to Firestore userSettings if signed in
      if (user && !user.isAnonymous) {
        await updateUserSettings(user.uid, {
          printFolderIds: sanitizedMap
        });
      }

      setPrintFolderMap(sanitizedMap);
      setSavedFolderIdsConfirm(true);
      setStatus({ type: 'success', message: 'Drive Folder IDs saved successfully!' });
      setTimeout(() => setSavedFolderIdsConfirm(false), 4000);
    } catch (e: any) {
      console.error('Failed to save print folder IDs', e);
      setStatus({ type: 'error', message: 'Failed to save Drive Folder IDs: ' + (e.message || String(e)) });
    } finally {
      setIsSavingFolderIds(false);
    }
  };

  const handleTestPrintFolder = async (typeName: string) => {
    const rawVal = printFolderMap[typeName] || getPrintFolderId(typeName);
    const folderId = extractDriveFolderId(rawVal);

    if (!folderId) {
      setTestingStatus(prev => ({
        ...prev,
        [typeName]: { loading: false, success: false, error: 'Folder ID is blank.' }
      }));
      return;
    }

    setTestingStatus(prev => ({
      ...prev,
      [typeName]: { loading: true }
    }));

    try {
      const result = await testDriveFolderAccess(folderId);
      setTestingStatus(prev => ({
        ...prev,
        [typeName]: {
          loading: false,
          success: result.success,
          error: result.success ? undefined : result.error
        }
      }));

      // Open in Google Drive in a new tab
      window.open(`https://drive.google.com/drive/folders/${folderId}`, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setTestingStatus(prev => ({
        ...prev,
        [typeName]: {
          loading: false,
          success: false,
          error: err.message || 'Error opening folder'
        }
      }));
    }
  };

  const handleResetToDefaults = () => {
    const defaultMap: Record<string, string> = {};
    for (const def of printTypesList) {
      defaultMap[def.name] = def.defaultFolderId;
    }
    setPrintFolderMap(defaultMap);
    setSavedFolderIdsConfirm(false);
  };

  const handleRepairDriveFolders = async () => {
    if (!user || user.isAnonymous) {
      setStatus({ type: 'error', message: 'You must be signed in to repair folders.' });
      return;
    }
    const token = getAccessToken();
    if (!token) {
      setStatus({ type: 'error', message: 'Google Drive access token is missing. Please sign in again.' });
      return;
    }
    
    setIsBackingUp(true);
    setStatus({ type: 'info', message: 'Scanning and repairing Google Drive folders...' });
    try {
      const folders = await initializeDriveFolders(user.uid, true);
      setDriveFolders(folders);
      setStatus({ type: 'success', message: 'Drive folders checked and repaired successfully.' });
    } catch (e: any) {
      console.error(e);
      setStatus({ type: 'error', message: `Drive folder repair failed: ${e.message}` });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRunPhotoMigration = async () => {
    if (!user || user.isAnonymous) {
      setStatus({ type: 'error', message: 'You must be signed in to repair photo storage.' });
      return;
    }
    setIsBackingUp(true);
    setStatus({ type: 'info', message: 'Scanning all Firestore records and backing up photos to Firebase Storage & Google Drive...' });
    try {
      const report = await runPhotoMigration(user.uid);
      setMigrationReport(report);
      setStatus({ 
        type: 'success', 
        message: `Photo migration complete! Scanned ${report.totalScanned} photos. Recovered/Migrated: ${report.recovered}, Unrecoverable (old blob URLs): ${report.unrecoverable}.` 
      });
    } catch (e: any) {
      console.error(e);
      setStatus({ type: 'error', message: `Photo migration failed: ${e.message}` });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleBackupNow = async () => {
    if (!user || user.isAnonymous) {
      setStatus({ type: 'error', message: 'You must be signed in to backup.' });
      return;
    }
    const token = getAccessToken();
    if (!token) {
      setStatus({ type: 'error', message: 'Google Drive access token is missing. Please sign in again.' });
      return;
    }

    setIsBackingUp(true);
    setStatus({ type: 'info', message: 'Gathering data...' });
    try {
      const data = await gatherAllData(user.uid);
      const json = JSON.stringify(data, null, 2);
      const file = new File([json], `planner_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`, { type: 'application/json' });
      
      setStatus({ type: 'info', message: 'Uploading backup to Google Drive...' });
      await uploadToDrive(file, 'Hunter Planner Backups');
      setStatus({ type: 'success', message: 'Backup completed successfully and saved to Google Drive.' });
    } catch (e: any) {
      console.error(e);
      setStatus({ type: 'error', message: `Backup failed: ${e.message}` });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleExportEverything = async (portable = false) => {
    if (!user || user.isAnonymous) {
      setStatus({ type: 'error', message: 'You must be signed in to export data.' });
      return;
    }
    setIsBackingUp(true);
    setStatus({ type: 'info', message: 'Gathering data for export...' });
    try {
      const data = await (portable ? portableBackup(user.uid) : gatherAllData(user.uid));
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `planner_export_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus({ type: 'success', message: 'Export completed.' });
    } catch (e: any) {
      console.error(e);
      setStatus({ type: 'error', message: `Export failed: ${e.message}` });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreBackup = () => restoreInput.current?.click();
  const importBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || !user) return;
    setIsBackingUp(true);
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error('Choose a backup smaller than 100 MB.');
      const backup = JSON.parse(await file.text());
      const { count } = validateBackup(backup);
      if (!window.confirm(`Restore ${count} records into this ${isLocalUser(user) ? 'local' : 'cloud'} workspace? Matching record IDs will be merged with the backup values. Other records will be kept. Export a current backup first if needed.`)) return;
      await restoreData(user.uid, backup);
      setStatus({ type: 'success', message: 'Backup restored. Reopen a tab to see its records.' });
    } catch (error: any) { setStatus({ type: 'error', message: `Restore failed: ${error.message}. Existing records were not cleared. If a large restore was interrupted, you can retry the same file.` }); }
    finally { setIsBackingUp(false); }
  };
  
  const handleFactoryReset = async () => {
    if (!window.confirm("WARNING: This will permanently delete ALL your data, logs, habits, and preferences across the entire app. This action CANNOT be undone. Are you absolutely sure?")) {
      return;
    }
    
    if (user && !user.isAnonymous) {
      setIsBackingUp(true);
      setStatus({ type: 'info', message: 'Deleting all cloud data...' });
      try {
        await deleteAllData(user.uid);
      } catch (e: any) {
        setStatus({ type: 'error', message: 'Failed to delete cloud data.' });
        setIsBackingUp(false);
        return;
      }
    }
    
    // Clear local storage
    if (!emailAccount) localStorage.clear();
    
    setStatus({ type: 'success', message: 'All data has been deleted. Reloading...' });
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };
  

  return (
    <div className="flex-1 flex flex-col relative w-full h-[100dvh] overflow-hidden bg-surface">
      <div className="flex flex-col h-full overflow-y-auto px-4 md:px-8 py-8 md:py-12">
        <div className="max-w-3xl mx-auto w-full">
          <h1 className="text-[32px] md:text-[40px] font-bold font-headline-md text-on-surface mb-8 tracking-tight">Settings</h1>

          <input ref={restoreInput} type="file" accept=".json,application/json" className="hidden" aria-label="Choose JSON backup" onChange={importBackup} />
          {emailAccount ? <AccountSettings /> : <section className="bg-white rounded-2xl border border-outline-variant/30 p-6 mb-6">
            <h2 className="text-xl font-bold mb-2">Your workspace</h2>
            <p className="text-sm mb-4">{isLocalUser(user) ? 'Local storage on this browser. No Google account is connected, and these records are not synced to other devices. Export includes local photos and STL files.' : `Private Firebase workspace: ${user?.email || 'Google account'}. Cloud access is restricted to your user ID.`}</p>
            <button onClick={logOut} className="underline font-semibold">Switch workspace / sign out</button>
          </section>}
          {status && (
            <div className={`p-4 mb-6 rounded-xl flex items-start gap-3 ${
              status.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
              status.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
              'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>
              {status.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /> :
               status.type === 'info' ? <RefreshCw className="w-5 h-5 shrink-0 mt-0.5 animate-spin" /> :
               <Save className="w-5 h-5 shrink-0 mt-0.5" />}
              <span className="font-medium text-sm leading-relaxed">{status.message}</span>
            </div>
          )}

          {!emailAccount && <div className="bg-white p-6 rounded-2xl border border-outline-variant/30 shadow-sm mb-6">
            <h2 className="text-[20px] font-bold text-on-surface mb-2 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-primary" /> Permanent Photo Storage & Google Drive Backup
            </h2>
            <p className="text-sm text-on-surface-variant mb-4 leading-relaxed">
              Verify and repair all photo references across Prints, Boards, Wiki, Keychains, and Printing catalogs. 
              Cloud photos use Firebase Storage; Drive backup requires a connected account. Local photos stay in this browser. The existing Drive backup folder is <span className="font-semibold text-on-surface">Huntrr Planner Photo Backup</span>.
            </p>

            <button 
              onClick={handleRunPhotoMigration}
              disabled={isBackingUp || isLocalUser(user)}
              className="flex items-center justify-center gap-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 px-5 py-3 rounded-full text-sm font-bold transition-colors disabled:opacity-50"
            >
              <Database className="w-4 h-4" /> Run Storage Audit & Backup Scan
            </button>

            {migrationReport && (
              <div className="mt-4 p-4 bg-surface-variant/40 rounded-xl text-xs font-mono text-on-surface-variant space-y-1">
                <div className="font-bold text-sm text-on-surface mb-2">Scan & Repair Summary</div>
                <div>Total Scanned: {migrationReport.totalScanned}</div>
                <div>Recovered / Verified: {migrationReport.recovered}</div>
                <div>Unrecoverable (Expired Blobs): {migrationReport.unrecoverable}</div>
                {migrationReport.details.length > 0 && (
                  <div className="mt-3 max-h-36 overflow-y-auto pt-2 border-t border-outline-variant/30 space-y-1">
                    {migrationReport.details.map((line, idx) => (
                      <div key={idx} className="truncate">{line}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>}

          <div className="bg-white p-6 rounded-2xl border border-outline-variant/30 shadow-sm mb-6">
            <h2 className="text-[20px] font-bold text-on-surface mb-2 flex items-center gap-2">
              <Folder className="w-5 h-5 text-primary" /> Google Drive Connection
            </h2>
            <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
              {emailAccount ? 'Connect Drive to use the optional Google Drive and Sheets tools.' : 'Manage your connection to Google Drive for storing Prints and Boards.'}
            </p>

            <div className="space-y-4 mb-6 text-sm text-on-surface">
              <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                <span className="font-medium">Connected Google account</span>
                <span className="text-on-surface-variant">{getAccessToken() ? 'Connected' : 'Not connected'}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                <span className="font-medium">Main folder ("huntrr daily images")</span>
                <span className="flex items-center gap-2">
                  {driveFolders?.mainFolderId ? <CheckCircle className="w-4 h-4 text-on-surface-variant" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
                  {driveFolders?.mainFolderId ? 'Configured · access not verified' : 'Not configured'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                <span className="font-medium">Prints folder status</span>
                <span className="flex items-center gap-2">
                  {driveFolders?.printsFolderId ? <CheckCircle className="w-4 h-4 text-on-surface-variant" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
                  {driveFolders?.printsFolderId ? 'Configured · access not verified' : 'Not configured'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                <span className="font-medium">Boards folder status</span>
                <span className="flex items-center gap-2">
                  {driveFolders?.boardsFolderId ? <CheckCircle className="w-4 h-4 text-on-surface-variant" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
                  {driveFolders?.boardsFolderId ? 'Configured · access not verified' : 'Not configured'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                <span className="font-medium">Wiki folder status</span>
                <span className="flex items-center gap-2">
                  {(driveFolders?.wikiFolderId || printFolderMap['Wiki Characters'] || printFolderMap['Wiki']) ? (
                    <CheckCircle className="w-4 h-4 text-on-surface-variant" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                  {(driveFolders?.wikiFolderId || printFolderMap['Wiki Characters'] || printFolderMap['Wiki']) ? 'Configured · access not verified' : 'Not configured'}
                </span>
              </div>
            </div>

            {driveOAuthDiag && driveOAuthDiag.lastErrorType && (
              <div className="p-3 bg-error-container text-on-error-container rounded-xl text-xs font-mono">
                <div>Error: {driveOAuthDiag.lastErrorType}</div>
                <div>Message: {driveOAuthDiag.lastErrorMessage}</div>
                <div>Origin: {driveOAuthDiag.origin}</div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                type="button"
                onClick={handleConnectDrive}
                disabled={isConnectingDrive}
                className="flex items-center justify-center gap-2 bg-surface-variant text-on-surface px-5 py-3 rounded-full text-sm font-bold shadow-sm border border-outline-variant/30 hover:bg-surface-variant/80 transition-colors cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${isConnectingDrive ? 'animate-spin' : ''}`} /> 
                {isConnectingDrive ? 'Connecting...' : status?.type === 'error' ? 'Try Again (Connect Drive)' : 'Connect Google Drive'}
              </button>
              
              {driveFolders?.mainFolderId && (
                <a 
                  href={`https://drive.google.com/drive/folders/${driveFolders.mainFolderId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-secondary-container text-on-secondary-container px-5 py-3 rounded-full text-sm font-bold shadow-sm hover:bg-secondary-container/90 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" /> Open in Drive
                </a>
              )}

              <button 
                onClick={() => setShowDriveFoldersModal(true)}
                disabled={isBackingUp}
                className="flex items-center justify-center gap-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 px-5 py-3 rounded-full text-sm font-bold transition-colors disabled:opacity-50"
              >
                <Folder className="w-4 h-4" /> Manage Drive Folders
              </button>
              <button 
                onClick={handleRepairDriveFolders}
                disabled={isBackingUp}
                className="flex items-center justify-center gap-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 px-5 py-3 rounded-full text-sm font-bold transition-colors disabled:opacity-50"
              >
                <Folder className="w-4 h-4" /> Repair folder connections
              </button>
            </div>
          </div>

          {/* Drive Folder IDs Section */}
          <div className="bg-white p-6 rounded-2xl border border-outline-variant/30 shadow-sm mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
              <h2 className="text-[20px] font-bold text-on-surface flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-primary" /> Drive Folder IDs
              </h2>
              {savedFolderIdsConfirm && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-semibold animate-fade-in">
                  <Check className="w-3.5 h-3.5 text-green-600" /> Saved successfully
                </div>
              )}
            </div>
            <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
              Set and customize the Google Drive folder ID for each Print type. You can paste a raw folder ID or a full Google Drive URL (the ID will be extracted automatically). These folders are used directly when picking or uploading photos.
            </p>

            <div className="space-y-4 mb-6">
              {printTypesList.map((typeDef) => {
                const typeName = typeDef.name;
                const currentVal = printFolderMap[typeName] || '';
                const testInfo = testingStatus[typeName];
                const defaultVal = typeDef.defaultFolderId;
                const isCustomized = currentVal && defaultVal && currentVal !== defaultVal;

                return (
                  <div 
                    key={typeDef.id || typeName} 
                    className="p-4 rounded-xl bg-surface-variant/15 border border-outline-variant/30 hover:border-outline-variant/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-on-surface">{typeName}</span>
                        {typeName === 'Charms' && (
                          <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-md text-[11px] font-semibold">
                            Charms Folder
                          </span>
                        )}
                        {isCustomized && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-[10px] font-medium">
                            Custom ID
                          </span>
                        )}
                      </div>
                      {defaultVal && currentVal !== defaultVal && (
                        <button
                          type="button"
                          onClick={() => handlePrintFolderChange(typeName, defaultVal)}
                          className="text-[11px] text-primary hover:underline flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Reset to default
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={currentVal}
                          onChange={(e) => handlePrintFolderChange(typeName, e.target.value)}
                          placeholder={`Enter Google Drive folder ID or URL for ${typeName}`}
                          className="w-full px-3.5 py-2 text-xs sm:text-sm font-mono bg-white border border-outline-variant/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface"
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleTestPrintFolder(typeName)}
                          disabled={!currentVal || testInfo?.loading}
                          className="px-3.5 py-2 bg-surface-variant/80 hover:bg-surface-variant active:scale-95 text-on-surface text-xs font-bold rounded-lg border border-outline-variant/40 flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 min-h-[38px]"
                          title="Verify access and open in Google Drive"
                        >
                          {testInfo?.loading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                          ) : (
                            <ExternalLink className="w-3.5 h-3.5 text-primary" />
                          )}
                          <span>Test</span>
                        </button>
                      </div>
                    </div>

                    {testInfo?.error && (
                      <p className="text-xs text-error mt-2 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{testInfo.error}</span>
                      </p>
                    )}
                    {testInfo?.success && (
                      <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Folder accessible & opening in new tab.</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-outline-variant/30">
              <button
                type="button"
                onClick={handleResetToDefaults}
                className="text-xs font-semibold text-on-surface-variant hover:text-on-surface flex items-center gap-1.5 py-2 px-3 rounded-lg hover:bg-surface-variant/40 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset All to Defaults
              </button>

              <button
                type="button"
                onClick={handleSavePrintFolderIds}
                disabled={isSavingFolderIds}
                className="w-full sm:w-auto px-6 py-2.5 bg-primary text-white hover:bg-primary/90 active:scale-95 text-sm font-bold rounded-full flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                {isSavingFolderIds ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Drive Folder IDs</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {!emailAccount && <div className="bg-white p-6 rounded-2xl border border-outline-variant/30 shadow-sm mb-6">
            <h2 className="text-[20px] font-bold text-on-surface mb-2 flex items-center gap-2">
              <Save className="w-5 h-5 text-primary" /> Data Backup & Recovery
            </h2>
            <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
              Store a permanent copy of your logs, habits, and preferences directly to your Google Drive. 
              The backup will be placed in a folder named <span className="font-semibold text-on-surface">Hunter Planner Backups</span>.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={handleBackupNow}
                disabled={isBackingUp || isLocalUser(user)}
                className="flex items-center justify-center gap-2 bg-primary text-white px-5 py-3 rounded-full text-sm font-bold shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4" /> Back Up Now
              </button>
              <button 
                onClick={handleRestoreBackup}
                disabled={isBackingUp}
                className="flex items-center justify-center gap-2 bg-surface-variant text-on-surface px-5 py-3 rounded-full text-sm font-bold shadow-sm border border-outline-variant/30 hover:bg-surface-variant/80 transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" /> Restore Backup
              </button>
              <button 
                onClick={() => void handleExportEverything()}
                disabled={isBackingUp}
                className="flex items-center justify-center gap-2 bg-secondary-container text-on-secondary-container px-5 py-3 rounded-full text-sm font-bold shadow-sm hover:bg-secondary-container/90 transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> Export Everything
              </button>
              {!isLocalUser(user) && <button type="button" disabled={isBackingUp} onClick={() => void handleExportEverything(true)} className="px-5 py-3 rounded-full bg-secondary-container font-bold">
                Export migration backup with files
              </button>}
            </div>
          </div>}
          
          <div className="bg-white p-6 rounded-2xl border border-outline-variant/30 shadow-sm mb-6">
            <h2 className="text-[20px] font-bold text-on-surface mb-2 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-primary" /> Reset Individual Tabs
            </h2>
            <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
              Clear the saved data from one specific tab without affecting the rest of the application. 
              For tabs with images (like Prints), this resets the app's records but does not permanently delete your original files from Google Drive.
            </p>
            
            <div className="flex flex-wrap gap-3">
              {TAB_RESETS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setResetTab(tab.id)}
                  disabled={isBackingUp}
                  className="px-4 py-2 bg-surface-variant text-on-surface hover:bg-surface-variant/80 border border-outline-variant/30 rounded-full text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-red-50 p-6 rounded-2xl border border-red-200 shadow-sm mb-6">
            <h2 className="text-[20px] font-bold text-red-700 mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Danger Zone
            </h2>
            <p className="text-sm text-red-700/80 mb-6 leading-relaxed">
              Permanently delete all your personal data, preferences, boards, and habits from this application. This will completely reset your account.
            </p>
            <button 
              onClick={handleFactoryReset}
              disabled={isBackingUp}
              className="flex items-center justify-center gap-2 bg-red-600 text-white px-5 py-3 rounded-full text-sm font-bold shadow-sm hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              Factory Reset & Delete All Data
            </button>
          </div>
  
        </div>
      </div>
      <SetDriveFoldersModal
        isOpen={showDriveFoldersModal}
        onClose={() => setShowDriveFoldersModal(false)}
        onSaved={(folders) => {
          setDriveFolders(folders);
          setShowDriveFoldersModal(false);
        }}
      />
      {resetTab && (
        <div role="dialog" aria-modal="true" aria-label="Settings dialog" tabIndex={-1} className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-[20px] font-bold text-red-700 mb-2">Confirm Reset</h3>
            <p className="text-[14px] text-on-surface-variant mb-4">
              {TAB_RESETS.find(t => t.id === resetTab)?.confirmText}
            </p>
            <p className="text-[13px] text-on-surface-variant font-medium mb-2">
              Type <span className="font-bold text-on-surface">{TAB_RESETS.find(t => t.id === resetTab)?.keyword}</span> to confirm:
            </p>
            <input
              type="text"
              value={resetKeyword}
              onChange={(e) => setResetKeyword(e.target.value)}
              className="w-full px-4 py-2 border border-outline-variant/40 rounded-xl mb-6 text-[15px] focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              placeholder={TAB_RESETS.find(t => t.id === resetTab)?.keyword}
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setResetTab(null); setResetKeyword(''); }}
                className="px-4 py-2 text-[14px] font-bold text-[#666666] hover:bg-surface-variant rounded-full transition-colors"
                disabled={isBackingUp}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const tabDef = TAB_RESETS.find(t => t.id === resetTab);
                  if (!tabDef || resetKeyword.trim().toUpperCase() !== tabDef.keyword.toUpperCase()) return;
                  setIsBackingUp(true);
                  try {
                    if (user && !user.isAnonymous) {
                      await deleteTabData(user.uid, resetTab);
                    }
                    setStatus({ type: 'success', message: `All ${tabDef.label.replace('Reset All ', '').replace('Reset ', '')} have been reset.` });
                    setResetTab(null);
                    setResetKeyword('');
                  } catch (e: any) {
                    setStatus({ type: 'error', message: `Reset failed: ${e.message}` });
                  } finally {
                    setIsBackingUp(false);
                  }
                }}
                disabled={isBackingUp || resetKeyword.trim().toUpperCase() !== (TAB_RESETS.find(t => t.id === resetTab)?.keyword || '').toUpperCase()}
                className="px-5 py-2 text-[14px] font-bold bg-red-600 text-white hover:bg-red-700 rounded-full transition-colors disabled:opacity-50"
              >
                Delete Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
