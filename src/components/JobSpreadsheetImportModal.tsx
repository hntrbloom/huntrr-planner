import React, { useState, useRef, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  X, 
  Check, 
  AlertCircle, 
  Download, 
  Sparkles, 
  Loader2, 
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  Building2,
  RefreshCw,
  ExternalLink,
  Layers,
  HelpCircle,
  Eye,
  ShieldCheck,
  ChevronRight,
  CheckCheck
} from 'lucide-react';
import { 
  JobApplication,
  LocalCompany,
  RemoteCompany,
  JobSyncMeta,
  JobConflictItem,
  MultiSheetSyncResult,
  extractSpreadsheetId,
  fetchGoogleSpreadsheetAllSheets,
  sheetValuesToRowObjects,
  detectWorksheetType,
  mapRowToJobApplication,
  mapRowToLocalCompany,
  mapRowToRemoteCompany,
  parseMultiSheetBuffer,
  mergeSpreadsheetData,
  downloadCompleteJobTrackerExcel
} from '../lib/jobSpreadsheetSync';
import { getAccessToken } from '../lib/AuthContext';
import { requestFreshDriveToken } from '../lib/driveAuth';

interface JobSpreadsheetImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingJobs: JobApplication[];
  existingLocalCompanies: LocalCompany[];
  existingRemoteCompanies: RemoteCompany[];
  syncMeta: JobSyncMeta;
  onSyncComplete: (result: MultiSheetSyncResult) => void;
}

type SyncTab = 'google-sheets' | 'file-upload' | 'template';

