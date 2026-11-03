import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { cleanRawUrl } from './jobUrlUtils';
import { getAccessToken } from './AuthContext';

export interface JobApplication {
  id: string;
  company: string;
  position: string;
  status: 'Applied' | 'NOT COMPLETED' | 'Interview' | 'Offer' | 'Rejected' | 'Draft';
  dateApplied: string;
  link: string;
  notes: string;
  location?: string;
  workplaceType?: string;
  employmentType?: string;
  salaryMin?: string;
  salaryMax?: string;
  salaryPeriod?: string;
  pay?: string;
  priority?: 'High' | 'Medium' | 'Low' | string;
  whyIMatch?: string;
  importantRequirements?: string;
  datePosted?: string;
  applicationDeadline?: string;
  coverLetterReady?: string;
  coverLetterLink?: string;
  applicationStatusLink?: string;
  jobClosesExpires?: string;
  shortSummary?: string;
  responsibilities?: string[];
  requiredQualifications?: string[];
  preferredQualifications?: string[];
  source?: string;
  originalUrl?: string;
  jobId?: string;
  isPast?: boolean;
  createdAt?: number;
  lastModifiedLocally?: number;
  syncedFromSheetAt?: number;
}

export interface LocalCompany {
  id: string;
  companyName: string;
  careerPageTitle?: string;
  careerPageUrl?: string;
  localArea: string;
  whatToSearchFor: string;
  goodEntryLevelJobs?: string;
  potentialRoles?: string;
  researchNotes?: string;
  isPriority?: boolean;
  createdAt: number;
}

export interface RemoteCompany {
  id: string;
  companyName: string;
  careerPageUrl?: string;
  jobTypesToWatch: string;
  priority: 'High' | 'Medium' | 'Low';
  reasonsTheyFit: string;
  notes?: string;
  createdAt: number;
}

export interface JobSyncMeta {
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  lastSyncTimestamp?: number;
  lastSyncFormatted?: string;
  syncedBy?: string;
  totalSyncedJobs?: number;
  totalSyncedLocal?: number;
  totalSyncedRemote?: number;
}

export interface JobConflictItem {
  id: string;
  type: 'job' | 'localCompany' | 'remoteCompany';
  identifier: string; // e.g. "RFA Engineering - Entry Level"
  differences: {
    field: string;
    label: string;
    appValue: string;
    sheetValue: string;
  }[];
  appItem: any;
  sheetItem: any;
}

export interface MultiSheetSyncResult {
  mergedJobs: JobApplication[];
  mergedLocalCompanies: LocalCompany[];
  mergedRemoteCompanies: RemoteCompany[];
  addedJobsCount: number;
  updatedJobsCount: number;
  addedLocalCount: number;
  updatedLocalCount: number;
  addedRemoteCount: number;
  updatedRemoteCount: number;
  conflicts: JobConflictItem[];
  meta: JobSyncMeta;
}

/**
 * Pre-populated initial seed of Local Tech Companies from the user's research spreadsheet
 */
