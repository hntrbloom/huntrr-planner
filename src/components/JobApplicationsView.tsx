import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Briefcase, 
  Plus, 
  Trash2, 
  Edit2, 
  ExternalLink, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertCircle, 
  Sparkles, 
  Loader2, 
  MapPin, 
  Building2, 
  DollarSign, 
  Link as LinkIcon, 
  Check,
  Archive,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  FolderArchive,
  SlidersHorizontal,
  FileSpreadsheet,
  Target,
  TrendingUp,
  Star,
  Award,
  CalendarCheck,
  Tag,
  ArrowRight,
  Search,
  Filter,
  ArrowUpDown,
  FileText,
  Globe,
  Compass,
  AlertTriangle,
  RefreshCw,
  Send,
  CalendarDays
} from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot } from '../lib/workspaceStore';
import { useProfile } from '../lib/ProfileContext';
import { SyncStatus } from './SyncStatus';
import { 
  format, 
  parseISO, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  isWithinInterval, 
  differenceInCalendarDays,
  getDay 
} from 'date-fns';
import { JobImportSection } from './JobImportSection';
import { GUEST_SAMPLE_JOB_APPLICATIONS } from '../lib/guestSampleData';
import { normalizeJobUrl, cleanRawUrl, findDuplicateJob } from '../lib/jobUrlUtils';
import { 
  JobAutocompleteHistory, 
  AutocompleteFieldType, 
  createInitialHistory, 
  importValuesFromApplications, 
  recordSavedJobValues 
} from '../lib/jobAutocomplete';
import { JobAutocompleteCombobox } from './JobAutocompleteCombobox';
import { ManageSavedAnswersModal } from './ManageSavedAnswersModal';
import { JobSpreadsheetImportModal } from './JobSpreadsheetImportModal';
import { 
  JobApplication,
  LocalCompany,
  RemoteCompany,
  JobSyncMeta,
  MultiSheetSyncResult,
  INITIAL_LOCAL_COMPANIES,
  INITIAL_REMOTE_COMPANIES,
  downloadCompleteJobTrackerExcel
} from '../lib/jobSpreadsheetSync';

export type { JobApplication };

type ActiveSection = 'applications' | 'local' | 'remote';

const emptyJobForm: Partial<JobApplication> = {
  company: '',
  position: '',
  status: 'NOT COMPLETED',
  dateApplied: '',
  link: '',
  notes: '',
  location: '',
  workplaceType: '',
  employmentType: '',
  salaryMin: '',
  salaryMax: '',
  salaryPeriod: '',
  pay: '',
  priority: 'Medium',
  coverLetterReady: 'Needed',
  coverLetterLink: '',
  applicationStatusLink: '',
  jobClosesExpires: '',
  whyIMatch: '',
  importantRequirements: '',
  datePosted: '',
  applicationDeadline: '',
  shortSummary: '',
  responsibilities: [],
  requiredQualifications: [],
  preferredQualifications: [],
  source: '',
  originalUrl: '',
  jobId: '',
  isPast: false
};

const emptyLocalForm: Partial<LocalCompany> = {
  companyName: '',
  careerPageTitle: '',
  careerPageUrl: '',
  localArea: '',
  whatToSearchFor: '',
  goodEntryLevelJobs: '',
  researchNotes: '',
};

const emptyRemoteForm: Partial<RemoteCompany> = {
  companyName: '',
  careerPageUrl: '',
  jobTypesToWatch: '',
  priority: 'High',
  reasonsTheyFit: '',
  notes: '',
};

