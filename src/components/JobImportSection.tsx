import { apiHeaders } from '../lib/apiClient';
import React, { useState } from 'react';
import { JobApplication } from './JobApplicationsView';
import { normalizeJobUrl, cleanRawUrl } from '../lib/jobUrlUtils';
import { Loader2, Sparkles, AlertCircle, Link as LinkIcon, FileText, Bot } from 'lucide-react';

export function JobImportSection({ onImportSuccess }: { onImportSuccess: (job: Partial<JobApplication>, notice?: string) => void }) {
  const [importMode, setImportMode] = useState<'link' | 'text'>('link');
  const [url, setUrl] = useState('');
  const [jobText, setJobText] = useState('');
  const [textLink, setTextLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const handleImportLink = async () => {
    const rawClean = cleanRawUrl(url);
    if (!rawClean) {
      setWarning('Please enter a job link or partial Indeed / LinkedIn URL.');
      return;
    }

    const normalized = normalizeJobUrl(rawClean);
    const targetUrl = normalized.normalizedUrl || rawClean;
    const cleanCanonical = normalized.cleanCanonicalUrl || targetUrl;

    setLoading(true);
    setWarning(null);

    try {
      const response = await fetch('/api/extract-job-url', {
        method: 'POST',
        headers: await apiHeaders(),
        body: JSON.stringify({ url: rawClean })
      });

      if (!response.ok) {
        // Fallback gracefully without blocking
        onImportSuccess(
          { 
            position: normalized.titleHint || '',
            company: normalized.companyHint || '',
            originalUrl: cleanCanonical, 
            link: cleanCanonical,
            jobId: normalized.jobId,
            source: normalized.source || ''
          },
          normalized.titleHint 
            ? "Retrieved job title from link. Please confirm company and details."
            : "This website blocked automatic importing. You can still add the application manually."
        );
        setUrl('');
        return;
      }

      const data = await response.json();
      let notice: string | undefined = undefined;

      if (!data.success || data.blocked) {
        notice = normalized.titleHint || data.position || data.jobTitle
          ? "Retrieved job title from link. Please confirm company and details."
          : "This website blocked automatic importing. You can still add the application manually.";
      } else if (data.partial) {
        notice = "Some job details were imported. Please check and fill in any missing information.";
      }

      onImportSuccess(
        { 
          ...data, 
          position: data.jobTitle || data.position || normalized.titleHint || '',
          company: data.companyName || data.company || normalized.companyHint || '',
          originalUrl: cleanCanonical, 
          link: cleanCanonical,
          jobId: normalized.jobId || data.jobId,
          source: data.source || normalized.source || ''
        },
        notice
      );
      setUrl('');
    } catch (err) {
      console.log('[JobImport] Link import fallback:', err);
      onImportSuccess(
        { 
          position: normalized.titleHint || '',
          company: normalized.companyHint || '',
          originalUrl: cleanCanonical, 
          link: cleanCanonical,
          jobId: normalized.jobId,
          source: normalized.source || ''
        },
        normalized.titleHint
          ? "Retrieved job title from link. Please confirm company and details."
          : "This website blocked automatic importing. You can still add the application manually."
      );
      setUrl('');
    } finally {
      setLoading(false);
    }
  };

  const handleImportText = async () => {
    if (!jobText.trim()) {
      setWarning('Please paste the job listing description text.');
      return;
    }

    setLoading(true);
    setWarning(null);

    const cleanLink = textLink.trim() ? normalizeJobUrl(cleanRawUrl(textLink)).cleanCanonicalUrl : '';

    try {
      const response = await fetch('/api/extract-job-text', {
        method: 'POST',
        headers: await apiHeaders(),
        body: JSON.stringify({ 
          text: jobText,
          originalUrl: cleanLink || undefined
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        setWarning(error.error || "Couldn't extract details from the text. You can still add the application manually.");
        return;
      }

      const data = await response.json();
      if (!data.success) {
        setWarning(data.warning || "We couldn't automatically read all listing details, but you can still add it manually.");
      }

      onImportSuccess(
        {
          ...data,
          link: cleanLink || data.link || '',
          originalUrl: cleanLink || data.originalUrl || '',
        },
        data.success ? "Job details extracted from description!" : undefined
      );

      setJobText('');
      setTextLink('');
    } catch (err) {
      console.warn('[JobImport] Text analysis error:', err);
      setWarning("Couldn't process job text. You can still enter details manually.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest p-5 md:p-6 rounded-2xl border border-outline-variant/30 shadow-md mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary shrink-0" />
          <h4 className="text-[16px] md:text-[18px] font-semibold text-on-surface m-0">
            Import Job Application
          </h4>
        </div>
        
        {/* Mode Selector Tabs */}
        <div className="flex items-center p-1 bg-surface-container-low rounded-xl border border-outline-variant/30 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => { setImportMode('link'); setWarning(null); }}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              importMode === 'link'
                ? 'bg-surface-container-lowest text-primary font-semibold shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>From Link</span>
          </button>
          <button
            type="button"
            onClick={() => { setImportMode('text'); setWarning(null); }}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              importMode === 'text'
                ? 'bg-surface-container-lowest text-primary font-semibold shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Paste Description</span>
          </button>
        </div>
      </div>

      {importMode === 'link' ? (
        <div>
          <p className="text-[13px] text-on-surface-variant mb-4 leading-relaxed">
            Paste any Indeed, LinkedIn, or company career link (including mobile app share links or /viewjob?jk= URLs) to automatically extract title, company, salary, and details.
          </p>
          
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <div className="flex-1 w-full">
              <input 
                type="text"
                inputMode="url"
                autoComplete="url"
                value={url}
                onChange={e => {
                  setUrl(e.target.value);
                  if (warning) setWarning(null);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !loading && url.trim()) {
                    e.preventDefault();
                    handleImportLink();
                  }
                }}
                placeholder="Paste Indeed, LinkedIn, or career link (/viewjob?jk=...)"
                disabled={loading}
                className="w-full bg-surface-container-low border border-outline-variant/50 rounded-xl px-4 py-2.5 text-[15px] md:text-[16px] text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60"
              />
            </div>
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={handleImportLink}
                disabled={loading || !url.trim()}
                className="px-5 py-2.5 rounded-full text-[14px] font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-all disabled:opacity-50 shadow-sm flex items-center justify-center gap-2 min-w-[160px] cursor-pointer min-h-[44px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Retrieving job details…</span>
                  </>
                ) : (
                  <span>Import Job Details</span>
                )}
              </button>
              {url && (
                <button 
                  type="button"
                  onClick={() => { setUrl(''); setWarning(null); }}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-full text-[13px] font-medium text-on-surface-variant border border-outline-variant/50 hover:bg-surface-variant transition-colors disabled:opacity-50 cursor-pointer min-h-[44px]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[13px] text-on-surface-variant leading-relaxed">
            If a website blocks direct link imports or login is required, copy and paste the job description text below. Gemini AI will automatically extract all fields.
          </p>

          <div>
            <textarea
              rows={4}
              value={jobText}
              onChange={e => {
                setJobText(e.target.value);
                if (warning) setWarning(null);
              }}
              placeholder="Paste job posting description, requirements, and responsibilities here..."
              disabled={loading}
              className="w-full bg-surface-container-low border border-outline-variant/50 rounded-xl p-3 text-[14px] text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60 resize-y"
            />
          </div>

          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <div className="flex-1 w-full">
              <input
                type="text"
                inputMode="url"
                value={textLink}
                onChange={e => setTextLink(e.target.value)}
                placeholder="Optional: Job listing URL (to save with application)"
                disabled={loading}
                className="w-full bg-surface-container-low border border-outline-variant/50 rounded-xl px-4 py-2 text-[14px] text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleImportText}
                disabled={loading || !jobText.trim()}
                className="px-5 py-2.5 rounded-full text-[14px] font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-all disabled:opacity-50 shadow-sm flex items-center justify-center gap-2 min-w-[160px] cursor-pointer min-h-[44px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Extracting details…</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-4 h-4" />
                    <span>Extract with AI</span>
                  </>
                )}
              </button>
              {jobText && (
                <button
                  type="button"
                  onClick={() => { setJobText(''); setTextLink(''); setWarning(null); }}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-full text-[13px] font-medium text-on-surface-variant border border-outline-variant/50 hover:bg-surface-variant transition-colors disabled:opacity-50 cursor-pointer min-h-[44px]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {warning && (
        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-xl text-[13px] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{warning}</span>
        </div>
      )}
    </div>
  );
}