export const INITIAL_LOCAL_COMPANIES: LocalCompany[] = [
  {
    id: 'local-comp-1',
    companyName: 'RFA Engineering',
    careerPageTitle: 'RFA Engineering Careers',
    careerPageUrl: 'https://rfaengineering.com/careers/',
    localArea: 'Urbandale',
    whatToSearchFor: 'Software Engineer, Embedded, AI/ML, Computer Vision, Data Engineer',
    goodEntryLevelJobs: 'Entry Level Software Engineer',
    researchNotes: 'Engineering consulting firm with strong software & embedded tech focus in Central Iowa.',
    createdAt: Date.now() - 25000000,
  },
  {
    id: 'local-comp-2',
    companyName: 'John Deere',
    careerPageTitle: 'John Deere Careers',
    careerPageUrl: 'https://www.deere.com/en/our-company/john-deere-careers/',
    localArea: 'Urbandale, Ankeny, Ames',
    whatToSearchFor: 'Software, Computer Engineering, IT, AI, Embedded, Infrastructure',
    goodEntryLevelJobs: 'WAIT',
    researchNotes: 'Major intelligent ag tech facilities in Urbandale ISG & Ames. Check for upcoming early-career cohort rotations.',
    createdAt: Date.now() - 24000000,
  },
  {
    id: 'local-comp-3',
    companyName: 'Berkley Technology Services',
    careerPageTitle: 'Berkley Technology Services Careers',
    careerPageUrl: 'https://www.berkley.com/careers',
    localArea: 'Urbandale',
    whatToSearchFor: 'IT Support, Software, Systems, Cloud, Cybersecurity, Internships',
    goodEntryLevelJobs: 'WAIT',
    researchNotes: 'Tech division of W.R. Berkley. Dedicated enterprise technology hub in Urbandale.',
    createdAt: Date.now() - 23000000,
  },
  {
    id: 'local-comp-4',
    companyName: 'Principal Financial Group',
    careerPageTitle: 'Principal Careers',
    careerPageUrl: 'https://www.principal.com/careers',
    localArea: 'Des Moines',
    whatToSearchFor: 'Software, IT Support, Cloud, Cybersecurity, Data, Infrastructure',
    goodEntryLevelJobs: 'WAIT',
    researchNotes: 'Downtown Des Moines flagship global tech employer. Offers formal tech development programs.',
    createdAt: Date.now() - 22000000,
  },
  {
    id: 'local-comp-5',
    companyName: 'Wellmark Blue Cross and Blue Shield',
    careerPageTitle: 'Wellmark Careers',
    careerPageUrl: 'https://www.wellmark.com/careers',
    localArea: 'Des Moines',
    whatToSearchFor: 'Software Engineering, IT, Data, Security, Technical Support',
    goodEntryLevelJobs: 'WAIT',
    researchNotes: 'Major healthcare tech footprint downtown with strong work-life balance and hybrid options.',
    createdAt: Date.now() - 21000000,
  },
  {
    id: 'local-comp-6',
    companyName: 'Hy-Vee',
    careerPageTitle: 'Hy-Vee Careers',
    careerPageUrl: 'https://www.hy-vee.com/careers',
    localArea: 'West Des Moines/Grimes',
    whatToSearchFor: 'Software, Network & Systems, Data, IT, Security',
    goodEntryLevelJobs: '',
    researchNotes: 'Internal tech agency & digital innovation team building Aisles Online and retail platforms.',
    createdAt: Date.now() - 20000000,
  },
  {
    id: 'local-comp-7',
    companyName: 'Workiva',
    careerPageTitle: 'Workiva Careers',
    careerPageUrl: 'https://www.workiva.com/careers',
    localArea: 'Ames',
    whatToSearchFor: 'Software Engineering, Cloud, Data, AI, Technical Support',
    goodEntryLevelJobs: '',
    researchNotes: 'Public SaaS company headquartered in Ames. Modern web stack, microservices, and AI integrations.',
    createdAt: Date.now() - 19000000,
  },
  {
    id: 'local-comp-8',
    companyName: 'Ag Leader Technology',
    careerPageTitle: 'Ag Leader Careers',
    careerPageUrl: 'https://www.agleader.com/about/careers/',
    localArea: 'Ames',
    whatToSearchFor: 'Software, Embedded, Computer/Electrical Engineering, Testing',
    goodEntryLevelJobs: '',
    researchNotes: 'Precision agriculture hardware and software displays developed in Ames.',
    createdAt: Date.now() - 18000000,
  },
  {
    id: 'local-comp-9',
    companyName: 'Danfoss',
    careerPageTitle: 'Danfoss Careers',
    careerPageUrl: 'https://www.danfoss.com/en/about-danfoss/careers/',
    localArea: 'Ames',
    whatToSearchFor: 'Computer/Electrical Engineering, Software, Systems, Engineering',
    goodEntryLevelJobs: '',
    researchNotes: 'Power solutions and autonomous systems software research center in Ames.',
    createdAt: Date.now() - 17000000,
  },
  {
    id: 'local-comp-10',
    companyName: 'Microsoft',
    careerPageTitle: 'Microsoft Careers',
    careerPageUrl: 'https://careers.microsoft.com/',
    localArea: 'West Des Moines area',
    whatToSearchFor: 'Data Center Technician, Critical Environment, Cloud Infrastructure',
    goodEntryLevelJobs: '',
    researchNotes: 'Massive multi-campus data center presence in West Des Moines cloud region.',
    createdAt: Date.now() - 16000000,
  },
  {
    id: 'local-comp-11',
    companyName: 'Google Data Center',
    careerPageTitle: 'Google Data Center Careers',
    careerPageUrl: 'https://www.google.com/about/datacenters/locations/council-bluffs/',
    localArea: 'Central Iowa',
    whatToSearchFor: 'Data Center, Hardware, Network/Infrastructure',
    goodEntryLevelJobs: '',
    researchNotes: 'Extensive cloud infrastructure operations in Central Iowa / Council Bluffs region.',
    createdAt: Date.now() - 15000000,
  },
  {
    id: 'local-comp-12',
    companyName: 'Meta',
    careerPageTitle: 'Meta Careers',
    careerPageUrl: 'https://www.metacareers.com/',
    localArea: 'Altoona',
    whatToSearchFor: 'Data Center, Network, Infrastructure, Hardware',
    goodEntryLevelJobs: '',
    researchNotes: 'One of Meta’s largest global data center campuses located right in Altoona.',
    createdAt: Date.now() - 14000000,
  },
  {
    id: 'local-comp-13',
    companyName: 'LightEdge Solutions',
    careerPageTitle: 'LightEdge Careers',
    careerPageUrl: 'https://lightedge.com/careers/',
    localArea: 'Altoona',
    whatToSearchFor: 'Data Center, Cloud, Networking, Systems, Support',
    goodEntryLevelJobs: '',
    researchNotes: 'Enterprise cloud hosting, colocation, and compliance infrastructure operations.',
    createdAt: Date.now() - 13000000,
  },
  {
    id: 'local-comp-14',
    companyName: 'US Signal',
    careerPageTitle: 'US Signal Careers',
    careerPageUrl: 'https://ussignal.com/careers',
    localArea: 'Waukee',
    whatToSearchFor: 'Data Center, Network, Cloud, Technical Support',
    goodEntryLevelJobs: '',
    researchNotes: 'Waukee data center facility specializing in fiber network and cloud solutions.',
    createdAt: Date.now() - 12000000,
  },
  {
    id: 'local-comp-15',
    companyName: 'Athene',
    careerPageTitle: 'Athene Careers',
    careerPageUrl: 'https://www.athene.com/careers',
    localArea: 'West Des Moines',
    whatToSearchFor: 'IT, Software, Data, Application Support, Security',
    goodEntryLevelJobs: '',
    researchNotes: 'Rapidly growing financial services & retirement company with big tech investments.',
    createdAt: Date.now() - 11000000,
  },
  {
    id: 'local-comp-16',
    companyName: 'EMC Insurance',
    careerPageTitle: 'EMC Insurance Careers',
    careerPageUrl: 'https://www.emcins.com/careers',
    localArea: 'Des Moines',
    whatToSearchFor: 'IT, Application Development, Software, Data, Support',
    goodEntryLevelJobs: '',
    researchNotes: 'Downtown Des Moines headquarters. Active modernization of legacy systems to web services.',
    createdAt: Date.now() - 10000000,
  },
  {
    id: 'local-comp-17',
    companyName: 'Farm Bureau Financial Services',
    careerPageTitle: 'Farm Bureau Financial Services Careers',
    careerPageUrl: 'https://www.fbfs.com/careers',
    localArea: 'West Des Moines',
    whatToSearchFor: 'Application Developer, IT, Systems, Data, Support',
    goodEntryLevelJobs: '',
    researchNotes: 'West Des Moines campus with established software development and business systems teams.',
    createdAt: Date.now() - 9000000,
  },
  {
    id: 'local-comp-18',
    companyName: 'MidAmerican Energy',
    careerPageTitle: 'MidAmerican Energy Careers',
    careerPageUrl: 'https://www.midamericanenergy.com/careers',
    localArea: 'Des Moines',
    whatToSearchFor: 'Software Engineer I, Systems, IT, Application Development',
    goodEntryLevelJobs: '',
    researchNotes: 'Utility giant with smart grid operations, customer web portals, and software engineering I tracks.',
    createdAt: Date.now() - 8000000,
  },
  {
    id: 'local-comp-19',
    companyName: "Casey's",
    careerPageTitle: "Casey's Careers",
    careerPageUrl: 'https://www.caseys.com/careers',
    localArea: 'Ankeny',
    whatToSearchFor: 'Software, IT Support, Infrastructure, Data, Security',
    goodEntryLevelJobs: '',
    researchNotes: 'Ankeny corporate store operations headquarters, mobile app, and loyalty tech development.',
    createdAt: Date.now() - 7000000,
  },
  {
    id: 'local-comp-20',
    companyName: 'Ruan Transportation Management Systems',
    careerPageTitle: 'Ruan Careers',
    careerPageUrl: 'https://www.ruan.com/careers',
    localArea: 'Des Moines',
    whatToSearchFor: 'IT Support, Service Desk, Systems, Applications',
    goodEntryLevelJobs: '',
    researchNotes: 'Iconic Ruan Center tower downtown. Dedicated logistics software and fleet tech stack.',
    createdAt: Date.now() - 6000000,
  },
  {
    id: 'local-comp-21',
    companyName: 'Iowa State University',
    careerPageTitle: 'Iowa State University Jobs',
    careerPageUrl: 'https://jobs.iastate.edu/',
    localArea: 'Ames',
    whatToSearchFor: 'Software Developer I, IT Support, Systems, Research Computing',
    goodEntryLevelJobs: '',
    researchNotes: 'Continuous openings in IT Services, departmental software development, and student systems.',
    createdAt: Date.now() - 5000000,
  },
  {
    id: 'local-comp-22',
    companyName: 'Kingland Systems',
    careerPageTitle: 'Kingland Careers',
    careerPageUrl: 'https://www.kingland.com/careers',
    localArea: 'Ames',
    whatToSearchFor: 'Software, Data, Cloud, QA, Technology Analyst',
    goodEntryLevelJobs: '',
    researchNotes: 'Financial enterprise data and AI solutions provider based in Ames Campustown.',
    createdAt: Date.now() - 4000000,
  },
  {
    id: 'local-comp-23',
    companyName: 'Siemens Digital Industries',
    careerPageTitle: 'Siemens Careers',
    careerPageUrl: 'https://www.siemens.com/global/en/company/jobs.html',
    localArea: 'Ames',
    whatToSearchFor: 'Software, Engineering, PLM, Computer Engineering',
    goodEntryLevelJobs: '',
    researchNotes: 'Ames office develops industrial software simulation and PLM solutions.',
    createdAt: Date.now() - 3000000,
  },
  {
    id: 'local-comp-24',
    companyName: 'Wells Fargo',
    careerPageTitle: 'Wells Fargo Careers',
    careerPageUrl: 'https://www.wellsfargo.com/about/careers/',
    localArea: 'West Des Moines',
    whatToSearchFor: 'Technology, Software, Infrastructure, Cybersecurity',
    goodEntryLevelJobs: '',
    researchNotes: 'Large Jordan Creek tech center campus with recurring tech rotational and entry positions.',
    createdAt: Date.now() - 2000000,
  },
  {
    id: 'local-comp-25',
    companyName: 'Lumen Technologies',
    careerPageTitle: 'Lumen Careers',
    careerPageUrl: 'https://www.lumen.com/en-us/about/careers.html',
    localArea: 'Des Moines metro',
    whatToSearchFor: 'Network, NOC, Telecom, IT, Infrastructure',
    goodEntryLevelJobs: '',
    researchNotes: 'Telecommunications and edge computing backbone infrastructure across the Des Moines metro.',
    createdAt: Date.now() - 1000000,
  },
];