export function JobSpreadsheetImportModal({
  isOpen,
  onClose,
  existingJobs,
  existingLocalCompanies,
  existingRemoteCompanies,
  syncMeta,
  onSyncComplete,
}: JobSpreadsheetImportModalProps) {
  const [activeTab, setActiveTab] = useState<SyncTab>('google-sheets');
  const [sheetUrlInput, setSheetUrlInput] = useState<string>('');
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<MultiSheetSyncResult | null>(null);

  // Staged parsed data awaiting confirmation
  const [stagedData, setStagedData] = useState<{
    jobs: Partial<JobApplication>[];
    localCompanies: LocalCompany[];
    remoteCompanies: RemoteCompany[];
    sheetNames: string[];
    spreadsheetId?: string;
    spreadsheetUrl?: string;
  } | null>(null);

  // Staged merge results & conflicts preview
  const [previewResult, setPreviewResult] = useState<MultiSheetSyncResult | null>(null);
  const [conflictOverrides, setConflictOverrides] = useState<Record<string, 'use-sheet' | 'keep-app'>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (syncMeta.spreadsheetUrl) {
      setSheetUrlInput(syncMeta.spreadsheetUrl);
    } else if (syncMeta.spreadsheetId) {
      setSheetUrlInput(`https://docs.google.com/spreadsheets/d/${syncMeta.spreadsheetId}/edit`);
    }
  }, [syncMeta]);

  if (!isOpen) return null;

  const handleFetchGoogleSheets = async () => {
    setErrorMsg(null);
    setSuccessResult(null);

    const rawInput = sheetUrlInput.trim();
    if (!rawInput) {
      setErrorMsg('Please enter your Google Sheets URL or Spreadsheet ID.');
      return;
    }

    const spreadsheetId = extractSpreadsheetId(rawInput);
    if (!spreadsheetId) {
      setErrorMsg('Could not detect a valid Google Spreadsheet ID. Please paste the full spreadsheet URL.');
      return;
    }

    setIsFetchingSheet(true);

    try {
      let token = getAccessToken();
      if (!token) {
        token = await requestFreshDriveToken(true);
      }

      if (!token) {
        setErrorMsg('Google authorization is required to access your Google Sheet. Please sign in with Google.');
        setIsFetchingSheet(false);
        return;
      }

      // Try fetching via direct Google Sheets API, with fallback to proxy route
      let sheetData: {
        jobsRows: Record<string, any>[];
        localRows: Record<string, any>[];
        remoteRows: Record<string, any>[];
        sheetNamesFound: string[];
      };

      try {
        sheetData = await fetchGoogleSpreadsheetAllSheets(spreadsheetId, token);
      } catch (directErr: any) {
        console.warn('Direct Google Sheets fetch error, attempting proxy:', directErr);
        const proxyRes = await fetch('/api/sheets/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spreadsheetId, accessToken: token })
        });

        if (!proxyRes.ok) {
          const proxyErr = await proxyRes.json().catch(() => ({}));
          throw new Error(proxyErr.error || directErr.message || 'Failed to fetch spreadsheet.');
        }

        const proxyJson = await proxyRes.json();
        const sheetsDict = proxyJson.sheets as Record<string, any[][]>;
        const names = proxyJson.sheetTitles as string[];

        let jRows: Record<string, any>[] = [];
        let lRows: Record<string, any>[] = [];
        let rRows: Record<string, any>[] = [];

        for (const title of names) {
          const rawVals = sheetsDict[title];
          if (!rawVals || rawVals.length < 2) continue;
          const headers = rawVals[0].map(h => String(h || ''));
          const rowObjs = sheetValuesToRowObjects(rawVals);
          const sType = detectWorksheetType(title, headers);
          if (sType === 'local') lRows = [...lRows, ...rowObjs];
          else if (sType === 'remote') rRows = [...rRows, ...rowObjs];
          else jRows = [...jRows, ...rowObjs];
        }

        sheetData = {
          jobsRows: jRows,
          localRows: lRows,
          remoteRows: rRows,
          sheetNamesFound: names
        };
      }

      const parsedJobs = sheetData.jobsRows.map(r => mapRowToJobApplication(r)).filter(Boolean) as Partial<JobApplication>[];
      const parsedLocal = sheetData.localRows.map(r => mapRowToLocalCompany(r)).filter(Boolean) as LocalCompany[];
      const parsedRemote = sheetData.remoteRows.map(r => mapRowToRemoteCompany(r)).filter(Boolean) as RemoteCompany[];

      if (parsedJobs.length === 0 && parsedLocal.length === 0 && parsedRemote.length === 0) {
        setErrorMsg('No populated rows were found in the connected spreadsheet. Please check that worksheets have headers and rows.');
        setIsFetchingSheet(false);
        return;
      }

      const staged = {
        jobs: parsedJobs,
        localCompanies: parsedLocal,
        remoteCompanies: parsedRemote,
        sheetNames: sheetData.sheetNamesFound,
        spreadsheetId,
        spreadsheetUrl: rawInput.startsWith('http') ? rawInput : `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      };
      setStagedData(staged);

      // Compute merge preview & conflicts
      const preview = mergeSpreadsheetData(
        existingJobs,
        existingLocalCompanies,
        existingRemoteCompanies,
        staged,
        spreadsheetId,
        staged.spreadsheetUrl
      );
      setPreviewResult(preview);

      // Initialize default conflict overrides (default: accept sheet changes)
      const initialOverrides: Record<string, 'use-sheet' | 'keep-app'> = {};
      preview.conflicts.forEach(c => {
        initialOverrides[c.id] = 'use-sheet';
      });
      setConflictOverrides(initialOverrides);

    } catch (err: any) {
      console.error('Google Sheets sync error:', err);
      setErrorMsg(err?.message || 'Could not access spreadsheet. Please make sure the sheet is accessible to your Google account.');
    } finally {
      setIsFetchingSheet(false);
    }
  };

  const handleFileUpload = async (selectedFile: File) => {
    setErrorMsg(null);
    setSuccessResult(null);
    setFile(selectedFile);
    setIsParsingFile(true);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const parsed = parseMultiSheetBuffer(buffer);

      if (parsed.jobs.length === 0 && parsed.localCompanies.length === 0 && parsed.remoteCompanies.length === 0) {
        setErrorMsg('No populated job or company records were detected in this file.');
        setStagedData(null);
        setPreviewResult(null);
      } else {
        const staged = {
          jobs: parsed.jobs,
          localCompanies: parsed.localCompanies,
          remoteCompanies: parsed.remoteCompanies,
          sheetNames: parsed.sheetNamesFound,
          spreadsheetUrl: selectedFile.name,
        };
        setStagedData(staged);

        const preview = mergeSpreadsheetData(
          existingJobs,
          existingLocalCompanies,
          existingRemoteCompanies,
          staged,
          syncMeta.spreadsheetId,
          syncMeta.spreadsheetUrl
        );
        setPreviewResult(preview);

        const initialOverrides: Record<string, 'use-sheet' | 'keep-app'> = {};
        preview.conflicts.forEach(c => {
          initialOverrides[c.id] = 'use-sheet';
        });
        setConflictOverrides(initialOverrides);
      }
    } catch (err: any) {
      console.error('Error reading file:', err);
      setErrorMsg('Failed to read spreadsheet file. Please ensure it is a valid .xlsx, .xls, or .csv file.');
      setStagedData(null);
      setPreviewResult(null);
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleApplySync = () => {
    if (!previewResult || !stagedData) return;

    // Apply any conflict choices if user opted to keep app version
    let finalJobs = [...previewResult.mergedJobs];
    if (Object.keys(conflictOverrides).length > 0) {
      previewResult.conflicts.forEach(c => {
        if (conflictOverrides[c.id] === 'keep-app' && c.type === 'job') {
          finalJobs = finalJobs.map(j => j.id === c.id ? c.appItem : j);
        }
      });
    }

    const finalResult: MultiSheetSyncResult = {
      ...previewResult,
      mergedJobs: finalJobs,
      meta: {
        ...previewResult.meta,
        spreadsheetId: stagedData.spreadsheetId || syncMeta.spreadsheetId || '',
        spreadsheetUrl: stagedData.spreadsheetUrl || syncMeta.spreadsheetUrl || '',
      }
    };

    setSuccessResult(finalResult);
    onSyncComplete(finalResult);
  };

  const resetAll = () => {
    setStagedData(null);
    setPreviewResult(null);
    setErrorMsg(null);
    setSuccessResult(null);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-surface-container-lowest w-full max-w-3xl rounded-3xl border border-outline-variant/30 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 bg-surface-container-lowest shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-[19px] font-bold text-on-surface font-headline-sm leading-tight flex items-center gap-2">
                <span>Sync with Google Sheets</span>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Live Sync
                </span>
              </h3>
              <p className="text-[12px] text-on-surface-variant font-medium">
                {syncMeta.lastSyncFormatted ? `Last synced: ${syncMeta.lastSyncFormatted}` : 'Import and sync jobs, local tech companies, and remote research'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:bg-surface-variant/40 rounded-full transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        {!successResult && (
          <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-outline-variant/15 bg-surface-container-low/30 shrink-0">
            <button
              onClick={() => { setActiveTab('google-sheets'); resetAll(); }}
              className={`px-4 py-2 rounded-full text-[13px] font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'google-sheets'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-on-surface-variant hover:bg-surface-variant/40'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Google Sheets Sync</span>
            </button>
            <button
              onClick={() => { setActiveTab('file-upload'); resetAll(); }}
              className={`px-4 py-2 rounded-full text-[13px] font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'file-upload'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-on-surface-variant hover:bg-surface-variant/40'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Upload Excel / CSV</span>
            </button>
            <button
              onClick={() => setActiveTab('template')}
              className={`px-4 py-2 rounded-full text-[13px] font-bold transition-all cursor-pointer flex items-center gap-2 ml-auto ${
                activeTab === 'template'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-on-surface-variant hover:bg-surface-variant/40'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Download Template</span>
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Success State */}
          {successResult ? (
            <div className="text-center py-6 space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
                <CheckCheck className="w-9 h-9" />
              </div>
              <div>
                <h4 className="text-[22px] font-bold text-on-surface font-headline-sm">
                  Spreadsheet Successfully Synchronized!
                </h4>
                <p className="text-[14px] text-on-surface-variant mt-1 max-w-md mx-auto">
                  All worksheets have been merged into your Huntrr Jobs tracker without losing local edits.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto pt-2">
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl text-center">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 block">Applications</span>
                  <span className="text-[22px] font-black text-blue-950 block">{successResult.mergedJobs.length}</span>
                  <span className="text-[11px] text-blue-700 font-semibold">
                    +{successResult.addedJobsCount} new, {successResult.updatedJobsCount} updated
                  </span>
                </div>
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-center">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">Local Companies</span>
                  <span className="text-[22px] font-black text-emerald-950 block">{successResult.mergedLocalCompanies.length}</span>
                  <span className="text-[11px] text-emerald-700 font-semibold">
                    +{successResult.addedLocalCount} new, {successResult.updatedLocalCount} updated
                  </span>
                </div>
                <div className="p-3.5 bg-pink-50/70 border border-pink-200 rounded-2xl text-center">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-pink-800 block">Remote Tech</span>
                  <span className="text-[22px] font-black text-pink-950 block">{successResult.mergedRemoteCompanies.length}</span>
                  <span className="text-[11px] text-pink-700 font-semibold">
                    +{successResult.addedRemoteCount} new, {successResult.updatedRemoteCount} updated
                  </span>
                </div>
              </div>

              <div className="pt-4 flex justify-center gap-3">
                <button
                  onClick={resetAll}
                  className="px-5 py-2.5 rounded-full border border-outline-variant/30 text-on-surface-variant font-semibold text-[13px] hover:bg-surface-variant/40 transition-colors cursor-pointer"
                >
                  Sync Another Sheet
                </button>
                <button
                  onClick={onClose}
                  className="px-7 py-2.5 rounded-full bg-primary text-white font-bold text-[14px] shadow-md hover:bg-primary/90 transition-all cursor-pointer"
                >
                  View Job Tracker
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Tab 1: Google Sheets Live Sync */}
              {activeTab === 'google-sheets' && !previewResult && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200/60 flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <div className="text-[13px] text-emerald-950">
                      <p className="font-bold mb-0.5">Authorized Google Sheets Read Access</p>
                      <p className="text-emerald-800 leading-relaxed text-[12px]">
                        Huntrr Space connects directly to your private Google Sheet using your authorized Google account. Your original spreadsheet will not be modified.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[13px] font-bold text-on-surface mb-1.5">
                      Google Spreadsheet URL or ID
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="https://docs.google.com/spreadsheets/d/your-sheet-id/edit"
                        value={sheetUrlInput}
                        onChange={(e) => setSheetUrlInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleFetchGoogleSheets(); }}
                        className="flex-1 px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[14px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                      />
                      <button
                        type="button"
                        disabled={isFetchingSheet || !sheetUrlInput.trim()}
                        onClick={handleFetchGoogleSheets}
                        className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-[13px] hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer shrink-0 shadow-xs"
                      >
                        {isFetchingSheet ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Connecting...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4" />
                            <span>Preview & Sync</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-on-surface-variant mt-1.5">
                      Paste the link from your browser address bar. We will import: <strong>Jobs I Want to Apply For</strong>, <strong>Local Tech Companies</strong>, and <strong>Remote Companies</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 2: File Upload (Excel / CSV) */}
              {activeTab === 'file-upload' && !previewResult && (
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileUpload(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-outline-variant/40 hover:border-primary/60 rounded-3xl p-8 sm:p-10 text-center cursor-pointer transition-all bg-surface-container-low/40 hover:bg-primary/5 flex flex-col items-center justify-center group"
                >
                  <input 
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="w-16 h-16 rounded-2xl bg-white text-primary flex items-center justify-center shadow-md mb-3 group-hover:scale-105 transition-transform border border-outline-variant/20">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                  <h4 className="text-[17px] font-bold text-on-surface font-headline-sm mb-1">
                    Click to browse or drag & drop your spreadsheet file
                  </h4>
                  <p className="text-[13px] text-on-surface-variant max-w-md mx-auto mb-3">
                    Supports <strong>.xlsx</strong> with all three worksheets, or individual <strong>.csv</strong> files.
                  </p>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
                    <span>Multi-Sheet .xlsx • Local Tech Companies • Remote Companies</span>
                  </div>
                </div>
              )}

              {/* Tab 3: Download Template */}
              {activeTab === 'template' && (
                <div className="p-6 bg-surface-container-low rounded-2xl border border-outline-variant/20 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                      <Download className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-[16px] font-bold text-on-surface">Download Complete Job Tracker Template</h4>
                      <p className="text-[13px] text-on-surface-variant">
                        Includes all three pre-formatted sheets: Jobs, Local Tech Companies, and Remote Companies.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="p-3 bg-white rounded-xl border border-outline-variant/15 text-[12px]">
                      <span className="font-bold text-on-surface block mb-1">1. Jobs I Want to Apply For</span>
                      <p className="text-on-surface-variant text-[11px]">Columns for status, dates, cover letter links, and expiration.</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-outline-variant/15 text-[12px]">
                      <span className="font-bold text-on-surface block mb-1">2. Local Tech Companies</span>
                      <p className="text-on-surface-variant text-[11px]">Pre-populated with 25 Central Iowa companies to monitor.</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-outline-variant/15 text-[12px]">
                      <span className="font-bold text-on-surface block mb-1">3. Remote Companies</span>
                      <p className="text-on-surface-variant text-[11px]">Formatted for watching remote developer roles & match reasons.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={downloadCompleteJobTrackerExcel}
                    className="px-5 py-2.5 rounded-full bg-primary text-on-primary font-bold text-[13px] shadow-sm hover:bg-primary/90 flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Excel Template (.xlsx)</span>
                  </button>
                </div>
              )}

              {/* Staged Preview Section (Shows before user confirms sync) */}
              {previewResult && stagedData && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/20 flex flex-wrap justify-between items-center gap-3">
                    <div>
                      <span className="text-[14px] font-bold text-on-surface block">
                        Spreadsheet Preview Ready
                      </span>
                      <span className="text-[12px] text-on-surface-variant">
                        Detected worksheets: {stagedData.sheetNames.join(', ') || '3 Worksheets'}
                      </span>
                    </div>
                    <button
                      onClick={resetAll}
                      className="text-[12px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      Change Sheet / File
                    </button>
                  </div>

                  {/* Summary Counters */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 block">Job Listings</span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-[20px] font-black text-blue-950">{stagedData.jobs.length}</span>
                        <span className="text-[11px] text-blue-700 font-semibold">
                          ({previewResult.addedJobsCount} new, {previewResult.updatedJobsCount} update)
                        </span>
                      </div>
                    </div>
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">Local Tech</span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-[20px] font-black text-emerald-950">{stagedData.localCompanies.length}</span>
                        <span className="text-[11px] text-emerald-700 font-semibold">
                          ({previewResult.addedLocalCount} new)
                        </span>
                      </div>
                    </div>
                    <div className="p-3 bg-pink-50/70 border border-pink-200/80 rounded-2xl">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-pink-800 block">Remote Tech</span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-[20px] font-black text-pink-950">{stagedData.remoteCompanies.length}</span>
                        <span className="text-[11px] text-pink-700 font-semibold">
                          ({previewResult.addedRemoteCount} new)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Conflict Preview Box */}
                  {previewResult.conflicts.length > 0 && (
                    <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-3">
                      <div className="flex items-center gap-2 text-amber-900 font-bold text-[13px]">
                        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>{previewResult.conflicts.length} Conflicting Records Detected</span>
                      </div>
                      <p className="text-[12px] text-amber-800 leading-relaxed">
                        These jobs already exist in Huntrr Space with different values. Choose whether to accept the spreadsheet update or keep your local notes:
                      </p>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {previewResult.conflicts.map(conflict => (
                          <div key={conflict.id} className="p-3 bg-white/90 rounded-xl border border-amber-200/70 text-[12px] space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-on-surface">{conflict.identifier}</span>
                              <div className="flex items-center gap-2">
                                <label className="inline-flex items-center gap-1 cursor-pointer">
                                  <input 
                                    type="radio"
                                    name={`conflict-${conflict.id}`}
                                    checked={conflictOverrides[conflict.id] === 'use-sheet'}
                                    onChange={() => setConflictOverrides(prev => ({ ...prev, [conflict.id]: 'use-sheet' }))}
                                    className="accent-primary"
                                  />
                                  <span className="text-[11px] font-medium text-emerald-800">Use Sheet</span>
                                </label>
                                <label className="inline-flex items-center gap-1 cursor-pointer">
                                  <input 
                                    type="radio"
                                    name={`conflict-${conflict.id}`}
                                    checked={conflictOverrides[conflict.id] === 'keep-app'}
                                    onChange={() => setConflictOverrides(prev => ({ ...prev, [conflict.id]: 'keep-app' }))}
                                    className="accent-primary"
                                  />
                                  <span className="text-[11px] font-medium text-amber-900">Keep App Edits</span>
                                </label>
                              </div>
                            </div>
                            <div className="divide-y divide-outline-variant/10 text-[11px]">
                              {conflict.differences.map((diff, dIdx) => (
                                <div key={dIdx} className="py-1 flex justify-between items-start gap-2">
                                  <span className="font-semibold text-on-surface-variant w-28 shrink-0">{diff.label}:</span>
                                  <div className="flex-1 text-right">
                                    <span className="text-red-700 line-through mr-2">App: {diff.appValue || '(empty)'}</span>
                                    <span className="text-emerald-700 font-bold">Sheet: {diff.sheetValue || '(empty)'}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sample rows preview */}
                  <div className="border border-outline-variant/20 rounded-2xl overflow-hidden shadow-xs">
                    <div className="bg-surface-container-low px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-outline-variant/20 flex justify-between items-center">
                      <span>Preview of Jobs to Merge</span>
                      <span>Showing first {Math.min(3, stagedData.jobs.length)}</span>
                    </div>
                    <div className="divide-y divide-outline-variant/15 max-h-40 overflow-y-auto bg-surface-container-lowest">
                      {stagedData.jobs.slice(0, 3).map((job, idx) => (
                        <div key={idx} className="p-3 text-[13px] flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-on-surface truncate">{job.position || 'Untitled'}</p>
                            <p className="text-[12px] text-primary truncate font-medium">{job.company}</p>
                            {job.location && <p className="text-[11px] text-on-surface-variant truncate">{job.location}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              job.status === 'Applied' ? 'bg-blue-100 text-blue-900 border border-blue-200' : 'bg-pink-100 text-pink-900 border border-pink-200'
                            }`}>
                              {job.status}
                            </span>
                            {job.jobClosesExpires && (
                              <span className="block text-[10px] text-amber-800 font-semibold mt-0.5">
                                Closes: {job.jobClosesExpires}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="p-3.5 bg-red-100 text-red-900 rounded-xl text-[13px] font-medium flex items-center gap-2 border border-red-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!successResult && (
          <div className="px-6 py-4 border-t border-outline-variant/20 bg-surface-container-lowest flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={downloadCompleteJobTrackerExcel}
              className="px-3.5 py-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40 text-[12px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-primary" /> Template (.xlsx)
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-full font-bold text-[14px] text-on-surface-variant hover:bg-surface-variant/40 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              {previewResult && (
                <button
                  type="button"
                  onClick={handleApplySync}
                  className="px-7 py-2.5 rounded-full bg-primary hover:bg-primary/90 text-white font-bold text-[14px] shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>Confirm & Sync into App</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
