import { safeRemoteFetch } from './safeRemote';
/**
 * Server-side Job Extraction Utilities for Indeed, LinkedIn, Career Portals, and Raw Text
 * Features:
 * - Resilient server-side HTTP fetch with multi-header fallbacks (browser & crawler user-agents)
 * - Full redirect following
 * - application/ld+json JobPosting schema extraction
 * - OpenGraph & standard metadata extraction
 * - Visible text & script state parsing
 * - Gemini AI (gemini-3.7-flash) structured job parsing for URL text & pasted descriptions
 * - URL cleaning with tracking parameter stripping while preserving required IDs (Indeed jk, etc.)
 */

import { GoogleGenAI } from '@google/genai';
import { cleanRawUrl, cleanTrackingParams, normalizeJobUrl } from './jobUrlUtils';

export interface ExtractedJobData {
  success: boolean;
  partial?: boolean;
  blocked?: boolean;
  jobTitle?: string;
  position?: string;
  companyName?: string;
  company?: string;
  location?: string;
  workplaceType?: string; // 'Remote' | 'Hybrid' | 'On-site' | ''
  employmentType?: string; // 'Full-time' | 'Part-time' | 'Contract' | 'Temporary' | 'Internship' | ''
  salaryMin?: string;
  salaryMax?: string;
  salaryPeriod?: string; // 'Yearly' | 'Monthly' | 'Hourly' | 'Weekly' | 'Daily'
  shortSummary?: string;
  responsibilities?: string[];
  requiredQualifications?: string[];
  preferredQualifications?: string[];
  datePosted?: string;
  applicationDeadline?: string;
  source?: string;
  originalUrl?: string;
  link?: string;
  jobId?: string;
  warning?: string;
  errorDetails?: string;
}

let genAIClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !process.env.GEMINI_MODEL) return null;
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return genAIClient;
}

function cleanString(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
    .trim();
}

function stripHtml(html?: string | null): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function normalizeEmploymentType(type?: string): string {
  if (!type) return '';
  const upper = type.toUpperCase();
  if (upper.includes('FULL_TIME') || upper.includes('FULL TIME') || upper === 'FULLTIME') return 'Full-time';
  if (upper.includes('PART_TIME') || upper.includes('PART TIME') || upper === 'PARTTIME') return 'Part-time';
  if (upper.includes('CONTRACT') || upper.includes('CONTRACTOR')) return 'Contract';
  if (upper.includes('TEMPORARY') || upper.includes('TEMP')) return 'Temporary';
  if (upper.includes('INTERN')) return 'Internship';
  return cleanString(type);
}

function normalizeSalaryPeriod(period?: string): string {
  if (!period) return '';
  const upper = period.toUpperCase();
  if (upper.includes('YEAR') || upper === 'ANNUAL' || upper === 'ANNUALLY') return 'Yearly';
  if (upper.includes('MONTH')) return 'Monthly';
  if (upper.includes('HOUR')) return 'Hourly';
  if (upper.includes('WEEK')) return 'Weekly';
  if (upper.includes('DAY')) return 'Daily';
  return cleanString(period);
}

function normalizeWorkplaceType(type?: string, description?: string): string {
  if (type) {
    const upper = type.toUpperCase();
    if (upper.includes('REMOTE') || upper.includes('TELECOMMUTE')) return 'Remote';
    if (upper.includes('HYBRID')) return 'Hybrid';
    if (upper.includes('ON_SITE') || upper.includes('ONSITE') || upper.includes('IN_PERSON') || upper.includes('IN PERSON')) return 'On-site';
  }
  if (description) {
    if (/\b(remote|telecommute|work from home|wfh|anywhere)\b/i.test(description)) return 'Remote';
    if (/\b(hybrid|flexible location)\b/i.test(description)) return 'Hybrid';
    if (/\b(on-site|in-office|onsite)\b/i.test(description)) return 'On-site';
  }
  return '';
}