/**
 * Pre-populated initial seed of Remote Companies for tech & creative monitoring
 */
export const INITIAL_REMOTE_COMPANIES: RemoteCompany[] = [
  {
    id: 'remote-comp-1',
    companyName: 'GitHub',
    careerPageUrl: 'https://github.com/about/careers',
    jobTypesToWatch: 'Frontend Engineer, UI/UX Tools, Accessibility, Full Stack Developer',
    priority: 'High',
    reasonsTheyFit: 'Top developer-first remote culture, excellent tooling, modern React & TypeScript applications.',
    notes: 'Watch for Junior / Early Career postings during spring and fall cycles.',
    createdAt: Date.now() - 5000000,
  },
  {
    id: 'remote-comp-2',
    companyName: 'GitLab',
    careerPageUrl: 'https://about.gitlab.com/jobs/',
    jobTypesToWatch: 'Junior Frontend Engineer, Fullstack Engineer, Technical Writer',
    priority: 'High',
    reasonsTheyFit: '100% all-remote pioneer with fully transparent compensation, handbook, and hiring guidelines.',
    notes: 'Direct application without cover letter gimmicks; emphasizes documented PRs.',
    createdAt: Date.now() - 4000000,
  },
  {
    id: 'remote-comp-3',
    companyName: 'Automattic',
    careerPageUrl: 'https://automattic.com/work-with-us/',
    jobTypesToWatch: 'Code Wrangler (Frontend), WordPress VIP Engineer, Technical Support',
    priority: 'High',
    reasonsTheyFit: 'Global distributed pioneer. Values thoughtful written communication and hands-on paid trial project.',
    notes: 'Great match for web craft, open source, and stationery/digital publishing focus.',
    createdAt: Date.now() - 3000000,
  },
  {
    id: 'remote-comp-4',
    companyName: 'DuckDuckGo',
    careerPageUrl: 'https://duckduckgo.com/hiring',
    jobTypesToWatch: 'Software Engineer, Frontend Developer, Web Extension Developer',
    priority: 'Medium',
    reasonsTheyFit: 'High autonomy, privacy-focused mission, transparent project-based interview structure.',
    notes: 'Keep watch for web application & privacy browser extension opportunities.',
    createdAt: Date.now() - 2000000,
  },
  {
    id: 'remote-comp-5',
    companyName: 'Zapier',
    careerPageUrl: 'https://zapier.com/jobs',
    jobTypesToWatch: 'Software Engineer, Platform Integrations, UI Developer',
    priority: 'High',
    reasonsTheyFit: '100% remote company with strong developer API culture and friendly teamwork values.',
    notes: 'Focus on React, Python, and webhook/automation integrations.',
    createdAt: Date.now() - 1000000,
  },
  {
    id: 'remote-comp-6',
    companyName: '1Password',
    careerPageUrl: 'https://jobs.lever.co/1password',
    jobTypesToWatch: 'Web Application Developer, Frontend Engineer, Customer Support Engineering',
    priority: 'Medium',
    reasonsTheyFit: 'Privacy and security excellence, modern web stack, collaborative remote culture.',
    notes: 'Emphasizes high craft, clean UX, and thorough code quality.',
    createdAt: Date.now() - 500000,
  },
  {
    id: 'remote-comp-7',
    companyName: 'Figma',
    careerPageUrl: 'https://www.figma.com/careers/',
    jobTypesToWatch: 'Design Systems Engineer, Web Applications, Canvas & 3D Prototyping',
    priority: 'High',
    reasonsTheyFit: 'Direct match for Huntrr Space aesthetic: high-fidelity UI, creative tools, digital stationery.',
    notes: 'Exceptional creative design community and engineering team.',
    createdAt: Date.now() - 200000,
  }
];