export function JobApplicationsView() {
  const { user } = useProfile();
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'offline'>('idle');

  // Three Core Sections
  const [activeSection, setActiveSection] = useState<ActiveSection>('applications');

  // Data Collections
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [localCompanies, setLocalCompanies] = useState<LocalCompany[]>([]);
  const [remoteCompanies, setRemoteCompanies] = useState<RemoteCompany[]>([]);
  const [syncMeta, setSyncMeta] = useState<JobSyncMeta>({});

  // Section Modals & Editing
  const [isAddingJob, setIsAddingJob] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [jobFormData, setJobFormData] = useState<Partial<JobApplication>>(emptyJobForm);

  const [isAddingLocal, setIsAddingLocal] = useState(false);
  const [editingLocalId, setEditingLocalId] = useState<string | null>(null);
  const [localFormData, setLocalFormData] = useState<Partial<LocalCompany>>(emptyLocalForm);

  const [isAddingRemote, setIsAddingRemote] = useState(false);
  const [editingRemoteId, setEditingRemoteId] = useState<string | null>(null);
  const [remoteFormData, setRemoteFormData] = useState<Partial<RemoteCompany>>(emptyRemoteForm);

  // Sync Modal
  const [syncModalOpen, setSyncModalOpen] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'expiration' | 'company'>('date');
  const [localAreaFilter, setLocalAreaFilter] = useState<string>('all');
  const [remotePriorityFilter, setRemotePriorityFilter] = useState<string>('all');

  const [isPastCollapsed, setIsPastCollapsed] = useState(true);
  const [duplicateWarning, setDuplicateWarning] = useState<JobApplication | null>(null);

  // Autocomplete history state & manage modal
  const [autocompleteHistory, setAutocompleteHistory] = useState<JobAutocompleteHistory>(createInitialHistory());
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [manageModalInitialField, setManageModalInitialField] = useState<AutocompleteFieldType>('location');

  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAddingJob) { setIsAddingJob(false); resetJobForm(); }
        if (isAddingLocal) { setIsAddingLocal(false); resetLocalForm(); }
        if (isAddingRemote) { setIsAddingRemote(false); resetRemoteForm(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddingJob, isAddingLocal, isAddingRemote]);

  // Load Data (Firebase Firestore or LocalStorage for Guest)
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (user.isAnonymous) {
      // 1. Applications
      const savedGuest = localStorage.getItem('guest_job_applications');
      if (savedGuest) {
        try {
          const parsed = JSON.parse(savedGuest);
          if (Array.isArray(parsed)) setApplications(parsed);
        } catch (_) {}
      } else {
        setApplications(GUEST_SAMPLE_JOB_APPLICATIONS.map(j => ({
          id: j.id,
          company: j.companyName,
          position: j.roleTitle,
          status: ((j.status as string) === 'Interviewing' ? 'Interview' : j.status) as JobApplication['status'],
          dateApplied: j.appliedDate,
          link: j.jobUrl,
          notes: j.notes,
          location: j.location,
          salaryMin: '75000',
          salaryMax: '90000',
          salaryPeriod: 'Yearly',
          coverLetterReady: 'Ready',
          coverLetterLink: '',
          applicationStatusLink: '',
          jobClosesExpires: ''
        })));
      }

      // 2. Local Tech Companies
      const savedLocal = localStorage.getItem('guest_local_companies');
      if (savedLocal) {
        try {
          const parsed = JSON.parse(savedLocal);
          if (Array.isArray(parsed)) setLocalCompanies(parsed);
        } catch (_) {}
      } else {
        setLocalCompanies(INITIAL_LOCAL_COMPANIES);
      }

      // 3. Remote Companies
      const savedRemote = localStorage.getItem('guest_remote_companies');
      if (savedRemote) {
        try {
          const parsed = JSON.parse(savedRemote);
          if (Array.isArray(parsed)) setRemoteCompanies(parsed);
        } catch (_) {}
      } else {
        setRemoteCompanies(INITIAL_REMOTE_COMPANIES);
      }

      // 4. Sync Meta
      const savedMeta = localStorage.getItem('job_sync_meta');
      if (savedMeta) {
        try { setSyncMeta(JSON.parse(savedMeta)); } catch (_) {}
      }

      setLoading(false);
      return;
    }

    // Authenticated user: Listen to Firestore
    const unsub = onSnapshot(doc(db, `users/${user.uid}/preferences`, 'jobApplicationsData'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (Array.isArray(data.applications)) setApplications(data.applications);
        
        // Populate local companies if present, or initialize with pre-seeded Central Iowa research
        if (Array.isArray(data.localCompanies) && data.localCompanies.length > 0) {
          setLocalCompanies(data.localCompanies);
        } else {
          setLocalCompanies(INITIAL_LOCAL_COMPANIES);
        }

        // Populate remote companies if present, or initialize with pre-seeded research
        if (Array.isArray(data.remoteCompanies) && data.remoteCompanies.length > 0) {
          setRemoteCompanies(data.remoteCompanies);
        } else {
          setRemoteCompanies(INITIAL_REMOTE_COMPANIES);
        }

        if (data.syncMeta) {
          setSyncMeta(data.syncMeta);
        }
      } else {
        // Initial setup for new user
        setLocalCompanies(INITIAL_LOCAL_COMPANIES);
        setRemoteCompanies(INITIAL_REMOTE_COMPANIES);
      }
      setLoading(false);
    }, (err) => {
      console.error("Job applications fetch error:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  // Persist autocomplete history
  const saveAutocompleteHistory = async (newHistory: JobAutocompleteHistory) => {
    setAutocompleteHistory(newHistory);
    if (!user) return;
    if (user.isAnonymous) {
      try {
        localStorage.setItem('job_autocomplete_history', JSON.stringify(newHistory));
      } catch (_) {}
      return;
    }
    try {
      const docRef = doc(db, `users/${user.uid}/preferences`, 'jobAutocompleteHistory');
      await setDoc(docRef, newHistory, { merge: true });
    } catch (e) {
      console.error('Error saving autocomplete history:', e);
    }
  };

  // Synchronize All 3 Collections
  const persistJobTrackerData = async (
    newApps = applications, 
    newLocal = localCompanies, 
    newRemote = remoteCompanies, 
    newMeta = syncMeta
  ) => {
    if (!user) return;

    if (user.isAnonymous) {
      setApplications(newApps);
      setLocalCompanies(newLocal);
      setRemoteCompanies(newRemote);
      setSyncMeta(newMeta);
      try {
        localStorage.setItem('guest_job_applications', JSON.stringify(newApps));
        localStorage.setItem('guest_local_companies', JSON.stringify(newLocal));
        localStorage.setItem('guest_remote_companies', JSON.stringify(newRemote));
        localStorage.setItem('job_sync_meta', JSON.stringify(newMeta));
      } catch (_) {}
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 1500);
      return;
    }

    setSyncStatus('saving');
    try {
      const docRef = doc(db, `users/${user.uid}/preferences`, 'jobApplicationsData');
      await setDoc(docRef, { 
        applications: newApps,
        localCompanies: newLocal,
        remoteCompanies: newRemote,
        syncMeta: newMeta
      }, { merge: true });
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (e) {
      console.error('Error saving job applications data:', e);
      setSyncStatus('error');
    }
  };

  // Called when spreadsheet sync completes
  const handleSyncComplete = (result: MultiSheetSyncResult) => {
    setApplications(result.mergedJobs);
    setLocalCompanies(result.mergedLocalCompanies);
    setRemoteCompanies(result.mergedRemoteCompanies);
    setSyncMeta(result.meta);
    persistJobTrackerData(
      result.mergedJobs,
      result.mergedLocalCompanies,
      result.mergedRemoteCompanies,
      result.meta
    );
  };

  // Job Form Handlers
  const resetJobForm = () => {
    setJobFormData(emptyJobForm);
    setEditingJobId(null);
    setDuplicateWarning(null);
    setValidationError(null);
  };

  const startEditJob = (job: JobApplication) => {
    setJobFormData({ ...emptyJobForm, ...job });
    setEditingJobId(job.id);
    setIsAddingJob(true);
    setDuplicateWarning(null);
    setValidationError(null);
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const comp = (jobFormData.company || '').trim();
    const pos = (jobFormData.position || '').trim();

    if (!comp || !pos) {
      setValidationError('Please enter at least a Company name and Position/Role title.');
      return;
    }

    const duplicate = findDuplicateJob(jobFormData, applications, editingJobId);
    if (duplicate && !editingJobId) {
      setDuplicateWarning(duplicate);
      return;
    }

    performSaveJob();
  };

  const performSaveJob = async () => {
    setIsSaving(true);
    const comp = (jobFormData.company || '').trim();
    const pos = (jobFormData.position || '').trim();

    const savePayload: JobApplication = {
      id: editingJobId || Date.now().toString(),
      company: comp,
      position: pos,
      status: jobFormData.status || 'NOT COMPLETED',
      // Preserve date accurately without forcing today
      dateApplied: jobFormData.dateApplied || '',
      link: cleanRawUrl(jobFormData.link || ''),
      originalUrl: cleanRawUrl(jobFormData.originalUrl || jobFormData.link || ''),
      location: (jobFormData.location || '').trim(),
      workplaceType: (jobFormData.workplaceType || '').trim(),
      employmentType: (jobFormData.employmentType || '').trim(),
      pay: (jobFormData.pay || '').trim(),
      priority: jobFormData.priority || 'Medium',
      coverLetterReady: (jobFormData.coverLetterReady || '').trim(),
      coverLetterLink: cleanRawUrl(jobFormData.coverLetterLink || ''),
      applicationStatusLink: cleanRawUrl(jobFormData.applicationStatusLink || ''),
      jobClosesExpires: (jobFormData.jobClosesExpires || '').trim(),
      applicationDeadline: (jobFormData.jobClosesExpires || '').trim(),
      notes: (jobFormData.notes || '').trim(),
      whyIMatch: (jobFormData.whyIMatch || '').trim(),
      importantRequirements: (jobFormData.importantRequirements || '').trim(),
      isPast: jobFormData.isPast || false,
      createdAt: jobFormData.createdAt || Date.now(),
      lastModifiedLocally: Date.now(),
    };

    let updatedList: JobApplication[];
    if (editingJobId) {
      updatedList = applications.map(app => app.id === editingJobId ? savePayload : app);
    } else {
      updatedList = [savePayload, ...applications];
    }

    setApplications(updatedList);
    await persistJobTrackerData(updatedList, localCompanies, remoteCompanies, syncMeta);

    // Save autocomplete entries
    if (jobFormData.location?.trim() || jobFormData.workplaceType?.trim() || jobFormData.employmentType?.trim()) {
      const nextHistory = recordSavedJobValues(autocompleteHistory, {
        location: jobFormData.location,
        workplaceType: jobFormData.workplaceType,
        employmentType: jobFormData.employmentType
      });
      await saveAutocompleteHistory(nextHistory);
    }

    setIsAddingJob(false);
    resetJobForm();
    setIsSaving(false);
  };

  const deleteJob = (id: string) => {
    if (!window.confirm('Are you sure you want to delete this job application?')) return;
    const updated = applications.filter(a => a.id !== id);
    setApplications(updated);
    persistJobTrackerData(updated, localCompanies, remoteCompanies, syncMeta);
  };

  const toggleJobPast = (id: string, isPast: boolean) => {
    const updated = applications.map(a => a.id === id ? { ...a, isPast } : a);
    setApplications(updated);
    persistJobTrackerData(updated, localCompanies, remoteCompanies, syncMeta);
  };

  // Local Company Handlers
  const resetLocalForm = () => {
    setLocalFormData(emptyLocalForm);
    setEditingLocalId(null);
  };

  const handleSaveLocal = async (e: React.FormEvent) => {
    e.preventDefault();
    const comp = (localFormData.companyName || '').trim();
    if (!comp) return;

    const payload: LocalCompany = {
      id: editingLocalId || Date.now().toString(),
      companyName: comp,
      careerPageTitle: (localFormData.careerPageTitle || '').trim() || `${comp} Careers`,
      careerPageUrl: cleanRawUrl(localFormData.careerPageUrl || ''),
      localArea: (localFormData.localArea || '').trim() || 'Central Iowa',
      whatToSearchFor: (localFormData.whatToSearchFor || '').trim(),
      goodEntryLevelJobs: (localFormData.goodEntryLevelJobs || '').trim(),
      researchNotes: (localFormData.researchNotes || '').trim(),
      createdAt: Date.now(),
    };

    let updated: LocalCompany[];
    if (editingLocalId) {
      updated = localCompanies.map(c => c.id === editingLocalId ? payload : c);
    } else {
      updated = [payload, ...localCompanies];
    }

    setLocalCompanies(updated);
    await persistJobTrackerData(applications, updated, remoteCompanies, syncMeta);
    setIsAddingLocal(false);
    resetLocalForm();
  };

  const deleteLocalCompany = (id: string) => {
    if (!window.confirm('Delete this local company entry?')) return;
    const updated = localCompanies.filter(c => c.id !== id);
    setLocalCompanies(updated);
    persistJobTrackerData(applications, updated, remoteCompanies, syncMeta);
  };

  // Remote Company Handlers
  const resetRemoteForm = () => {
    setRemoteFormData(emptyRemoteForm);
    setEditingRemoteId(null);
  };

  const handleSaveRemote = async (e: React.FormEvent) => {
    e.preventDefault();
    const comp = (remoteFormData.companyName || '').trim();
    if (!comp) return;

    const payload: RemoteCompany = {
      id: editingRemoteId || Date.now().toString(),
      companyName: comp,
      careerPageUrl: cleanRawUrl(remoteFormData.careerPageUrl || ''),
      jobTypesToWatch: (remoteFormData.jobTypesToWatch || '').trim(),
      priority: (remoteFormData.priority as any) || 'Medium',
      reasonsTheyFit: (remoteFormData.reasonsTheyFit || '').trim(),
      notes: (remoteFormData.notes || '').trim(),
      createdAt: Date.now(),
    };

    let updated: RemoteCompany[];
    if (editingRemoteId) {
      updated = remoteCompanies.map(c => c.id === editingRemoteId ? payload : c);
    } else {
      updated = [payload, ...remoteCompanies];
    }

    setRemoteCompanies(updated);
    await persistJobTrackerData(applications, localCompanies, updated, syncMeta);
    setIsAddingRemote(false);
    resetRemoteForm();
  };

  const deleteRemoteCompany = (id: string) => {
    if (!window.confirm('Delete this remote company entry?')) return;
    const updated = remoteCompanies.filter(c => c.id !== id);
    setRemoteCompanies(updated);
    persistJobTrackerData(applications, localCompanies, updated, syncMeta);
  };

  // Statistics Computations
  const stats = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    let thisWeekCount = 0;
    let thisMonthCount = 0;
    let mondayAppliedTotal = 0;
    let completedThisMonday = 0;
    let closingSoonJobs: JobApplication[] = [];

    // Identify current Monday date string (YYYY-MM-DD)
    const thisMondayStr = format(weekStart, 'yyyy-MM-dd');

    applications.forEach(app => {
      // Check expiration
      if (app.jobClosesExpires && app.status !== 'Applied' && !app.isPast) {
        try {
          const expDate = parseISO(app.jobClosesExpires);
          if (!isNaN(expDate.getTime())) {
            const daysLeft = differenceInCalendarDays(expDate, now);
            if (daysLeft >= 0 && daysLeft <= 7) {
              closingSoonJobs.push(app);
            }
          }
        } catch (_) {}
      }

      // Check applied dates
      if (app.dateApplied) {
        try {
          const d = parseISO(app.dateApplied);
          if (!isNaN(d.getTime())) {
            if (isWithinInterval(d, { start: weekStart, end: weekEnd })) {
              thisWeekCount++;
            }
            if (isWithinInterval(d, { start: monthStart, end: monthEnd })) {
              thisMonthCount++;
            }
            // Check if applied on a Monday (getDay 1 is Monday)
            if (getDay(d) === 1) {
              mondayAppliedTotal++;
              if (app.dateApplied === thisMondayStr) {
                completedThisMonday++;
              }
            }
          }
        } catch (_) {}
      }
    });

    return {
      thisWeekCount,
      thisMonthCount,
      mondayAppliedTotal,
      completedThisMonday,
      closingSoonJobs
    };
  }, [applications]);

  // Filtered & Sorted Applications
  const filteredApplications = useMemo(() => {
    return applications.filter(app => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesComp = app.company.toLowerCase().includes(q);
        const matchesPos = app.position.toLowerCase().includes(q);
        const matchesLoc = (app.location || '').toLowerCase().includes(q);
        const matchesNotes = (app.notes || '').toLowerCase().includes(q);
        if (!matchesComp && !matchesPos && !matchesLoc && !matchesNotes) return false;
      }

      // Status
      if (statusFilter === 'Applied') return app.status === 'Applied';
      if (statusFilter === 'NOT COMPLETED') return app.status === 'NOT COMPLETED';
      if (statusFilter === 'Interview') return app.status === 'Interview';
      if (statusFilter === 'Offer') return app.status === 'Offer';
      if (statusFilter === 'Rejected') return app.status === 'Rejected';
      if (statusFilter === 'closing-soon') {
        if (!app.jobClosesExpires) return false;
        try {
          const d = parseISO(app.jobClosesExpires);
          const days = differenceInCalendarDays(d, new Date());
          return days >= 0 && days <= 7;
        } catch (_) { return false; }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'priority') {
        const pWeight: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
        return (pWeight[b.priority || 'Medium'] || 0) - (pWeight[a.priority || 'Medium'] || 0);
      }
      if (sortBy === 'expiration') {
        if (!a.jobClosesExpires) return 1;
        if (!b.jobClosesExpires) return -1;
        return a.jobClosesExpires.localeCompare(b.jobClosesExpires);
      }
      if (sortBy === 'company') {
        return a.company.localeCompare(b.company);
      }
      // Default: date applied (or creation date) descending
      if (a.dateApplied && b.dateApplied) return b.dateApplied.localeCompare(a.dateApplied);
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [applications, searchQuery, statusFilter, sortBy]);

  const activeJobs = filteredApplications.filter(a => !a.isPast);
  const pastJobs = filteredApplications.filter(a => !!a.isPast);

  // Filtered Local Companies
  const filteredLocalCompanies = useMemo(() => {
    return localCompanies.filter(c => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mComp = c.companyName.toLowerCase().includes(q);
        const mArea = c.localArea.toLowerCase().includes(q);
        const mTerms = (c.whatToSearchFor || '').toLowerCase().includes(q);
        const mEntry = (c.goodEntryLevelJobs || '').toLowerCase().includes(q);
        if (!mComp && !mArea && !mTerms && !mEntry) return false;
      }
      if (localAreaFilter !== 'all') {
        if (!c.localArea.toLowerCase().includes(localAreaFilter.toLowerCase())) return false;
      }
      return true;
    });
  }, [localCompanies, searchQuery, localAreaFilter]);

  // Unique Local Areas for Filter Dropdown
  const availableLocalAreas = useMemo(() => {
    const set = new Set<string>();
    localCompanies.forEach(c => {
      c.localArea.split(',').forEach(part => {
        const trimmed = part.trim();
        if (trimmed) set.add(trimmed);
      });
    });
    return Array.from(set).sort();
  }, [localCompanies]);

  // Filtered Remote Companies
  const filteredRemoteCompanies = useMemo(() => {
    return remoteCompanies.filter(r => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mComp = r.companyName.toLowerCase().includes(q);
        const mTypes = (r.jobTypesToWatch || '').toLowerCase().includes(q);
        const mReasons = (r.reasonsTheyFit || '').toLowerCase().includes(q);
        if (!mComp && !mTypes && !mReasons) return false;
      }
      if (remotePriorityFilter !== 'all') {
        if (r.priority !== remotePriorityFilter) return false;
      }
      return true;
    });
  }, [remoteCompanies, searchQuery, remotePriorityFilter]);

  // Helper: Format Expiration Badge
  const getExpirationBadge = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const expDate = parseISO(dateStr);
      if (isNaN(expDate.getTime())) return null;
      const diff = differenceInCalendarDays(expDate, new Date());
      if (diff < 0) {
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-300">
            Expired {format(expDate, 'MMM d')}
          </span>
        );
      }
      if (diff === 0) {
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-900 border border-red-300 animate-pulse">
            Closes Today!
          </span>
        );
      }
      if (diff <= 3) {
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
            Closes in {diff} {diff === 1 ? 'day' : 'days'}
          </span>
        );
      }
      if (diff <= 7) {
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
            Closes this week ({format(expDate, 'MMM d')})
          </span>
        );
      }
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-surface-container-high text-on-surface-variant">
          Closes {format(expDate, 'MMM d')}
        </span>
      );
    } catch (_) {
      return null;
    }
  };

  // Render Single Job Application Card
  const renderJobCard = (app: JobApplication, isPastCard: boolean) => {
    const isApplied = app.status === 'Applied';
    const isNotCompleted = app.status === 'NOT COMPLETED';

    // Highlight styles according to requirement:
    // Highlight Applied jobs light blue.
    // Highlight Not Completed jobs light pink.
    let cardBgStyle = 'bg-surface-container-lowest border-outline-variant/20 hover:border-primary/40';
    if (isApplied) {
      cardBgStyle = 'bg-[#F2F8FF] border-[#B9DCFE] hover:border-[#60A5FA]';
    } else if (isNotCompleted) {
      cardBgStyle = 'bg-[#FFF2F6] border-[#FFCDDC] hover:border-[#F472B6]';
    }

    if (isPastCard) {
      cardBgStyle = 'bg-surface-container-lowest/80 border-outline-variant/30 opacity-90';
    }

    return (
      <div 
        key={app.id} 
        className={`border rounded-2xl p-5 transition-all shadow-xs flex flex-col group relative ${cardBgStyle}`}
      >
        <div className="flex justify-between items-start mb-2.5 gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="text-[17px] font-bold text-on-surface leading-snug mb-1 truncate">
              {app.position}
            </h4>
            <div className="text-[15px] font-semibold text-primary truncate">
              {app.company}
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border shadow-2xs ${
              isApplied
                ? 'bg-[#DCEEFF] text-[#034A75] border-[#93C5FD]'
                : isNotCompleted
                  ? 'bg-[#FFE4ED] text-[#831843] border-[#FBCFE8]'
                  : app.status === 'Interview'
                    ? 'bg-amber-100 text-amber-900 border-amber-200'
                    : app.status === 'Offer'
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                      : 'bg-gray-100 text-gray-800 border-gray-200'
            }`}>
              {app.status}
            </span>

            {/* Expiration badge */}
            {getExpirationBadge(app.jobClosesExpires)}
          </div>
        </div>

        {/* Metadata Badges */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3.5 text-[12px] text-on-surface-variant font-medium">
          {app.dateApplied ? (
            <div className="flex items-center gap-1.5 text-blue-900 font-semibold">
              <CalendarCheck className="w-3.5 h-3.5 text-blue-700" />
              <span>Applied: {(() => { try { return format(parseISO(app.dateApplied), 'MMM d, yyyy'); } catch(_) { return app.dateApplied; } })()}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-pink-900/80">
              <Clock className="w-3.5 h-3.5 text-pink-700" />
              <span>Not submitted yet</span>
            </div>
          )}

          {app.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary/70 shrink-0" />
              <span>{app.location}</span>
            </div>
          )}

          {app.workplaceType && (
            <span className="px-2 py-0.5 rounded-md bg-white/70 border border-outline-variant/15 text-[11px] font-semibold">
              {app.workplaceType}
            </span>
          )}

          {app.pay && (
            <div className="flex items-center gap-1 text-emerald-800 font-semibold">
              <DollarSign className="w-3.5 h-3.5" />
              <span>{app.pay}</span>
            </div>
          )}

          {app.priority && (
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
              app.priority === 'High' ? 'bg-red-100 text-red-900 border border-red-200' : 'bg-gray-100 text-gray-700'
            }`}>
              {app.priority} Priority
            </span>
          )}
        </div>

        {/* Cover Letter and Application Status Links */}
        <div className="flex flex-wrap items-center gap-2.5 mb-3 text-[12px]">
          {app.coverLetterLink ? (
            <a 
              href={app.coverLetterLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-3 py-1 rounded-lg bg-white text-primary border border-primary/25 hover:border-primary font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-primary" />
              <span>Cover Letter {app.coverLetterReady ? `(${app.coverLetterReady})` : ''}</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          ) : app.coverLetterReady ? (
            <span className="px-2.5 py-1 rounded-lg bg-surface-container-high/60 text-on-surface-variant text-[11px] font-semibold border border-outline-variant/15 flex items-center gap-1">
              <FileText className="w-3 h-3" />
              <span>Cover Letter: {app.coverLetterReady}</span>
            </span>
          ) : null}

          {app.applicationStatusLink && (
            <a 
              href={app.applicationStatusLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-3 py-1 rounded-lg bg-white text-emerald-800 border border-emerald-300 hover:border-emerald-500 font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>Application Status Portal</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          )}

          {app.link && (
            <a 
              href={app.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-3 py-1 rounded-lg bg-white text-on-surface-variant hover:text-primary border border-outline-variant/25 font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              <span>Job Posting</span>
            </a>
          )}
        </div>

        {/* Notes (Preserve all text) */}
        {app.notes && (
          <div className="mb-4 text-[13px] text-on-surface/85 bg-white/70 p-3 rounded-xl border border-outline-variant/15 whitespace-pre-wrap leading-relaxed shadow-2xs">
            {app.notes}
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-auto pt-3 border-t border-outline-variant/15 flex justify-between items-center gap-2">
          <div className="text-[11px] text-on-surface-variant/70">
            {app.syncedFromSheetAt ? 'Synced from Spreadsheet' : 'Saved in App'}
          </div>

          <div className="flex items-center gap-2">
            {isPastCard ? (
              <button 
                type="button"
                onClick={() => toggleJobPast(app.id, false)}
                className="px-3 py-1.5 text-[12px] font-semibold text-primary hover:bg-primary/10 rounded-lg border border-primary/30 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Restore to Active Applications"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Active</span>
              </button>
            ) : (
              <button 
                type="button"
                onClick={() => toggleJobPast(app.id, true)}
                className="px-3 py-1.5 text-[12px] font-semibold text-on-surface-variant hover:bg-surface-variant/40 rounded-lg border border-outline-variant/30 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Move to Past Applications"
              >
                <Archive className="w-3.5 h-3.5 text-amber-700" />
                <span>Archive</span>
              </button>
            )}

            <button 
              type="button"
              onClick={() => startEditJob(app)}
              className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
              title="Edit Job"
            >
              <Edit2 className="w-4 h-4" />
            </button>

            <button 
              type="button"
              onClick={() => deleteJob(app.id)}
              className="p-1.5 text-on-surface-variant hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              title="Delete Job"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 md:overflow-y-auto px-margin-mobile md:px-margin-desktop pb-safe-nav relative">
      {/* Top Header */}
      <div className="mt-4 mb-4 md:mt-8 md:mb-6 flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-[30px] md:text-[38px] leading-[1.2] font-bold font-headline-lg text-on-surface m-0 tracking-tight">
            Jobs & Tech Research
          </h2>
          <p className="text-[13px] md:text-[14px] text-on-surface-variant font-medium mt-1">
            Integrated Google Sheets tracker with local and remote company intelligence
          </p>
        </div>

        {/* Sync & Action Hub */}
        <div className="flex flex-wrap items-center gap-2.5">
          <SyncStatus status={syncStatus} />

          {/* Sync from Google Sheets Button */}
          <button 
            type="button"
            onClick={() => setSyncModalOpen(true)}
            className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-2 text-[13px] font-bold shadow-xs cursor-pointer hover:shadow-md"
            title="Synchronize with Google Sheets"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Sync from Google Sheets</span>
          </button>

          {/* Manage Saved Answers */}
          <button 
            type="button"
            onClick={() => {
              setManageModalInitialField('location');
              setManageModalOpen(true);
            }}
            className="px-3 py-2 rounded-full bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40 border border-outline-variant/30 transition-colors flex items-center gap-1.5 text-[12px] font-semibold cursor-pointer"
            title="Manage saved autocomplete answers"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Saved Answers</span>
          </button>

          {/* New Item Button */}
          {activeSection === 'applications' && (
            <button 
              onClick={() => { resetJobForm(); setIsAddingJob(true); }}
              className="px-4 py-2 rounded-full bg-primary text-on-primary hover:bg-primary/90 transition-colors flex items-center gap-2 text-[13px] font-bold shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Job</span>
            </button>
          )}

          {activeSection === 'local' && (
            <button 
              onClick={() => { resetLocalForm(); setIsAddingLocal(true); }}
              className="px-4 py-2 rounded-full bg-primary text-on-primary hover:bg-primary/90 transition-colors flex items-center gap-2 text-[13px] font-bold shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Local Company</span>
            </button>
          )}

          {activeSection === 'remote' && (
            <button 
              onClick={() => { resetRemoteForm(); setIsAddingRemote(true); }}
              className="px-4 py-2 rounded-full bg-primary text-on-primary hover:bg-primary/90 transition-colors flex items-center gap-2 text-[13px] font-bold shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Remote Company</span>
            </button>
          )}
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncMeta.lastSyncFormatted && (
        <div className="mb-5 px-4 py-2.5 bg-emerald-50/70 border border-emerald-200/60 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-[12px] text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span>Connected to Spreadsheet • Last synchronized: <strong>{syncMeta.lastSyncFormatted}</strong></span>
          </div>
          <button
            type="button"
            onClick={() => setSyncModalOpen(true)}
            className="text-emerald-800 font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Sync Again</span>
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Section Switcher Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-outline-variant/20 pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveSection('applications')}
          className={`px-4 py-2.5 rounded-full text-[14px] font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSection === 'applications'
              ? 'bg-primary text-on-primary shadow-xs'
              : 'text-on-surface-variant hover:bg-surface-variant/40'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Applications</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
            activeSection === 'applications' ? 'bg-white/25 text-white' : 'bg-surface-container-high text-on-surface'
          }`}>
            {applications.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSection('local')}
          className={`px-4 py-2.5 rounded-full text-[14px] font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSection === 'local'
              ? 'bg-primary text-on-primary shadow-xs'
              : 'text-on-surface-variant hover:bg-surface-variant/40'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Local Tech Companies</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
            activeSection === 'local' ? 'bg-white/25 text-white' : 'bg-surface-container-high text-on-surface'
          }`}>
            {localCompanies.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSection('remote')}
          className={`px-4 py-2.5 rounded-full text-[14px] font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSection === 'remote'
              ? 'bg-primary text-on-primary shadow-xs'
              : 'text-on-surface-variant hover:bg-surface-variant/40'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Remote Companies</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
            activeSection === 'remote' ? 'bg-white/25 text-white' : 'bg-surface-container-high text-on-surface'
          }`}>
            {remoteCompanies.length}
          </span>
        </button>
      </div>

      {/* ================= SECTION 1: APPLICATIONS ================= */}
      {activeSection === 'applications' && (
        <div className="space-y-6">
          {/* Expiration Alert Banner */}
          {stats.closingSoonJobs.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 text-amber-950">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
                <span className="text-[13px] font-semibold">
                  <strong>{stats.closingSoonJobs.length} {stats.closingSoonJobs.length === 1 ? 'job listing is' : 'job listings are'} closing this week:</strong>{' '}
                  {stats.closingSoonJobs.map(j => `${j.company} (${j.jobClosesExpires})`).join(', ')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStatusFilter('closing-soon')}
                className="px-3 py-1 rounded-lg bg-amber-200/70 hover:bg-amber-200 text-amber-900 font-bold text-[12px] shrink-0 cursor-pointer"
              >
                View
              </button>
            </div>
          )}

          {/* Stats Bar (Weekly, Monthly, Monday Applications) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="p-4 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl shadow-2xs">
              <div className="flex items-center gap-2 text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-1">
                <CalendarDays className="w-3.5 h-3.5 text-primary" />
                <span>This Week</span>
              </div>
              <div className="text-[24px] font-black text-on-surface leading-tight">
                {stats.thisWeekCount}
              </div>
              <div className="text-[11px] text-on-surface-variant font-medium mt-0.5">
                Applications submitted
              </div>
            </div>

            <div className="p-4 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl shadow-2xs">
              <div className="flex items-center gap-2 text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                <span>This Month</span>
              </div>
              <div className="text-[24px] font-black text-on-surface leading-tight">
                {stats.thisMonthCount}
              </div>
              <div className="text-[11px] text-on-surface-variant font-medium mt-0.5">
                Active month total
              </div>
            </div>

            <div className="p-4 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl shadow-2xs">
              <div className="flex items-center gap-2 text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-1">
                <Target className="w-3.5 h-3.5 text-emerald-600" />
                <span>Monday Tracker</span>
              </div>
              <div className="text-[24px] font-black text-emerald-900 leading-tight">
                {stats.mondayAppliedTotal}
              </div>
              <div className="text-[11px] text-emerald-800 font-medium mt-0.5">
                Submitted on Mondays ({stats.completedThisMonday} this week)
              </div>
            </div>

            <div className="p-4 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl shadow-2xs">
              <div className="flex items-center gap-2 text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-pink-600" />
                <span>Applied Total</span>
              </div>
              <div className="text-[24px] font-black text-on-surface leading-tight">
                {applications.filter(a => a.status === 'Applied').length}
              </div>
              <div className="text-[11px] text-on-surface-variant font-medium mt-0.5">
                {applications.filter(a => a.status === 'NOT COMPLETED').length} in preparation
              </div>
            </div>
          </div>

          {/* Search, Filter & Sort Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface-container-low/40 rounded-2xl border border-outline-variant/20">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-on-surface-variant/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search job title, company, location, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white rounded-xl border border-outline-variant/30 text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Filter by Status */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-on-surface-variant" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-white rounded-xl border border-outline-variant/30 text-[13px] font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
              >
                <option value="all">All Statuses ({applications.length})</option>
                <option value="Applied">Applied ({applications.filter(a => a.status === 'Applied').length})</option>
                <option value="NOT COMPLETED">NOT COMPLETED ({applications.filter(a => a.status === 'NOT COMPLETED').length})</option>
                <option value="Interview">Interview</option>
                <option value="Offer">Offer</option>
                <option value="Rejected">Rejected</option>
                <option value="closing-soon">Closing Soon (Next 7 days)</option>
              </select>
            </div>

            {/* Sort by */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-3.5 h-3.5 text-on-surface-variant" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-white rounded-xl border border-outline-variant/30 text-[13px] font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
              >
                <option value="date">Sort: Date Applied / Added</option>
                <option value="priority">Sort: Priority (High to Low)</option>
                <option value="expiration">Sort: Expiration Date</option>
                <option value="company">Sort: Company (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Active Job Cards Grid */}
          {activeJobs.length === 0 ? (
            <div className="text-center py-12 bg-surface-container-low/20 rounded-3xl border border-dashed border-outline-variant/30">
              <Briefcase className="w-10 h-10 text-on-surface-variant/40 mx-auto mb-2" />
              <p className="text-[15px] font-bold text-on-surface">No matching applications found</p>
              <p className="text-[13px] text-on-surface-variant max-w-sm mx-auto mt-1">
                {searchQuery || statusFilter !== 'all' ? 'Try adjusting your search terms or filter.' : 'Click "Add Job" or "Sync from Google Sheets" to populate applications.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeJobs.map(app => renderJobCard(app, false))}
            </div>
          )}

          {/* Past / Archived Section */}
          {pastJobs.length > 0 && (
            <div className="pt-6 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => setIsPastCollapsed(!isPastCollapsed)}
                className="flex items-center gap-2 text-[14px] font-bold text-on-surface-variant hover:text-on-surface cursor-pointer mb-4"
              >
                {isPastCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <span>Archived / Past Applications ({pastJobs.length})</span>
              </button>

              {!isPastCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pastJobs.map(app => renderJobCard(app, true))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= SECTION 2: LOCAL TECH COMPANIES ================= */}
      {activeSection === 'local' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface-container-low/40 rounded-2xl border border-outline-variant/20">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-on-surface-variant/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search local companies, area, keywords, or entry roles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white rounded-xl border border-outline-variant/30 text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Filter by Area */}
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-on-surface-variant" />
              <select
                value={localAreaFilter}
                onChange={(e) => setLocalAreaFilter(e.target.value)}
                className="px-3 py-2 bg-white rounded-xl border border-outline-variant/30 text-[13px] font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
              >
                <option value="all">All Local Areas ({localCompanies.length})</option>
                {availableLocalAreas.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>
          </div>

          {filteredLocalCompanies.length === 0 ? (
            <div className="text-center py-12 bg-surface-container-low/20 rounded-3xl border border-dashed border-outline-variant/30">
              <Building2 className="w-10 h-10 text-on-surface-variant/40 mx-auto mb-2" />
              <p className="text-[15px] font-bold text-on-surface">No local companies match your filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLocalCompanies.map(comp => (
                <div 
                  key={comp.id}
                  className="bg-surface-container-lowest border border-outline-variant/20 hover:border-primary/40 rounded-2xl p-5 shadow-2xs flex flex-col transition-all group"
                >
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[17px] font-bold text-on-surface leading-tight truncate">
                        {comp.companyName}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-800 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>{comp.localArea}</span>
                      </div>
                    </div>

                    {comp.goodEntryLevelJobs && (
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider shrink-0 ${
                        comp.goodEntryLevelJobs === 'WAIT'
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                      }`}>
                        {comp.goodEntryLevelJobs}
                      </span>
                    )}
                  </div>

                  {/* Career Page Link */}
                  {comp.careerPageUrl ? (
                    <a
                      href={comp.careerPageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline text-[13px] font-semibold mb-3 truncate"
                    >
                      <span>{comp.careerPageTitle || 'Career Page'}</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                    </a>
                  ) : comp.careerPageTitle ? (
                    <span className="text-[13px] font-semibold text-on-surface-variant mb-3 block truncate">
                      {comp.careerPageTitle}
                    </span>
                  ) : null}

                  {/* What I'd Search For Tags */}
                  {comp.whatToSearchFor && (
                    <div className="mb-3 space-y-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block">
                        Search Keywords:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {comp.whatToSearchFor.split(',').map((term, tIdx) => (
                          <span 
                            key={tIdx}
                            className="px-2 py-0.5 rounded-md bg-surface-container-high text-on-surface-variant text-[11px] font-semibold"
                          >
                            {term.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Research Notes */}
                  {comp.researchNotes && (
                    <div className="mb-4 text-[12px] text-on-surface/80 bg-surface-container-low/40 p-2.5 rounded-xl border border-outline-variant/10 leading-relaxed whitespace-pre-wrap">
                      {comp.researchNotes}
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="mt-auto pt-3 border-t border-outline-variant/15 flex justify-between items-center">
                    <span className="text-[11px] text-on-surface-variant/60">Local Central Iowa</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setLocalFormData(comp);
                          setEditingLocalId(comp.id);
                          setIsAddingLocal(true);
                        }}
                        className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                        title="Edit Company"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLocalCompany(comp.id)}
                        className="p-1.5 text-on-surface-variant hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Company"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= SECTION 3: REMOTE COMPANIES ================= */}
      {activeSection === 'remote' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface-container-low/40 rounded-2xl border border-outline-variant/20">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-on-surface-variant/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search remote companies, role types, or fit reasons..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white rounded-xl border border-outline-variant/30 text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Filter by Priority */}
            <div className="flex items-center gap-2">
              <Star className="w-3.5 h-3.5 text-on-surface-variant" />
              <select
                value={remotePriorityFilter}
                onChange={(e) => setRemotePriorityFilter(e.target.value)}
                className="px-3 py-2 bg-white rounded-xl border border-outline-variant/30 text-[13px] font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
              >
                <option value="all">All Priorities ({remoteCompanies.length})</option>
                <option value="High">High Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="Low">Low Priority</option>
              </select>
            </div>
          </div>

          {filteredRemoteCompanies.length === 0 ? (
            <div className="text-center py-12 bg-surface-container-low/20 rounded-3xl border border-dashed border-outline-variant/30">
              <Globe className="w-10 h-10 text-on-surface-variant/40 mx-auto mb-2" />
              <p className="text-[15px] font-bold text-on-surface">No remote companies match your filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRemoteCompanies.map(comp => (
                <div 
                  key={comp.id}
                  className="bg-surface-container-lowest border border-outline-variant/20 hover:border-primary/40 rounded-2xl p-5 shadow-2xs flex flex-col transition-all group"
                >
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[17px] font-bold text-on-surface leading-tight truncate">
                        {comp.companyName}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-blue-700 mt-1">
                        <Globe className="w-3.5 h-3.5 shrink-0" />
                        <span>100% Remote / Distributed</span>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider shrink-0 ${
                      comp.priority === 'High' 
                        ? 'bg-rose-100 text-rose-900 border border-rose-200' 
                        : 'bg-amber-100 text-amber-900 border border-amber-200'
                    }`}>
                      {comp.priority} Priority
                    </span>
                  </div>

                  {comp.careerPageUrl && (
                    <a
                      href={comp.careerPageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline text-[13px] font-semibold mb-3 truncate"
                    >
                      <span>Careers & Openings</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                    </a>
                  )}

                  {/* Job Types to Watch */}
                  {comp.jobTypesToWatch && (
                    <div className="mb-3 space-y-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block">
                        Roles to Watch:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {comp.jobTypesToWatch.split(',').map((term, tIdx) => (
                          <span 
                            key={tIdx}
                            className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 text-[11px] font-semibold border border-blue-100"
                          >
                            {term.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reasons They Fit */}
                  {comp.reasonsTheyFit && (
                    <div className="mb-4 text-[12px] text-on-surface/85 bg-pink-50/50 p-3 rounded-xl border border-pink-200/50 leading-relaxed">
                      <span className="font-bold text-pink-900 block mb-0.5">Why They Fit Experience:</span>
                      <p>{comp.reasonsTheyFit}</p>
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="mt-auto pt-3 border-t border-outline-variant/15 flex justify-between items-center">
                    <span className="text-[11px] text-on-surface-variant/60">Remote Company</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setRemoteFormData(comp);
                          setEditingRemoteId(comp.id);
                          setIsAddingRemote(true);
                        }}
                        className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                        title="Edit Company"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRemoteCompany(comp.id)}
                        className="p-1.5 text-on-surface-variant hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Company"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL 1: ADD / EDIT JOB APPLICATION ================= */}
      {isAddingJob && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 md:p-6 bg-black/40 backdrop-blur-xs overflow-hidden"
          role="dialog"
          aria-modal="true"
        >
          <form 
            noValidate 
            onSubmit={handleSaveJob} 
            className="w-full max-w-3xl h-[100dvh] max-h-[100dvh] sm:h-[92dvh] sm:max-h-[92dvh] bg-surface-container-lowest rounded-none sm:rounded-2xl border-0 sm:border border-outline-variant/30 shadow-2xl flex flex-col box-border overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-outline-variant/20 bg-surface-container-lowest shrink-0">
              <h4 className="text-[19px] font-bold text-on-surface m-0">
                {editingJobId ? 'Edit Application' : 'Add Job Application'}
              </h4>
              <button 
                type="button" 
                onClick={() => { setIsAddingJob(false); resetJobForm(); }}
                className="text-on-surface-variant hover:text-on-surface p-2 rounded-xl text-[13px] font-medium"
              >
                Close
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
              {validationError && (
                <div className="p-3 bg-red-100 text-red-900 rounded-xl text-[13px] font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Company & Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-bold text-on-surface mb-1">Company Name *</label>
                  <input 
                    type="text"
                    required
                    value={jobFormData.company || ''}
                    onChange={(e) => setJobFormData(prev => ({ ...prev, company: e.target.value }))}
                    placeholder="e.g. Workiva, John Deere, GitHub"
                    className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-on-surface mb-1">Job Position / Title *</label>
                  <input 
                    type="text"
                    required
                    value={jobFormData.position || ''}
                    onChange={(e) => setJobFormData(prev => ({ ...prev, position: e.target.value }))}
                    placeholder="e.g. Software Engineer, Frontend Developer"
                    className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[14px]"
                  />
                </div>
              </div>

              {/* Status & Date Applied */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-bold text-on-surface mb-1">Status</label>
                  <select
                    value={jobFormData.status || 'NOT COMPLETED'}
                    onChange={(e) => setJobFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[14px] cursor-pointer"
                  >
                    <option value="NOT COMPLETED">NOT COMPLETED (Preparing to apply)</option>
                    <option value="Applied">Applied</option>
                    <option value="Interview">Interview</option>
                    <option value="Offer">Offer</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-on-surface mb-1">Date Applied</label>
                  <input 
                    type="date"
                    value={jobFormData.dateApplied || ''}
                    onChange={(e) => setJobFormData(prev => ({ ...prev, dateApplied: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[14px]"
                  />
                  <span className="text-[11px] text-on-surface-variant">Leave blank if not applied yet.</span>
                </div>
              </div>

              {/* Autocomplete Fields: Location, Workplace, Employment */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <JobAutocompleteCombobox 
                    id="job-location"
                    label="Location"
                    value={jobFormData.location || ''}
                    onChange={(val) => setJobFormData(prev => ({ ...prev, location: val }))}
                    suggestions={autocompleteHistory.location}
                    placeholder="e.g. Des Moines, Remote"
                    onOpenManage={() => {
                      setManageModalInitialField('location');
                      setManageModalOpen(true);
                    }}
                  />
                </div>
                <div>
                  <JobAutocompleteCombobox 
                    id="job-workplace"
                    label="Workplace Arrangement"
                    value={jobFormData.workplaceType || ''}
                    onChange={(val) => setJobFormData(prev => ({ ...prev, workplaceType: val }))}
                    suggestions={autocompleteHistory.workplaceType}
                    placeholder="Remote, Hybrid, On-site"
                    onOpenManage={() => {
                      setManageModalInitialField('workplaceType');
                      setManageModalOpen(true);
                    }}
                  />
                </div>
                <div>
                  <JobAutocompleteCombobox 
                    id="job-employment"
                    label="Employment Type"
                    value={jobFormData.employmentType || ''}
                    onChange={(val) => setJobFormData(prev => ({ ...prev, employmentType: val }))}
                    suggestions={autocompleteHistory.employmentType}
                    placeholder="Full-time, Part-time, Contract"
                    onOpenManage={() => {
                      setManageModalInitialField('employmentType');
                      setManageModalOpen(true);
                    }}
                  />
                </div>
              </div>

              {/* Pay, Priority & Expiration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[13px] font-bold text-on-surface mb-1">Pay / Compensation</label>
                  <input 
                    type="text"
                    value={jobFormData.pay || ''}
                    onChange={(e) => setJobFormData(prev => ({ ...prev, pay: e.target.value }))}
                    placeholder="e.g. $85,000 / yr, $45/hr"
                    className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-on-surface mb-1">Priority</label>
                  <select
                    value={jobFormData.priority || 'Medium'}
                    onChange={(e) => setJobFormData(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[14px]"
                  >
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-on-surface mb-1">Job Closes / Expires</label>
                  <input 
                    type="date"
                    value={jobFormData.jobClosesExpires || ''}
                    onChange={(e) => setJobFormData(prev => ({ ...prev, jobClosesExpires: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[14px]"
                  />
                </div>
              </div>

              {/* Cover Letter Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-bold text-on-surface mb-1">Cover Letter Ready?</label>
                  <select
                    value={jobFormData.coverLetterReady || 'Needed'}
                    onChange={(e) => setJobFormData(prev => ({ ...prev, coverLetterReady: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[14px]"
                  >
                    <option value="Ready">Ready</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Needed">Needed</option>
                    <option value="Not Needed">Not Needed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-on-surface mb-1">Cover Letter Link</label>
                  <input 
                    type="url"
                    value={jobFormData.coverLetterLink || ''}
                    onChange={(e) => setJobFormData(prev => ({ ...prev, coverLetterLink: e.target.value }))}
                    placeholder="https://docs.google.com/document/d/..."
                    className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[14px]"
                  />
                </div>
              </div>

              {/* Links */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-bold text-on-surface mb-1">Application Status Link</label>
                  <input 
                    type="url"
                    value={jobFormData.applicationStatusLink || ''}
                    onChange={(e) => setJobFormData(prev => ({ ...prev, applicationStatusLink: e.target.value }))}
                    placeholder="https://company.com/portal/status"
                    className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-on-surface mb-1">Job Posting URL</label>
                  <input 
                    type="url"
                    value={jobFormData.link || ''}
                    onChange={(e) => setJobFormData(prev => ({ ...prev, link: e.target.value }))}
                    placeholder="https://linkedin.com/jobs/..."
                    className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[14px]"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[13px] font-bold text-on-surface mb-1">Notes & Follow-up</label>
                <textarea 
                  rows={4}
                  value={jobFormData.notes || ''}
                  onChange={(e) => setJobFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notes, recruiter contacts, interview prep, or reasons for fit..."
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[14px] leading-relaxed"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-outline-variant/20 bg-surface-container-lowest flex justify-end gap-3 shrink-0">
              <button 
                type="button"
                onClick={() => { setIsAddingJob(false); resetJobForm(); }}
                className="px-5 py-2.5 rounded-full font-bold text-[14px] text-on-surface-variant hover:bg-surface-variant/40"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={isSaving}
                className="px-7 py-2.5 rounded-full bg-primary hover:bg-primary/90 text-on-primary font-bold text-[14px] shadow-sm flex items-center gap-2 cursor-pointer"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Save Application</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= MODAL 2: ADD / EDIT LOCAL COMPANY ================= */}
      {isAddingLocal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-xs overflow-hidden"
          role="dialog"
          aria-modal="true"
        >
          <form 
            onSubmit={handleSaveLocal}
            className="w-full max-w-xl bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-outline-variant/20">
              <h4 className="text-[18px] font-bold text-on-surface m-0">
                {editingLocalId ? 'Edit Local Tech Company' : 'Add Local Tech Company'}
              </h4>
              <button 
                type="button" 
                onClick={() => { setIsAddingLocal(false); resetLocalForm(); }}
                className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-lg text-[13px]"
              >
                Close
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-[13px] font-bold text-on-surface mb-1">Company Name *</label>
                <input 
                  type="text"
                  required
                  value={localFormData.companyName || ''}
                  onChange={(e) => setLocalFormData(prev => ({ ...prev, companyName: e.target.value }))}
                  placeholder="e.g. RFA Engineering, Principal, Workiva"
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[14px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-bold text-on-surface mb-1">Local Area</label>
                  <input 
                    type="text"
                    value={localFormData.localArea || ''}
                    onChange={(e) => setLocalFormData(prev => ({ ...prev, localArea: e.target.value }))}
                    placeholder="e.g. Urbandale, Des Moines, Ames"
                    className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-on-surface mb-1">Good Entry-Level Jobs</label>
                  <input 
                    type="text"
                    value={localFormData.goodEntryLevelJobs || ''}
                    onChange={(e) => setLocalFormData(prev => ({ ...prev, goodEntryLevelJobs: e.target.value }))}
                    placeholder="e.g. Entry Level Software Engineer, WAIT"
                    className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[14px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-bold text-on-surface mb-1">Career Page Link</label>
                <input 
                  type="url"
                  value={localFormData.careerPageUrl || ''}
                  onChange={(e) => setLocalFormData(prev => ({ ...prev, careerPageUrl: e.target.value }))}
                  placeholder="https://company.com/careers"
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[14px]"
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-on-surface mb-1">What I'd Search For (Keywords)</label>
                <input 
                  type="text"
                  value={localFormData.whatToSearchFor || ''}
                  onChange={(e) => setLocalFormData(prev => ({ ...prev, whatToSearchFor: e.target.value }))}
                  placeholder="Software Engineer, Embedded, AI/ML, Data Engineer"
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[14px]"
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-on-surface mb-1">Research Notes</label>
                <textarea 
                  rows={3}
                  value={localFormData.researchNotes || ''}
                  onChange={(e) => setLocalFormData(prev => ({ ...prev, researchNotes: e.target.value }))}
                  placeholder="Office location details, tech stack, referral contacts..."
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[14px]"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-outline-variant/20 bg-surface-container-lowest flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => { setIsAddingLocal(false); resetLocalForm(); }}
                className="px-5 py-2.5 rounded-full font-bold text-[14px] text-on-surface-variant"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-6 py-2.5 rounded-full bg-primary text-white font-bold text-[14px] shadow-sm"
              >
                Save Company
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= MODAL 3: ADD / EDIT REMOTE COMPANY ================= */}
      {isAddingRemote && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-xs overflow-hidden"
          role="dialog"
          aria-modal="true"
        >
          <form 
            onSubmit={handleSaveRemote}
            className="w-full max-w-xl bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-outline-variant/20">
              <h4 className="text-[18px] font-bold text-on-surface m-0">
                {editingRemoteId ? 'Edit Remote Company' : 'Add Remote Company'}
              </h4>
              <button 
                type="button" 
                onClick={() => { setIsAddingRemote(false); resetRemoteForm(); }}
                className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-lg text-[13px]"
              >
                Close
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-bold text-on-surface mb-1">Company Name *</label>
                  <input 
                    type="text"
                    required
                    value={remoteFormData.companyName || ''}
                    onChange={(e) => setRemoteFormData(prev => ({ ...prev, companyName: e.target.value }))}
                    placeholder="e.g. GitHub, Automattic, Zapier"
                    className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-on-surface mb-1">Priority</label>
                  <select
                    value={remoteFormData.priority || 'High'}
                    onChange={(e) => setRemoteFormData(prev => ({ ...prev, priority: e.target.value as any }))}
                    className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[14px]"
                  >
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-bold text-on-surface mb-1">Career Page Link</label>
                <input 
                  type="url"
                  value={remoteFormData.careerPageUrl || ''}
                  onChange={(e) => setRemoteFormData(prev => ({ ...prev, careerPageUrl: e.target.value }))}
                  placeholder="https://company.com/careers"
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[14px]"
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-on-surface mb-1">Job Types to Watch</label>
                <input 
                  type="text"
                  value={remoteFormData.jobTypesToWatch || ''}
                  onChange={(e) => setRemoteFormData(prev => ({ ...prev, jobTypesToWatch: e.target.value }))}
                  placeholder="Frontend Engineer, UI/UX Developer, Full Stack"
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[14px]"
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-on-surface mb-1">Reasons They Fit My Experience</label>
                <textarea 
                  rows={3}
                  value={remoteFormData.reasonsTheyFit || ''}
                  onChange={(e) => setRemoteFormData(prev => ({ ...prev, reasonsTheyFit: e.target.value }))}
                  placeholder="Remote culture, React & TypeScript focus, creative UI tools..."
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[14px]"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-outline-variant/20 bg-surface-container-lowest flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => { setIsAddingRemote(false); resetRemoteForm(); }}
                className="px-5 py-2.5 rounded-full font-bold text-[14px] text-on-surface-variant"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-6 py-2.5 rounded-full bg-primary text-white font-bold text-[14px] shadow-sm"
              >
                Save Company
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sync from Google Sheets / Import Modal */}
      <JobSpreadsheetImportModal 
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        existingJobs={applications}
        existingLocalCompanies={localCompanies}
        existingRemoteCompanies={remoteCompanies}
        syncMeta={syncMeta}
        onSyncComplete={handleSyncComplete}
      />

      {/* Manage Saved Autocomplete Answers Modal */}
      <ManageSavedAnswersModal 
        isOpen={manageModalOpen}
        onClose={() => setManageModalOpen(false)}
        history={autocompleteHistory}
        onUpdateHistory={saveAutocompleteHistory}
        initialField={manageModalInitialField}
      />
    </div>
  );
}