/**
 * Extracts structured job data from raw text or job description using Gemini AI
 */
export async function extractJobDataFromText(rawText: string, originalUrl?: string): Promise<ExtractedJobData> {
  const cleanedText = rawText.trim();
  if (!cleanedText) {
    return {
      success: false,
      warning: 'Please paste a job description to extract details.',
    };
  }

  const ai = getGeminiClient();
  if (ai) {
    try {
      const prompt = `You are an expert job posting analyzer. Extract structured job application details from the following job description text.

Return ONLY a valid JSON object with the following fields:
{
  "position": "Job Title or Role",
  "company": "Company or Organization name",
  "location": "City, State, Country or Remote",
  "workplaceType": "Remote" or "Hybrid" or "On-site" or "",
  "employmentType": "Full-time" or "Part-time" or "Contract" or "Temporary" or "Internship" or "",
  "salaryMin": "number or clean string without currency sign e.g. 80000",
  "salaryMax": "number or clean string without currency sign e.g. 120000",
  "salaryPeriod": "Yearly" or "Monthly" or "Hourly" or "Weekly" or "Daily" or "",
  "shortSummary": "A concise 2-3 sentence overview of the role and team",
  "responsibilities": ["bullet 1", "bullet 2", ...],
  "requiredQualifications": ["bullet 1", "bullet 2", ...],
  "preferredQualifications": ["bullet 1", "bullet 2", ...],
  "datePosted": "YYYY-MM-DD or empty string"
}

If any field is not found in the text, use empty string "" or empty array [].

Job Text:
"""
${cleanedText.slice(0, 15000)}
"""`;

      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL!,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      const pos = cleanString(parsed.position || parsed.jobTitle);
      const comp = cleanString(parsed.company || parsed.companyName);

      if (pos || comp) {
        return {
          success: true,
          position: pos || undefined,
          jobTitle: pos || undefined,
          company: comp || undefined,
          companyName: comp || undefined,
          location: cleanString(parsed.location) || undefined,
          workplaceType: normalizeWorkplaceType(parsed.workplaceType, cleanedText) || undefined,
          employmentType: normalizeEmploymentType(parsed.employmentType) || undefined,
          salaryMin: parsed.salaryMin ? String(parsed.salaryMin).replace(/[^0-9.]/g, '') : undefined,
          salaryMax: parsed.salaryMax ? String(parsed.salaryMax).replace(/[^0-9.]/g, '') : undefined,
          salaryPeriod: normalizeSalaryPeriod(parsed.salaryPeriod) || undefined,
          shortSummary: cleanString(parsed.shortSummary) || undefined,
          responsibilities: Array.isArray(parsed.responsibilities) ? parsed.responsibilities.map(cleanString).filter(Boolean) : undefined,
          requiredQualifications: Array.isArray(parsed.requiredQualifications) ? parsed.requiredQualifications.map(cleanString).filter(Boolean) : undefined,
          preferredQualifications: Array.isArray(parsed.preferredQualifications) ? parsed.preferredQualifications.map(cleanString).filter(Boolean) : undefined,
          datePosted: parsed.datePosted ? cleanString(parsed.datePosted).substring(0, 10) : undefined,
          originalUrl: originalUrl || undefined,
          link: originalUrl || undefined,
        };
      }
    } catch (aiErr) {
      console.error('[JobExtractor] Gemini text extraction error:', aiErr);
    }
  }

  // Fallback Rule-Based Text Parsing
  return parseJobTextWithRules(cleanedText, originalUrl);
}