/**
 * Normalizes text for matching and comparison
 */
export function normalizeStr(val?: string): string {
  if (!val) return '';
  return val
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Extracts Google Spreadsheet ID from a URL or raw ID string.
 */
export function extractSpreadsheetId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Pattern: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/...
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  // Raw ID check (typically 30-60 alphanumeric characters with dashes/underscores)
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Parses dates from spreadsheet (Excel serial numbers, dates, strings) into YYYY-MM-DD.
 * CRITICAL: Preserves blank dates accurately; returns empty string if no date exists.
 */
export function parseSpreadsheetDate(val: any): string {
  if (val === undefined || val === null || val === '') return '';
  if (val instanceof Date && !isNaN(val.getTime())) {
    return format(val, 'yyyy-MM-dd');
  }
  if (typeof val === 'number') {
    if (val <= 0) return '';
    const utcDays = Math.floor(val - 25569);
    const dateUtc = new Date(utcDays * 86400 * 1000);
    if (!isNaN(dateUtc.getTime())) {
      const y = dateUtc.getUTCFullYear();
      const m = String(dateUtc.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dateUtc.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const str = String(val).trim();
  if (!str) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  const m1 = str.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (m1) {
    let year = parseInt(m1[3], 10);
    if (year < 100) year += 2000;
    const month = String(parseInt(m1[1], 10)).padStart(2, '0');
    const day = String(parseInt(m1[2], 10)).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    try {
      return format(parsed, 'yyyy-MM-dd');
    } catch (_) {}
  }

  return str;
}

/**
 * Normalizes status from spreadsheet.
 * CRITICAL: Never automatically marks an unapplied job as applied.
 */
export function parseSpreadsheetStatus(val: any): 'Applied' | 'NOT COMPLETED' | 'Interview' | 'Offer' | 'Rejected' | 'Draft' {
  if (!val) return 'NOT COMPLETED';
  const str = String(val).trim().toUpperCase();

  if (str === 'APPLIED') return 'Applied';
  if (str.includes('NOT COMPLETED') || str.includes('NOT APPLIED') || str.includes('TO APPLY') || str.includes('TODO') || str.includes('UNAPPLIED')) {
    return 'NOT COMPLETED';
  }
  if (str.includes('INTERVIEW')) return 'Interview';
  if (str.includes('OFFER')) return 'Offer';
  if (str.includes('REJECT')) return 'Rejected';
  if (str.includes('DRAFT')) return 'NOT COMPLETED';

  // If literally contains 'APPLIED' alone
  return str === 'APPLIED' ? 'Applied' : 'NOT COMPLETED';
}

/**
 * Flexible header lookup helper
 */
function findRowValue(row: Record<string, any>, candidates: string[]): any {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const target = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const k of keys) {
      const normK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normK === target) {
        const v = row[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          return v;
        }
      }
    }
  }
  return undefined;
}

/**
 * Maps a single row object from "Jobs I Want to Apply For" to Partial<JobApplication>.
 * Preserves all columns:
 * Status, Date Applied, Company, Job Position, Location, Cover Letter Ready?, Cover Letter Link, Notes, Application Status Link, Job Closes / Expires.
 */
export function mapRowToJobApplication(row: Record<string, any>): Partial<JobApplication> | null {
  const company = findRowValue(row, ['Company', 'Company Name', 'Employer', 'Organization', 'Firm']);
  const position = findRowValue(row, ['Job Position', 'Position', 'Role', 'Title', 'Job Title', 'Job']);

  if (!company && !position) {
    return null;
  }

  const rawStatus = findRowValue(row, ['Status', 'Application Status', 'Job Status', 'State']);
  const status = parseSpreadsheetStatus(rawStatus);

  const rawDateApplied = findRowValue(row, ['Date Applied', 'Applied Date', 'Application Date', 'Date Submitted', 'Submitted Date']);
  const dateApplied = parseSpreadsheetDate(rawDateApplied);

  const location = findRowValue(row, ['Location', 'City', 'Job Location', 'Office']);
  const workplaceType = findRowValue(row, ['Work Arrangement', 'Workplace Type', 'Arrangement', 'Workplace', 'Remote Status', 'Remote/Onsite']);
  const employmentType = findRowValue(row, ['Job Type', 'Employment Type', 'Type', 'Contract Type']);
  const pay = findRowValue(row, ['Pay', 'Salary', 'Compensation', 'Pay Range', 'Salary Range', 'Rate']);
  const priority = findRowValue(row, ['Application Priority', 'Priority', 'Urgency', 'Rank']);
  
  // Specific required columns
  const coverLetterReady = findRowValue(row, ['Cover Letter Ready?', 'Cover Letter Ready', 'Cover Letter Status', 'Cover Letter Prepared']);
  const coverLetterLink = findRowValue(row, ['Cover Letter Link', 'Cover Letter URL', 'Cover Letter Doc', 'Letter Link']);
  const notes = findRowValue(row, ['Notes', 'Comments', 'Details', 'Follow Up', 'Research Notes']);
  const applicationStatusLink = findRowValue(row, ['Application Status Link', 'Status Link', 'Portal Link', 'Status URL', 'Check Status Link']);
  const jobClosesExpires = findRowValue(row, ['Job Closes / Expires', 'Job Closes', 'Job Expires', 'Closes', 'Expires', 'Deadline', 'Application Deadline', 'Expiration Date']);
  const link = findRowValue(row, ['Application Link', 'Link', 'Job Link', 'URL', 'Posting URL', 'Job URL', 'Apply Link']);

  const cleanLink = link ? cleanRawUrl(String(link)) : '';
  const cleanCoverLetterLink = coverLetterLink ? cleanRawUrl(String(coverLetterLink)) : '';
  const cleanStatusLink = applicationStatusLink ? cleanRawUrl(String(applicationStatusLink)) : '';

  return {
    company: String(company || '').trim(),
    position: String(position || '').trim(),
    status,
    // CRITICAL: Preserve blank dates, do not auto-fill today
    dateApplied: dateApplied || '',
    location: location ? String(location).trim() : '',
    workplaceType: workplaceType ? String(workplaceType).trim() : '',
    employmentType: employmentType ? String(employmentType).trim() : '',
    pay: pay ? String(pay).trim() : '',
    priority: priority ? String(priority).trim() : 'Medium',
    coverLetterReady: coverLetterReady ? String(coverLetterReady).trim() : '',
    coverLetterLink: cleanCoverLetterLink,
    notes: notes ? String(notes).trim() : '',
    applicationStatusLink: cleanStatusLink,
    jobClosesExpires: parseSpreadsheetDate(jobClosesExpires) || (jobClosesExpires ? String(jobClosesExpires).trim() : ''),
    applicationDeadline: parseSpreadsheetDate(jobClosesExpires) || '',
    link: cleanLink,
    originalUrl: cleanLink,
  };
}

/**
 * Maps a single row object from "Local Tech Companies" to LocalCompany.
 * Columns: Company career page, Local area, What I'd search for, Good Entry-Level Jobs, Research Notes
 */
export function mapRowToLocalCompany(row: Record<string, any>): LocalCompany | null {
  const companyCareer = findRowValue(row, ['Company career page', 'Company Career Page', 'Company', 'Company Name', 'Organization']);
  const localArea = findRowValue(row, ['Local area', 'Local Area', 'Area', 'Location', 'City']);

  if (!companyCareer && !localArea) return null;

  const whatToSearchFor = findRowValue(row, ["What I'd search for", "What Id search for", 'What To Search For', 'Search Terms', 'Keywords', 'Roles To Search']);
  const goodEntryLevelJobs = findRowValue(row, ['Good Entry-Level Jobs', 'Good Entry Level Jobs', 'Entry Level Jobs', 'Entry Level Roles', 'Entry Level']);
  const careerUrl = findRowValue(row, ['Career Page URL', 'Career URL', 'URL', 'Link', 'Careers Link']);
  const researchNotes = findRowValue(row, ['Notes', 'Research Notes', 'Comments', 'Details']);

  const rawCareer = String(companyCareer || '').trim();
  // Derive clean company name from "Company Careers" title if possible
  const cleanCompName = rawCareer.replace(/\s+Careers\b/i, '').replace(/\s+Jobs\b/i, '').trim() || rawCareer;

  return {
    id: uuidv4(),
    companyName: cleanCompName,
    careerPageTitle: rawCareer || `${cleanCompName} Careers`,
    careerPageUrl: careerUrl ? cleanRawUrl(String(careerUrl)) : '',
    localArea: localArea ? String(localArea).trim() : 'Des Moines Metro',
    whatToSearchFor: whatToSearchFor ? String(whatToSearchFor).trim() : '',
    goodEntryLevelJobs: goodEntryLevelJobs ? String(goodEntryLevelJobs).trim() : '',
    researchNotes: researchNotes ? String(researchNotes).trim() : '',
    createdAt: Date.now(),
  };
}

/**
 * Maps a single row object from "Remote Companies" to RemoteCompany.
 * Columns: Company name, Job types to watch, Priority, Reasons they fit my experience, Notes
 */
export function mapRowToRemoteCompany(row: Record<string, any>): RemoteCompany | null {
  const companyName = findRowValue(row, ['Company', 'Company Name', 'Employer', 'Organization', 'Company career page']);
  if (!companyName) return null;

  const jobTypes = findRowValue(row, ['Job types to watch', 'Job Types To Watch', 'Job Types', 'Roles To Watch', 'What to watch', 'Keywords']);
  const priorityRaw = findRowValue(row, ['Priority', 'Urgency', 'Rank']);
  const reasons = findRowValue(row, ['Reasons they fit my experience', 'Reasons They Fit My Experience', 'Why They Fit', 'Fit Reason', 'Match Reason', 'Notes']);
  const careerUrl = findRowValue(row, ['Career Page URL', 'Career URL', 'URL', 'Link', 'Careers Link']);
  const notes = findRowValue(row, ['Additional Notes', 'Notes', 'Comments']);

  let priority: 'High' | 'Medium' | 'Low' = 'Medium';
  if (priorityRaw) {
    const pStr = String(priorityRaw).toLowerCase();
    if (pStr.includes('high') || pStr === '1') priority = 'High';
    else if (pStr.includes('low') || pStr === '3') priority = 'Low';
  }

  return {
    id: uuidv4(),
    companyName: String(companyName).trim(),
    careerPageUrl: careerUrl ? cleanRawUrl(String(careerUrl)) : '',
    jobTypesToWatch: jobTypes ? String(jobTypes).trim() : '',
    priority,
    reasonsTheyFit: reasons ? String(reasons).trim() : '',
    notes: notes ? String(notes).trim() : '',
    createdAt: Date.now(),
  };
}

/**
 * Convert 2D Sheet values array ([ [colA, colB], [valA, valB] ]) to array of objects
 */
export function sheetValuesToRowObjects(values: any[][]): Record<string, any>[] {
  if (!values || values.length < 2) return [];
  const headers = values[0].map(h => String(h || '').trim());
  const rows: Record<string, any>[] = [];

  for (let r = 1; r < values.length; r++) {
    const rowData = values[r];
    if (!rowData || rowData.length === 0) continue;
    
    // Check if entire row is empty
    const hasData = rowData.some(v => v !== undefined && v !== null && String(v).trim() !== '');
    if (!hasData) continue;

    const rowObj: Record<string, any> = {};
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      if (header) {
        rowObj[header] = rowData[c] !== undefined ? rowData[c] : '';
      }
    }
    rows.push(rowObj);
  }

  return rows;
}

