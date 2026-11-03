import { JobApplication } from '../components/JobApplicationsView';

/**
 * Trims spaces, invisible characters (zero-width spaces, non-breaking spaces, BOMs),
 * newlines, and enclosing quotes/brackets.
 */
export function cleanRawUrl(input: string): string {
  if (!input) return '';
  return input
    // Remove zero-width spaces, BOM, non-breaking spaces, control characters
    .replace(/[\u200B-\u200D\uFEFF\u00A0\r\n\t]/g, ' ')
    .trim()
    // Strip leading/trailing quotes or angle brackets
    .replace(/^["'<(\[]+|["'>)\]]+$/g, '')
    .trim();
}

/**
 * Extracts a standalone URL from any pasted text (including mobile share messages like
 * "Entry Level Software Engineer This job was found using ZipRecruiter Job Search https://...")
 */
export function extractEmbeddedUrlAndHints(rawInput: string): {
  extractedUrl: string;
  titleHint?: string;
  companyHint?: string;
  sourceHint?: string;
} {
  const cleaned = cleanRawUrl(rawInput);
  if (!cleaned) return { extractedUrl: '' };

  // 1. Look for explicit http/https URL in text
  const urlRegex = /(https?:\/\/[^\s"'<>\(\)\[\]]+)/i;
  const match = cleaned.match(urlRegex);

  let extractedUrl = '';
  let surroundingText = '';

  if (match) {
    extractedUrl = match[1].replace(/[.,;:)]+$/, ''); // Strip trailing punctuation
    surroundingText = cleaned.replace(match[0], '').trim();
  } else {
    // 2. Look for domain-like URLs without protocol (e.g. www.indeed.com/viewjob?... or greenhouse.io/...)
    const domainRegex = /((?:www\.|[a-zA-Z0-9-]+\.)(?:indeed|linkedin|ziprecruiter|greenhouse|lever|workday|ashbyhq|glassdoor|google|monster|smartrecruiters|handshake|joinhandshake)\.[a-zA-Z0-9-.\/=?&%#_]+)/i;
    const domainMatch = cleaned.match(domainRegex);
    if (domainMatch) {
      extractedUrl = `https://${domainMatch[1].replace(/[.,;:)]+$/, '')}`;
      surroundingText = cleaned.replace(domainMatch[0], '').trim();
    } else {
      // General domain pattern
      const generalDomainRegex = /([a-zA-Z0-9-]+\.[a-zA-Z]{2,6}(?:\/[^\s"'<>\(\)\[\]]*)?)/i;
      const genMatch = cleaned.match(generalDomainRegex);
      if (genMatch && !cleaned.includes(' ')) {
        extractedUrl = `https://${genMatch[1]}`;
      } else {
        extractedUrl = cleaned;
      }
    }
  }

  // 3. Extract title and company hints from surrounding text (e.g. "Entry Level Software Engineer This job was found using ZipRecruiter Job Search")
  let titleHint: string | undefined;
  let companyHint: string | undefined;
  let sourceHint: string | undefined;

  if (surroundingText) {
    let cleanText = surroundingText
      .replace(/This job was found using [^.\n\r]*/gi, '')
      .replace(/Check out this job (on [^:\n\r]+)?:?/gi, '')
      .replace(/View this job on [^:\n\r]+:?/gi, '')
      .replace(/I found this job on [^:\n\r]+:?/gi, '')
      .replace(/Shared via [^:\n\r]+/gi, '')
      .replace(/See this and similar jobs on [^:\n\r]+/gi, '')
      .replace(/Job Search/gi, '')
      .replace(/\|\s*[^|]+$/g, '')
      .trim();

    if (cleanText.includes(' at ')) {
      const parts = cleanText.split(/\s+at\s+/i);
      titleHint = parts[0]?.trim();
      companyHint = parts[1]?.trim();
    } else if (cleanText.includes(' - ')) {
      const parts = cleanText.split(/\s+-\s+/);
      titleHint = parts[0]?.trim();
      if (parts[1]) companyHint = parts[1]?.trim();
    } else if (cleanText.length > 2 && cleanText.length < 100) {
      titleHint = cleanText;
    }
  }

  return {
    extractedUrl: extractedUrl || cleaned,
    titleHint: titleHint || undefined,
    companyHint: companyHint || undefined,
    sourceHint: sourceHint || undefined,
  };
}

export interface NormalizedUrlResult {
  rawInput: string;
  normalizedUrl: string;
  cleanCanonicalUrl: string;
  jobId?: string;
  source?: string;
  isIndeed: boolean;
  isLinkedIn: boolean;
  isZipRecruiter: boolean;
  isValidStructure: boolean;
  titleHint?: string;
  companyHint?: string;
  warning?: string;
}

/**
 * Removes tracking parameters (utm_*, fbclid, gclid, trk, etc.) while
 * strictly preserving essential parameters like Indeed's `jk`, LinkedIn's `currentJobId`,
 * ZipRecruiter's `match_token`, and ATS IDs (gh_jid, jobId, reqId, etc.).
 */
export function cleanTrackingParams(urlString: string): string {
  try {
    let clean = cleanRawUrl(urlString);
    if (!clean) return '';

    // If string has spaces or other text, extract URL first
    const extracted = extractEmbeddedUrlAndHints(clean);
    clean = extracted.extractedUrl || clean;

    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+/i.test(clean)) {
        clean = `https://${clean}`;
      } else {
        return clean;
      }
    }
    const parsed = new URL(clean);
    const trackingParams = new Set([
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
      'fbclid', 'gclid', 'gclsrc', 'dclid', 'wbraid', 'gbraid', 'msclkid', 'twclid',
      'igshid', 'mc_cid', 'mc_eid', '_hsenc', '_hsmi', '_openstat', 'vero_id',
      'refid', 'trackingid', 'trk', 'trkinfo', 'midtoken', 'trk_contact', 'li_fat_id',
      'originalsubdomain', 'from', 'vjs'
    ]);
    
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (trackingParams.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    }
    
    if (parsed.hash && /^(#_=_|#xtor=.*|#utm_.*)/i.test(parsed.hash)) {
      parsed.hash = '';
    }

    return parsed.toString();
  } catch (_) {
    return urlString;
  }
}

/**
 * Parses and normalizes any job listing URL or partial link, with special support
 * for Indeed, LinkedIn, ZipRecruiter, and ATS platforms.
 */
export function normalizeJobUrl(raw: string): NormalizedUrlResult {
  const { extractedUrl, titleHint, companyHint } = extractEmbeddedUrlAndHints(raw);
  const cleaned = cleanRawUrl(extractedUrl);

  if (!cleaned) {
    return {
      rawInput: raw,
      normalizedUrl: '',
      cleanCanonicalUrl: '',
      isIndeed: false,
      isLinkedIn: false,
      isZipRecruiter: false,
      isValidStructure: false,
    };
  }

  // 1. Extract Indeed job ID (jk parameter or trailing hash/id)
  let indeedJobId: string | undefined;

  const jkParamMatch = cleaned.match(/[?&#]jk=([a-zA-Z0-9_-]+)/i) || cleaned.match(/^jk=([a-zA-Z0-9_-]+)/i);
  if (jkParamMatch) {
    indeedJobId = jkParamMatch[1];
  }

  const isIndeedDomain = /indeed\.(com|[a-z]{2,3}(\.[a-z]{2})?)/i.test(cleaned);
  const isIndeedPartial = /^(\/)?(m\/)?viewjob\?/i.test(cleaned) || /^(\/)?rc\/clk\?/i.test(cleaned) || cleaned.startsWith('viewjob') || cleaned.startsWith('/viewjob');

  if (isIndeedDomain && !indeedJobId) {
    const slugMatch = cleaned.match(/\/job\/[^?#]*-([a-zA-Z0-9]{10,24})/i);
    if (slugMatch) {
      indeedJobId = slugMatch[1];
    }
  }

  if (indeedJobId || isIndeedDomain || isIndeedPartial) {
    const finalJobId = indeedJobId || (cleaned.match(/[a-zA-Z0-9]{16}/)?.[0]);
    const canonical = finalJobId 
      ? `https://www.indeed.com/viewjob?jk=${finalJobId}` 
      : (cleaned.startsWith('http') ? cleanTrackingParams(cleaned) : `https://${cleaned.replace(/^\/+/, '')}`);

    return {
      rawInput: raw,
      normalizedUrl: canonical,
      cleanCanonicalUrl: canonical,
      jobId: finalJobId,
      source: 'Indeed',
      isIndeed: true,
      isLinkedIn: false,
      isZipRecruiter: false,
      isValidStructure: true,
      titleHint,
      companyHint,
    };
  }

  // 2. Check for LinkedIn
  const isLinkedInDomain = /linkedin\.com/i.test(cleaned);
  if (isLinkedInDomain) {
    let linkedinUrl = cleaned;
    if (!linkedinUrl.startsWith('http://') && !linkedinUrl.startsWith('https://')) {
      linkedinUrl = `https://${linkedinUrl}`;
    }
    let liJobId: string | undefined;
    const viewMatch = linkedinUrl.match(/\/jobs\/view\/(\d+)/i);
    if (viewMatch) {
      liJobId = viewMatch[1];
    } else {
      const paramMatch = linkedinUrl.match(/[?&]currentJobId=(\d+)/i);
      if (paramMatch) {
        liJobId = paramMatch[1];
      }
    }

    const canonical = liJobId 
      ? `https://www.linkedin.com/jobs/view/${liJobId}/` 
      : cleanTrackingParams(linkedinUrl);

    return {
      rawInput: raw,
      normalizedUrl: linkedinUrl,
      cleanCanonicalUrl: canonical,
      jobId: liJobId,
      source: 'LinkedIn',
      isIndeed: false,
      isLinkedIn: true,
      isZipRecruiter: false,
      isValidStructure: true,
      titleHint,
      companyHint,
    };
  }

  // 3. Check for ZipRecruiter
  const isZipRecruiterDomain = /ziprecruiter\.com/i.test(cleaned);
  if (isZipRecruiterDomain) {
    let zipUrl = cleaned;
    if (!zipUrl.startsWith('http://') && !zipUrl.startsWith('https://')) {
      zipUrl = `https://${zipUrl}`;
    }
    const cleanCanonical = cleanTrackingParams(zipUrl);

    return {
      rawInput: raw,
      normalizedUrl: zipUrl,
      cleanCanonicalUrl: cleanCanonical,
      source: 'ZipRecruiter',
      isIndeed: false,
      isLinkedIn: false,
      isZipRecruiter: true,
      isValidStructure: true,
      titleHint,
      companyHint,
    };
  }

  // 4. General URLs (Greenhouse, Lever, Workday, Company websites)
  let standardUrl = cleaned;
  if (!standardUrl.startsWith('http://') && !standardUrl.startsWith('https://')) {
    if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+/i.test(standardUrl)) {
      standardUrl = `https://${standardUrl}`;
    }
  }

  let sourceName = '';
  try {
    const cleanedUrlWithParams = cleanTrackingParams(standardUrl);
    const parsed = new URL(cleanedUrlWithParams);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (hostname.includes('greenhouse.io')) sourceName = 'Greenhouse';
    else if (hostname.includes('lever.co')) sourceName = 'Lever';
    else if (hostname.includes('workday.com') || hostname.includes('myworkdayjobs.com')) sourceName = 'Workday';
    else if (hostname.includes('ashbyhq.com')) sourceName = 'Ashby';
    else if (hostname.includes('smartrecruiters.com')) sourceName = 'SmartRecruiters';
    else if (hostname.includes('glassdoor.com')) sourceName = 'Glassdoor';
    else if (hostname.includes('monster.com')) sourceName = 'Monster';
    else if (hostname.includes('joinhandshake.com') || hostname.includes('handshake.com')) sourceName = 'Handshake';
    else if (hostname.includes('dice.com')) sourceName = 'Dice';
    else if (hostname.includes('builtin.com')) sourceName = 'BuiltIn';
    else if (hostname.includes('google.com') && hostname.includes('careers')) sourceName = 'Google';
    else {
      const domainParts = hostname.split('.');
      if (domainParts.length >= 2) {
        const root = domainParts[domainParts.length - 2];
        sourceName = root.charAt(0).toUpperCase() + root.slice(1);
      }
    }

    return {
      rawInput: raw,
      normalizedUrl: standardUrl,
      cleanCanonicalUrl: cleanedUrlWithParams,
      source: sourceName,
      isIndeed: false,
      isLinkedIn: false,
      isZipRecruiter: false,
      isValidStructure: true,
      titleHint,
      companyHint,
    };
  } catch (_) {
    return {
      rawInput: raw,
      normalizedUrl: standardUrl,
      cleanCanonicalUrl: standardUrl,
      source: '',
      isIndeed: false,
      isLinkedIn: false,
      isZipRecruiter: false,
      isValidStructure: false,
      titleHint,
      companyHint,
      warning: 'Link may not be a standard web address, but will still be saved.'
    };
  }
}

/**
 * Checks for duplicate job applications by comparing:
 * 1. Normalized Indeed / LinkedIn Job ID
 * 2. Normalized Canonical URLs
 * 3. Exact matching Company + Position (case-insensitive)
 */
export function findDuplicateJob(
  newJob: Partial<JobApplication>,
  existingJobs: JobApplication[],
  currentEditingId?: string | null
): JobApplication | null {
  if (!existingJobs || existingJobs.length === 0) return null;

  const newCompany = (newJob.company || '').trim().toLowerCase();
  const newPosition = (newJob.position || '').trim().toLowerCase();
  const newJobId = (newJob.jobId || '').trim().toLowerCase();
  
  const normNewLink = newJob.link ? normalizeJobUrl(newJob.link).cleanCanonicalUrl.toLowerCase() : '';
  const normNewOrig = newJob.originalUrl ? normalizeJobUrl(newJob.originalUrl).cleanCanonicalUrl.toLowerCase() : '';

  for (const existing of existingJobs) {
    if (currentEditingId && existing.id === currentEditingId) {
      continue;
    }

    // 1. Check Job ID match (strongest match)
    if (newJobId && existing.jobId && existing.jobId.trim().toLowerCase() === newJobId) {
      return existing;
    }

    // 2. Check Canonical URL match
    if (normNewLink || normNewOrig) {
      const existingLinkNorm = existing.link ? normalizeJobUrl(existing.link).cleanCanonicalUrl.toLowerCase() : '';
      const existingOrigNorm = existing.originalUrl ? normalizeJobUrl(existing.originalUrl).cleanCanonicalUrl.toLowerCase() : '';

      if (normNewLink && existingLinkNorm && normNewLink === existingLinkNorm) return existing;
      if (normNewOrig && existingOrigNorm && normNewOrig === existingOrigNorm) return existing;
      if (normNewLink && existingOrigNorm && normNewLink === existingOrigNorm) return existing;
      if (normNewOrig && existingLinkNorm && normNewOrig === existingLinkNorm) return existing;
    }

    // 3. Check Company + Position match
    if (newCompany && newPosition) {
      const existComp = (existing.company || '').trim().toLowerCase();
      const existPos = (existing.position || '').trim().toLowerCase();
      if (newCompany === existComp && newPosition === existPos) {
        return existing;
      }
    }
  }

  return null;
}