function parseJobTextWithRules(text: string, originalUrl?: string): ExtractedJobData {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let position = '';
  let company = '';
  let location = '';
  let workplaceType = normalizeWorkplaceType('', text);
  let salaryMin = '';
  let salaryMax = '';
  let salaryPeriod = '';

  // Look for title / company patterns at beginning
  if (lines.length > 0) {
    const firstLine = lines[0];
    if (firstLine.includes(' at ')) {
      const parts = firstLine.split(' at ');
      position = parts[0].trim();
      company = parts[1].trim();
    } else if (firstLine.includes(' - ')) {
      const parts = firstLine.split(' - ');
      position = parts[0].trim();
      company = parts[1].trim();
    } else {
      position = firstLine;
      if (lines.length > 1 && lines[1].length < 60) {
        company = lines[1];
      }
    }
  }

  // Salary search
  const salaryMatch = text.match(/\$([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)\s*(?:-|to)\s*\$?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)\s*(?:a|per|\/)?\s*(year|yr|hour|hr|month|mo|annual|annually)?/i) ||
                      text.match(/\$([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)\s*(?:a|per|\/)?\s*(year|yr|hour|hr|month|mo|annual|annually)/i);
  if (salaryMatch) {
    salaryMin = salaryMatch[1].replace(/,/g, '');
    if (salaryMatch[2] && !/year|yr|hour|hr|month|mo|annual/i.test(salaryMatch[2])) {
      salaryMax = salaryMatch[2].replace(/,/g, '');
      salaryPeriod = normalizeSalaryPeriod(salaryMatch[3] || 'Yearly');
    } else {
      salaryPeriod = normalizeSalaryPeriod(salaryMatch[2] || salaryMatch[3] || 'Yearly');
    }
  }

  const responsibilities: string[] = [];
  const requiredQualifications: string[] = [];
  let currentSection: 'resp' | 'qual' | null = null;

  for (const line of lines) {
    if (/responsibilit|duties|what you will do|what you'll do|day to day/i.test(line)) {
      currentSection = 'resp';
      continue;
    }
    if (/qualificat|requirement|what you bring|what you need|skills/i.test(line)) {
      currentSection = 'qual';
      continue;
    }
    if (/benefit|compensation|about us|company overview|equal opportunity/i.test(line)) {
      currentSection = null;
      continue;
    }

    if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
      const cleanBullet = line.replace(/^[•\-\*]\s*/, '').trim();
      if (cleanBullet.length > 5) {
        if (currentSection === 'resp' && responsibilities.length < 15) {
          responsibilities.push(cleanBullet);
        } else if (currentSection === 'qual' && requiredQualifications.length < 15) {
          requiredQualifications.push(cleanBullet);
        }
      }
    }
  }

  return {
    success: Boolean(position || company),
    position: position || undefined,
    jobTitle: position || undefined,
    company: company || undefined,
    companyName: company || undefined,
    location: location || undefined,
    workplaceType: workplaceType || undefined,
    salaryMin: salaryMin || undefined,
    salaryMax: salaryMax || undefined,
    salaryPeriod: salaryPeriod || undefined,
    shortSummary: lines.slice(0, 3).join('\n'),
    responsibilities: responsibilities.length > 0 ? responsibilities : undefined,
    requiredQualifications: requiredQualifications.length > 0 ? requiredQualifications : undefined,
    originalUrl: originalUrl || undefined,
    link: originalUrl || undefined,
  };
}

/**
 * Robust server-side URL fetcher that follows redirects and tries browser & crawler headers
 */