/**
 * Identifies worksheet category based on sheet name and headers
 */
export function detectWorksheetType(sheetName: string, headers: string[]): 'jobs' | 'local' | 'remote' {
  const normName = sheetName.toLowerCase();
  if (normName.includes('local') || normName.includes('tech compan') || normName.includes('iowa') || normName.includes('metro')) {
    return 'local';
  }
  if (normName.includes('remote') || normName.includes('distributed')) {
    return 'remote';
  }
  if (normName.includes('job') || normName.includes('appl') || normName.includes('tracker')) {
    return 'jobs';
  }

  // Header inspections
  const normHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  if (normHeaders.some(h => h.includes('localarea') || h.includes('whatidsearchfor') || h.includes('goodentrylevel'))) {
    return 'local';
  }
  if (normHeaders.some(h => h.includes('jobtypestowatch') || h.includes('reasonstheyfit'))) {
    return 'remote';
  }

  return 'jobs';
}

/**
 * Fetch all sheets and cell values directly from Google Sheets API v4 using authorized access token.
 */
export async function fetchGoogleSpreadsheetAllSheets(
  spreadsheetId: string, 
  customToken?: string
): Promise<{ 
  jobsRows: Record<string, any>[]; 
  localRows: Record<string, any>[]; 
  remoteRows: Record<string, any>[];
  sheetNamesFound: string[];
}> {
  const token = customToken || getAccessToken();
  if (!token) {
    throw new Error('Google OAuth token is unavailable. Please click "Sign in with Google" or grant spreadsheet permissions.');
  }

  // 1. Fetch metadata to discover sheet titles
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!metaRes.ok) {
    let errMsg = `Failed to connect to Google Sheets (HTTP ${metaRes.status})`;
    try {
      const errJson = await metaRes.json();
      if (errJson?.error?.message) {
        errMsg = errJson.error.message;
      }
    } catch (_) {}
    throw new Error(errMsg);
  }

  const metaData = await metaRes.json();
  const sheetsList: { properties: { title: string } }[] = metaData.sheets || [];
  if (sheetsList.length === 0) {
    throw new Error('No worksheets found in this Google Spreadsheet.');
  }

  const sheetNamesFound = sheetsList.map(s => s.properties.title);
  let jobsRows: Record<string, any>[] = [];
  let localRows: Record<string, any>[] = [];
  let remoteRows: Record<string, any>[] = [];

  // 2. Fetch cell values for each sheet
  for (const sheet of sheetsList) {
    const title = sheet.properties.title;
    const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(title)}?valueRenderOption=UNFORMATTED_VALUE`;
    
    try {
      const valRes = await fetch(valuesUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!valRes.ok) continue;

      const valData = await valRes.json();
      const rawValues = valData.values as any[][];
      if (!rawValues || rawValues.length < 2) continue;

      const headers = rawValues[0].map(h => String(h || ''));
      const rowObjs = sheetValuesToRowObjects(rawValues);
      const sheetType = detectWorksheetType(title, headers);

      if (sheetType === 'local') {
        localRows = [...localRows, ...rowObjs];
      } else if (sheetType === 'remote') {
        remoteRows = [...remoteRows, ...rowObjs];
      } else {
        jobsRows = [...jobsRows, ...rowObjs];
      }
    } catch (e) {
      console.warn(`Error fetching values for sheet ${title}:`, e);
    }
  }

  return {
    jobsRows,
    localRows,
    remoteRows,
    sheetNamesFound
  };
}

/**
 * Parses file buffer (.xlsx, .xls, .csv) across all sheets into organized data
 */
export function parseMultiSheetBuffer(buffer: ArrayBuffer | Uint8Array): {
  jobs: Partial<JobApplication>[];
  localCompanies: LocalCompany[];
  remoteCompanies: RemoteCompany[];
  sheetNamesFound: string[];
} {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetNamesFound = workbook.SheetNames || [];

  const jobs: Partial<JobApplication>[] = [];
  const localCompanies: LocalCompany[] = [];
  const remoteCompanies: RemoteCompany[] = [];

  for (const sheetName of sheetNamesFound) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;

    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (rawRows.length === 0) continue;

    const firstRowHeaders = Object.keys(rawRows[0] || {});
    const type = detectWorksheetType(sheetName, firstRowHeaders);

    for (const row of rawRows) {
      if (type === 'local') {
        const mapped = mapRowToLocalCompany(row);
        if (mapped) localCompanies.push(mapped);
      } else if (type === 'remote') {
        const mapped = mapRowToRemoteCompany(row);
        if (mapped) remoteCompanies.push(mapped);
      } else {
        const mapped = mapRowToJobApplication(row);
        if (mapped) jobs.push(mapped);
      }
    }
  }

  return {
    jobs,
    localCompanies,
    remoteCompanies,
    sheetNamesFound
  };
}

/**
 * Synchronizes and merges imported spreadsheet data with existing app data,
 * avoiding duplicates and capturing conflicting field changes for preview.
 */
export function mergeSpreadsheetData(
  existingJobs: JobApplication[],
  existingLocal: LocalCompany[],
  existingRemote: RemoteCompany[],
  importedData: {
    jobs: Partial<JobApplication>[];
    localCompanies: LocalCompany[];
    remoteCompanies: RemoteCompany[];
  },
  spreadsheetId?: string,
  spreadsheetUrl?: string
): MultiSheetSyncResult {
  const currentJobs = [...existingJobs];
  const currentLocal = [...existingLocal];
  const currentRemote = [...existingRemote];

  let addedJobsCount = 0;
  let updatedJobsCount = 0;
  let addedLocalCount = 0;
  let updatedLocalCount = 0;
  let addedRemoteCount = 0;
  let updatedRemoteCount = 0;

  const conflicts: JobConflictItem[] = [];

  // --- 1. Merge Job Applications ---
  for (const sheetJob of importedData.jobs) {
    if (!sheetJob.company && !sheetJob.position) continue;

    const sCompNorm = normalizeStr(sheetJob.company);
    const sPosNorm = normalizeStr(sheetJob.position);
    const sLinkClean = sheetJob.link ? cleanRawUrl(sheetJob.link).toLowerCase() : '';

    const matchIndex = currentJobs.findIndex(existing => {
      if (sLinkClean && existing.link) {
        if (cleanRawUrl(existing.link).toLowerCase() === sLinkClean) return true;
      }
      const eCompNorm = normalizeStr(existing.company);
      const ePosNorm = normalizeStr(existing.position);
      if (sCompNorm && eCompNorm && sPosNorm && ePosNorm) {
        return sCompNorm === eCompNorm && sPosNorm === ePosNorm;
      }
      return false;
    });

    if (matchIndex >= 0) {
      const existing = currentJobs[matchIndex];
      const diffs: JobConflictItem['differences'] = [];

      // Check fields for differences
      if (sheetJob.status && sheetJob.status !== existing.status) {
        diffs.push({ field: 'status', label: 'Status', appValue: existing.status, sheetValue: sheetJob.status });
      }
      if (sheetJob.dateApplied && sheetJob.dateApplied !== existing.dateApplied) {
        diffs.push({ field: 'dateApplied', label: 'Date Applied', appValue: existing.dateApplied, sheetValue: sheetJob.dateApplied });
      }
      if (sheetJob.notes && existing.notes && sheetJob.notes !== existing.notes && !existing.notes.includes(sheetJob.notes)) {
        diffs.push({ field: 'notes', label: 'Notes', appValue: existing.notes, sheetValue: sheetJob.notes });
      }
      if (sheetJob.coverLetterReady && sheetJob.coverLetterReady !== existing.coverLetterReady) {
        diffs.push({ field: 'coverLetterReady', label: 'Cover Letter Ready', appValue: existing.coverLetterReady || '', sheetValue: sheetJob.coverLetterReady });
      }
      if (sheetJob.coverLetterLink && sheetJob.coverLetterLink !== existing.coverLetterLink) {
        diffs.push({ field: 'coverLetterLink', label: 'Cover Letter Link', appValue: existing.coverLetterLink || '', sheetValue: sheetJob.coverLetterLink });
      }
      if (sheetJob.applicationStatusLink && sheetJob.applicationStatusLink !== existing.applicationStatusLink) {
        diffs.push({ field: 'applicationStatusLink', label: 'Status Link', appValue: existing.applicationStatusLink || '', sheetValue: sheetJob.applicationStatusLink });
      }
      if (sheetJob.jobClosesExpires && sheetJob.jobClosesExpires !== existing.jobClosesExpires) {
        diffs.push({ field: 'jobClosesExpires', label: 'Job Closes / Expires', appValue: existing.jobClosesExpires || '', sheetValue: sheetJob.jobClosesExpires });
      }

      if (diffs.length > 0) {
        conflicts.push({
          id: existing.id,
          type: 'job',
          identifier: `${existing.company} — ${existing.position}`,
          differences: diffs,
          appItem: existing,
          sheetItem: sheetJob,
        });
      }

      // Safe update: preserve existing user edits, append or update missing sheet fields
      const merged: JobApplication = {
        ...existing,
        company: sheetJob.company || existing.company,
        position: sheetJob.position || existing.position,
        status: (sheetJob.status as any) || existing.status,
        dateApplied: sheetJob.dateApplied !== undefined ? sheetJob.dateApplied : existing.dateApplied,
        location: sheetJob.location || existing.location,
        workplaceType: sheetJob.workplaceType || existing.workplaceType,
        employmentType: sheetJob.employmentType || existing.employmentType,
        pay: sheetJob.pay || existing.pay,
        priority: sheetJob.priority || existing.priority,
        coverLetterReady: sheetJob.coverLetterReady || existing.coverLetterReady,
        coverLetterLink: sheetJob.coverLetterLink || existing.coverLetterLink,
        applicationStatusLink: sheetJob.applicationStatusLink || existing.applicationStatusLink,
        jobClosesExpires: sheetJob.jobClosesExpires || existing.jobClosesExpires,
        link: sheetJob.link || existing.link,
        originalUrl: sheetJob.originalUrl || existing.originalUrl,
        notes: sheetJob.notes ? (existing.notes && existing.notes !== sheetJob.notes ? `${existing.notes}\n\n[Sheet Note]: ${sheetJob.notes}` : existing.notes || sheetJob.notes) : existing.notes,
        syncedFromSheetAt: Date.now(),
      };

      currentJobs[matchIndex] = merged;
      updatedJobsCount++;
    } else {
      // New Job
      const newJob: JobApplication = {
        id: uuidv4(),
        company: sheetJob.company || 'Unknown Company',
        position: sheetJob.position || 'Unknown Title',
        status: (sheetJob.status as any) || 'NOT COMPLETED',
        dateApplied: sheetJob.dateApplied || '',
        location: sheetJob.location || '',
        workplaceType: sheetJob.workplaceType || '',
        employmentType: sheetJob.employmentType || '',
        pay: sheetJob.pay || '',
        priority: sheetJob.priority || 'Medium',
        coverLetterReady: sheetJob.coverLetterReady || '',
        coverLetterLink: sheetJob.coverLetterLink || '',
        applicationStatusLink: sheetJob.applicationStatusLink || '',
        jobClosesExpires: sheetJob.jobClosesExpires || '',
        link: sheetJob.link || '',
        originalUrl: sheetJob.originalUrl || sheetJob.link || '',
        notes: sheetJob.notes || '',
        whyIMatch: sheetJob.whyIMatch || '',
        importantRequirements: sheetJob.importantRequirements || '',
        createdAt: Date.now(),
        syncedFromSheetAt: Date.now(),
      };

      currentJobs.unshift(newJob);
      addedJobsCount++;
    }
  }

  // --- 2. Merge Local Companies ---
  for (const sheetLocal of importedData.localCompanies) {
    const sNameNorm = normalizeStr(sheetLocal.companyName);
    if (!sNameNorm) continue;

    const matchIndex = currentLocal.findIndex(e => normalizeStr(e.companyName) === sNameNorm);
    if (matchIndex >= 0) {
      const existing = currentLocal[matchIndex];
      currentLocal[matchIndex] = {
        ...existing,
        careerPageTitle: sheetLocal.careerPageTitle || existing.careerPageTitle,
        careerPageUrl: sheetLocal.careerPageUrl || existing.careerPageUrl,
        localArea: sheetLocal.localArea || existing.localArea,
        whatToSearchFor: sheetLocal.whatToSearchFor || existing.whatToSearchFor,
        goodEntryLevelJobs: sheetLocal.goodEntryLevelJobs || existing.goodEntryLevelJobs,
        researchNotes: sheetLocal.researchNotes ? (existing.researchNotes ? `${existing.researchNotes}\n${sheetLocal.researchNotes}` : sheetLocal.researchNotes) : existing.researchNotes,
      };
      updatedLocalCount++;
    } else {
      currentLocal.push({
        ...sheetLocal,
        id: uuidv4(),
        createdAt: Date.now(),
      });
      addedLocalCount++;
    }
  }

  // --- 3. Merge Remote Companies ---
  for (const sheetRemote of importedData.remoteCompanies) {
    const sNameNorm = normalizeStr(sheetRemote.companyName);
    if (!sNameNorm) continue;

    const matchIndex = currentRemote.findIndex(e => normalizeStr(e.companyName) === sNameNorm);
    if (matchIndex >= 0) {
      const existing = currentRemote[matchIndex];
      currentRemote[matchIndex] = {
        ...existing,
        careerPageUrl: sheetRemote.careerPageUrl || existing.careerPageUrl,
        jobTypesToWatch: sheetRemote.jobTypesToWatch || existing.jobTypesToWatch,
        priority: sheetRemote.priority || existing.priority,
        reasonsTheyFit: sheetRemote.reasonsTheyFit || existing.reasonsTheyFit,
        notes: sheetRemote.notes || existing.notes,
      };
      updatedRemoteCount++;
    } else {
      currentRemote.push({
        ...sheetRemote,
        id: uuidv4(),
        createdAt: Date.now(),
      });
      addedRemoteCount++;
    }
  }

  const syncTimestamp = Date.now();
  const meta: JobSyncMeta = {
    spreadsheetId: spreadsheetId || '',
    spreadsheetUrl: spreadsheetUrl || '',
    lastSyncTimestamp: syncTimestamp,
    lastSyncFormatted: format(new Date(syncTimestamp), 'MMM d, yyyy, h:mm a'),
    totalSyncedJobs: currentJobs.length,
    totalSyncedLocal: currentLocal.length,
    totalSyncedRemote: currentRemote.length,
  };

  return {
    mergedJobs: currentJobs,
    mergedLocalCompanies: currentLocal,
    mergedRemoteCompanies: currentRemote,
    addedJobsCount,
    updatedJobsCount,
    addedLocalCount,
    updatedLocalCount,
    addedRemoteCount,
    updatedRemoteCount,
    conflicts,
    meta,
  };
}

/**
 * Downloads a complete 3-worksheet template Excel file (.xlsx)
 * matching the user's exact structure for:
 * 1. Jobs I Want to Apply For
 * 2. Local Tech Companies
 * 3. Remote Companies
 */
export function downloadCompleteJobTrackerExcel() {
  const wb = XLSX.utils.book_new();

  // 1. Jobs I Want to Apply For
  const sampleJobs = [
    {
      'Status': 'Applied',
      'Date Applied': '2026-09-28',
      'Company': 'RFA Engineering',
      'Job Position': 'Entry Level Software Engineer',
      'Location': 'Urbandale, IA',
      'Cover Letter Ready?': 'Ready',
      'Cover Letter Link': 'https://docs.google.com/document/d/sample-rfa-cover-letter',
      'Notes': 'Interview prep focused on embedded C++ and vision algorithms. Contacted recruiter via career fair.',
      'Application Status Link': 'https://rfaengineering.com/portal/status/1042',
      'Job Closes / Expires': '2026-10-31'
    },
    {
      'Status': 'NOT COMPLETED',
      'Date Applied': '',
      'Company': 'Workiva',
      'Job Position': 'Associate Software Engineer - Frontend',
      'Location': 'Ames, IA',
      'Cover Letter Ready?': 'In Progress',
      'Cover Letter Link': 'https://docs.google.com/document/d/sample-workiva-cover-letter',
      'Notes': 'Highlight React, TypeScript, and state management experience.',
      'Application Status Link': '',
      'Job Closes / Expires': '2026-10-25'
    },
    {
      'Status': 'NOT COMPLETED',
      'Date Applied': '',
      'Company': 'GitHub',
      'Job Position': 'Junior Frontend Engineer',
      'Location': 'Remote',
      'Cover Letter Ready?': 'Needed',
      'Cover Letter Link': '',
      'Notes': 'Distributed role. Need to link Huntrr Space and open source repos.',
      'Application Status Link': '',
      'Job Closes / Expires': '2026-11-15'
    }
  ];
  const wsJobs = XLSX.utils.json_to_sheet(sampleJobs);
  XLSX.utils.book_append_sheet(wb, wsJobs, 'Jobs I Want to Apply For');

  // 2. Local Tech Companies
  const localRows = INITIAL_LOCAL_COMPANIES.slice(0, 10).map(c => ({
    'Company career page': c.careerPageTitle || `${c.companyName} Careers`,
    'Local area': c.localArea,
    "What I'd search for": c.whatToSearchFor,
    'Good Entry-Level Jobs': c.goodEntryLevelJobs || '',
    'Notes': c.researchNotes || ''
  }));
  const wsLocal = XLSX.utils.json_to_sheet(localRows);
  XLSX.utils.book_append_sheet(wb, wsLocal, 'Local Tech Companies');

  // 3. Remote Companies
  const remoteRows = INITIAL_REMOTE_COMPANIES.map(r => ({
    'Company': r.companyName,
    'Job types to watch': r.jobTypesToWatch,
    'Priority': r.priority,
    'Reasons they fit my experience': r.reasonsTheyFit,
    'Career Link': r.careerPageUrl || '',
    'Notes': r.notes || ''
  }));
  const wsRemote = XLSX.utils.json_to_sheet(remoteRows);
  XLSX.utils.book_append_sheet(wb, wsRemote, 'Remote Companies');

  XLSX.writeFile(wb, 'Huntrr_Space_Job_Tracker_Complete.xlsx');
}