async function fetchPageHtmlWithFallbacks(rawTargetUrl: string): Promise<{ html: string; status: number; finalUrl: string; error?: string }> {
  // Ensure targetUrl is a valid URL
  let targetUrl = rawTargetUrl.trim();
  try {
    new URL(targetUrl);
  } catch (_) {
    const extracted = normalizeJobUrl(targetUrl);
    targetUrl = extracted.normalizedUrl;
    try {
      new URL(targetUrl);
    } catch (e: any) {
      return { html: '', status: 0, finalUrl: targetUrl, error: `Invalid URL format: ${targetUrl}` };
    }
  }

  // Strategy 1: Social Preview Crawlers (Facebook, Twitter/X, Slack, LinkedIn)
  // Many job boards like ZipRecruiter, LinkedIn, and Indeed whitelist these to generate rich link cards
  const socialHeaders = {
    'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  const twitterHeaders = {
    'User-Agent': 'Twitterbot/1.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  const slackHeaders = {
    'User-Agent': 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };

  // Strategy 2: Mobile Safari UA (often bypasses aggressive desktop Cloudflare challenges)
  const mobileSafariHeaders = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  // Strategy 3: Desktop Chrome Browser headers
  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Ch-Ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  };

  // Strategy 4: Googlebot
  const crawlerHeaders = {
    'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.8',
  };

  const headerStrategies = [socialHeaders, twitterHeaders, slackHeaders, mobileSafariHeaders, browserHeaders, crawlerHeaders];

  let lastStatus = 0;
  let lastError = '';

  for (let i = 0; i < headerStrategies.length; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await safeRemoteFetch(targetUrl, {
        headers: headerStrategies[i],
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeout);
      lastStatus = response.status;

      if (response.ok) {
        let text = await response.text();
        let finalUrl = response.url || targetUrl;

        // Check for meta refresh or client redirect
        const metaRefreshMatch = text.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][0-9]+;\s*url=([^"']+)["']/i);
        if (metaRefreshMatch && metaRefreshMatch[1]) {
          let redirectUrl = metaRefreshMatch[1].trim();
          if (redirectUrl.startsWith('/')) {
            const parsed = new URL(finalUrl);
            redirectUrl = `${parsed.origin}${redirectUrl}`;
          }
          try {
            const redController = new AbortController();
            const redTimeout = setTimeout(() => redController.abort(), 6000);
            const redRes = await safeRemoteFetch(redirectUrl, {
              headers: headerStrategies[0],
              signal: redController.signal,
              redirect: 'follow'
            });
            clearTimeout(redTimeout);
            if (redRes.ok) {
              const redText = await redRes.text();
              if (redText && redText.length > 200) {
                text = redText;
                finalUrl = redRes.url || redirectUrl;
              }
            }
          } catch (_) {}
        }

        if (text && text.length > 200) {
          return { html: text, status: response.status, finalUrl };
        }
      } else {
        lastError = `HTTP ${response.status} ${response.statusText}`;
      }
    } catch (e: any) {
      lastError = e?.message || String(e);
    }
  }

  return { html: '', status: lastStatus, finalUrl: targetUrl, error: lastError };
}

/**
 * Main URL Extraction function
 */
export async function extractJobDataFromUrl(rawUrl: string, allowAI = false): Promise<ExtractedJobData> {
  const norm = normalizeJobUrl(rawUrl);
  const targetUrl = norm.normalizedUrl || cleanRawUrl(rawUrl);
  const canonicalLink = norm.cleanCanonicalUrl || cleanTrackingParams(targetUrl);
  const detectedSource = norm.source || '';
  const detectedJobId = norm.jobId;
  const titleHint = norm.titleHint;
  const companyHint = norm.companyHint;

  if (!targetUrl) {
    return {
      success: false,
      warning: 'Please provide a valid job URL.',
    };
  }

  const baseFallbackResult: ExtractedJobData = {
    success: Boolean(titleHint || companyHint),
    partial: Boolean(titleHint && !companyHint),
    position: titleHint || undefined,
    jobTitle: titleHint || undefined,
    company: companyHint || undefined,
    companyName: companyHint || undefined,
    originalUrl: canonicalLink,
    link: canonicalLink,
    source: detectedSource,
    jobId: detectedJobId,
  };

  console.log(`[JobExtractor] Fetching job details for: ${targetUrl}`);

  // Fetch HTML with fallback strategies
  const fetchResult = await fetchPageHtmlWithFallbacks(targetUrl);
  const html = fetchResult.html;

  if (!html) {
    console.log(`[JobExtractor] Remote site returned status ${fetchResult.status} (${fetchResult.error || 'Blocked'}). Using available hints or manual entry.`);
    return {
      ...baseFallbackResult,
      success: Boolean(titleHint || companyHint),
      partial: Boolean(titleHint || companyHint),
      blocked: !titleHint && !companyHint,
      warning: titleHint
        ? 'Retrieved job title from link. Please confirm details and fill in any missing information.'
        : 'This website blocked automatic importing. You can still add the application manually.',
      errorDetails: fetchResult.error || `HTTP Status: ${fetchResult.status}`,
    };
  }

  // 1. JSON-LD JobPosting Extraction
  let extractedJob: Partial<ExtractedJobData> = {};
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] ? parsed['@graph'] : [parsed]);

      for (const item of items) {
        if (item['@type'] === 'JobPosting' || (Array.isArray(item['@type']) && item['@type'].includes('JobPosting'))) {
          const jobTitle = cleanString(item.title || item.name);
          const companyName = cleanString(
            typeof item.hiringOrganization === 'string'
              ? item.hiringOrganization
              : (item.hiringOrganization?.name || item.publisher?.name)
          );

          let locationStr = '';
          if (item.jobLocation) {
            const loc = Array.isArray(item.jobLocation) ? item.jobLocation[0] : item.jobLocation;
            if (loc?.address) {
              const addr = loc.address;
              if (typeof addr === 'string') {
                locationStr = cleanString(addr);
              } else {
                const parts = [
                  addr.streetAddress,
                  addr.addressLocality,
                  addr.addressRegion,
                  addr.addressCountry
                ].filter(Boolean);
                locationStr = parts.join(', ');
              }
            }
          }

          let workplaceType = normalizeWorkplaceType(item.jobLocationType, item.description);
          let rawDesc = stripHtml(item.description);

          // Salary
          let salaryMin = '';
          let salaryMax = '';
          let salaryPeriod = '';
          const baseSal = item.baseSalary || item.estimatedSalary || item.salary;
          if (baseSal) {
            const val = baseSal.value;
            if (val) {
              if (typeof val === 'number' || typeof val === 'string') {
                salaryMin = String(val).replace(/[^0-9.]/g, '');
              } else if (typeof val === 'object') {
                if (val.minValue) salaryMin = String(val.minValue).replace(/[^0-9.]/g, '');
                if (val.maxValue) salaryMax = String(val.maxValue).replace(/[^0-9.]/g, '');
                if (val.unitText) salaryPeriod = normalizeSalaryPeriod(val.unitText);
              }
            }
            if (!salaryPeriod && baseSal.unitText) {
              salaryPeriod = normalizeSalaryPeriod(baseSal.unitText);
            }
          }

          extractedJob = {
            position: jobTitle || undefined,
            jobTitle: jobTitle || undefined,
            company: companyName || undefined,
            companyName: companyName || undefined,
            location: locationStr || undefined,
            workplaceType: workplaceType || undefined,
            employmentType: normalizeEmploymentType(item.employmentType) || undefined,
            salaryMin: salaryMin || undefined,
            salaryMax: salaryMax || undefined,
            salaryPeriod: salaryPeriod || undefined,
            shortSummary: rawDesc ? rawDesc.slice(0, 300) : undefined,
            datePosted: item.datePosted ? cleanString(item.datePosted).substring(0, 10) : undefined,
            applicationDeadline: item.validThrough ? cleanString(item.validThrough).substring(0, 10) : undefined,
            jobId: detectedJobId || (item.identifier ? String(item.identifier.value || item.identifier) : undefined),
          };
          break;
        }
      }
    } catch (_) {}
  }

  // 2. OpenGraph & Meta Tag Fallback
  if (!extractedJob.position || !extractedJob.company) {
    let ogTitle = '';
    let ogDesc = '';
    let ogSiteName = '';
    let pageTitle = '';

    const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) || 
                         html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i) ||
                         html.match(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i);
    if (ogTitleMatch) ogTitle = cleanString(ogTitleMatch[1]);

    const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) || 
                        html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
                        html.match(/<meta\s+name=["']twitter:description["']\s+content=["']([^"']+)["']/i);
    if (ogDescMatch) ogDesc = cleanString(ogDescMatch[1]);

    const ogSiteMatch = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i);
    if (ogSiteMatch) ogSiteName = cleanString(ogSiteMatch[1]);

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) pageTitle = cleanString(titleMatch[1]);

    let titleCandidate = ogTitle || pageTitle;

    // Indeed title parsing: "Job Title - Location - Company | Indeed.com"
    if (norm.isIndeed && titleCandidate) {
      const cleanTitle = titleCandidate.replace(/\|\s*Indeed.*$/i, '').replace(/-\s*Indeed.*$/i, '').trim();
      const parts = cleanTitle.split(/\s+-\s+/);
      if (parts.length >= 3) {
        if (!extractedJob.position) extractedJob.position = parts[0];
        if (!extractedJob.company) extractedJob.company = parts[parts.length - 1];
        if (!extractedJob.location) extractedJob.location = parts.slice(1, parts.length - 1).join(', ');
      } else if (parts.length === 2) {
        if (!extractedJob.position) extractedJob.position = parts[0];
        if (!extractedJob.company) extractedJob.company = parts[1];
      } else if (parts.length === 1) {
        if (!extractedJob.position) extractedJob.position = parts[0];
      }
    } else if (norm.isLinkedIn && titleCandidate) {
      // LinkedIn: "Company hiring Position in Location | LinkedIn"
      const hiringMatch = titleCandidate.match(/^(.+?)\s+hiring\s+(.+?)\s+in\s+(.+?)(?:\||$)/i);
      if (hiringMatch) {
        if (!extractedJob.company) extractedJob.company = cleanString(hiringMatch[1]);
        if (!extractedJob.position) extractedJob.position = cleanString(hiringMatch[2]);
        if (!extractedJob.location) extractedJob.location = cleanString(hiringMatch[3]);
      } else {
        const parts = titleCandidate.split(/\s+[-|]\s+/);
        if (parts.length >= 2) {
          if (!extractedJob.position) extractedJob.position = parts[0];
          if (!extractedJob.company) extractedJob.company = parts[1];
        }
      }
    } else if (norm.isZipRecruiter && titleCandidate) {
      // ZipRecruiter: "Position in Location, State | ZipRecruiter" or "Position at Company | ZipRecruiter"
      const cleanTitle = titleCandidate.replace(/\|\s*ZipRecruiter.*$/i, '').replace(/-\s*ZipRecruiter.*$/i, '').trim();
      if (cleanTitle.includes(' at ')) {
        const parts = cleanTitle.split(/\s+at\s+/i);
        if (!extractedJob.position) extractedJob.position = parts[0]?.trim();
        if (!extractedJob.company) extractedJob.company = parts[1]?.trim();
      } else if (cleanTitle.includes(' in ')) {
        const parts = cleanTitle.split(/\s+in\s+/i);
        if (!extractedJob.position) extractedJob.position = parts[0]?.trim();
        if (!extractedJob.location) extractedJob.location = parts[1]?.trim();
      } else {
        const parts = cleanTitle.split(/\s+[-|]\s+/);
        if (parts.length >= 2) {
          if (!extractedJob.position) extractedJob.position = parts[0]?.trim();
          if (!extractedJob.company) extractedJob.company = parts[1]?.trim();
        } else if (!extractedJob.position) {
          extractedJob.position = cleanTitle;
        }
      }
    } else if (titleCandidate) {
      const parts = titleCandidate.split(/\s+[-|–—]\s+/);
      if (parts.length >= 2) {
        if (!extractedJob.position) extractedJob.position = parts[0];
        if (!extractedJob.company) extractedJob.company = parts[1];
      } else if (!extractedJob.position) {
        extractedJob.position = titleCandidate;
      }
    }

    if (!extractedJob.company && ogSiteName && !/indeed|linkedin|greenhouse|lever|workday|ziprecruiter/i.test(ogSiteName)) {
      extractedJob.company = ogSiteName;
    }

    if (!extractedJob.shortSummary && ogDesc) {
      extractedJob.shortSummary = stripHtml(ogDesc);
    }
  }

  // Fallback to titleHint / companyHint if missing
  if (!extractedJob.position && titleHint) {
    extractedJob.position = titleHint;
  }
  if (!extractedJob.company && companyHint) {
    extractedJob.company = companyHint;
  }

  // 3. AI Enrichment with Gemini if key fields are missing or for deep extraction
  const strippedBody = stripHtml(html).slice(0, 12000);
  const ai = allowAI ? getGeminiClient() : null;

  if (ai && (!extractedJob.position || !extractedJob.company || !extractedJob.shortSummary || !extractedJob.salaryMin)) {
    try {
      const aiResult = await extractJobDataFromText(strippedBody, canonicalLink);
      if (aiResult.success) {
        extractedJob = {
          position: extractedJob.position || aiResult.position || titleHint,
          jobTitle: extractedJob.jobTitle || aiResult.jobTitle || titleHint,
          company: extractedJob.company || aiResult.company || companyHint,
          companyName: extractedJob.companyName || aiResult.companyName || companyHint,
          location: extractedJob.location || aiResult.location,
          workplaceType: extractedJob.workplaceType || aiResult.workplaceType,
          employmentType: extractedJob.employmentType || aiResult.employmentType,
          salaryMin: extractedJob.salaryMin || aiResult.salaryMin,
          salaryMax: extractedJob.salaryMax || aiResult.salaryMax,
          salaryPeriod: extractedJob.salaryPeriod || aiResult.salaryPeriod,
          shortSummary: extractedJob.shortSummary || aiResult.shortSummary,
          responsibilities: extractedJob.responsibilities || aiResult.responsibilities,
          requiredQualifications: extractedJob.requiredQualifications || aiResult.requiredQualifications,
          preferredQualifications: extractedJob.preferredQualifications || aiResult.preferredQualifications,
          datePosted: extractedJob.datePosted || aiResult.datePosted,
          jobId: extractedJob.jobId || aiResult.jobId,
        };
      }
    } catch (aiErr) {
      console.warn('[JobExtractor] Gemini HTML text analysis skipped:', aiErr);
    }
  }

  const finalPosition = cleanString(extractedJob.position || extractedJob.jobTitle || titleHint);
  const finalCompany = cleanString(extractedJob.company || extractedJob.companyName || companyHint);
  const hasExtractedData = Boolean(finalPosition || finalCompany);

  return {
    success: hasExtractedData,
    partial: hasExtractedData && (!finalPosition || !finalCompany),
    position: finalPosition || undefined,
    jobTitle: finalPosition || undefined,
    company: finalCompany || undefined,
    companyName: finalCompany || undefined,
    location: cleanString(extractedJob.location) || undefined,
    workplaceType: extractedJob.workplaceType || undefined,
    employmentType: extractedJob.employmentType || undefined,
    salaryMin: extractedJob.salaryMin || undefined,
    salaryMax: extractedJob.salaryMax || undefined,
    salaryPeriod: extractedJob.salaryPeriod || undefined,
    shortSummary: extractedJob.shortSummary || undefined,
    responsibilities: extractedJob.responsibilities,
    requiredQualifications: extractedJob.requiredQualifications,
    preferredQualifications: extractedJob.preferredQualifications,
    datePosted: extractedJob.datePosted || undefined,
    applicationDeadline: extractedJob.applicationDeadline || undefined,
    source: detectedSource || 'Online Listing',
    originalUrl: canonicalLink,
    link: canonicalLink,
    jobId: detectedJobId || extractedJob.jobId,
    warning: hasExtractedData 
      ? undefined 
      : 'This website blocked automatic importing. You can still add the application manually.',
  };
}
