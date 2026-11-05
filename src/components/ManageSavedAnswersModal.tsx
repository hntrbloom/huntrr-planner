import React, { useState } from 'react';
import { X, Trash2, MapPin, Building2, Briefcase, RotateCcw, AlertCircle, CheckCircle2, Search } from 'lucide-react';
import { 
  JobAutocompleteHistory, 
  AutocompleteFieldType, 
  removeSuggestionItem,
  restoreDefaults,
  sortSuggestions
} from '../lib/jobAutocomplete';
import { format, parseISO } from 'date-fns';

interface ManageSavedAnswersModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: JobAutocompleteHistory;
  onUpdateHistory: (updated: JobAutocompleteHistory) => void;
  initialField?: AutocompleteFieldType;
}

export function ManageSavedAnswersModal({
  isOpen,
  onClose,
  history,
  onUpdateHistory,
  initialField = 'location'
}: ManageSavedAnswersModalProps) {
  const [activeTab, setActiveTab] = useState<AutocompleteFieldType>(initialField);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentItems = history[activeTab] || [];
  const sortedItems = sortSuggestions(currentItems);
  const filteredItems = searchQuery.trim()
    ? sortedItems.filter(item => 
        item.value.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        item.normalized.includes(searchQuery.toLowerCase().trim())
      )
    : sortedItems;

  const handleDelete = (normalizedValue: string, displayValue: string) => {
    const updated = removeSuggestionItem(history, activeTab, normalizedValue);
    onUpdateHistory(updated);
    setFeedback(`Removed "${displayValue}" from suggestions.`);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleRestoreDefaults = () => {
    if (activeTab === 'workplaceType' || activeTab === 'employmentType') {
      const updated = restoreDefaults(history, activeTab);
      onUpdateHistory(updated);
      setFeedback(`Restored standard ${activeTab === 'workplaceType' ? 'Workplace' : 'Employment'} options.`);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const tabLabels: Record<AutocompleteFieldType, { name: string; icon: React.ReactNode; count: number }> = {
    location: {
      name: 'Location',
      icon: <MapPin className="w-4 h-4" />,
      count: (history.location || []).length
    },
    workplaceType: {
      name: 'Workplace Type',
      icon: <Building2 className="w-4 h-4" />,
      count: (history.workplaceType || []).length
    },
    employmentType: {
      name: 'Employment Type',
      icon: <Briefcase className="w-4 h-4" />,
      count: (history.employmentType || []).length
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-pink-100/90 backdrop-blur-xs pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-saved-answers-title"
    >
      <div 
        className="w-full max-w-xl bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-outline-variant/20 bg-surface-container-lowest">
          <div>
            <h3 id="manage-saved-answers-title" className="text-[17px] sm:text-[19px] font-bold text-on-surface m-0">
              Manage Saved Autocomplete Answers
            </h3>
            <p className="text-[12px] text-on-surface-variant m-0 mt-0.5">
              Remove outdated or incorrect suggestions for reuse across your devices.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-2 rounded-xl hover:bg-surface-variant/40 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-outline-variant/20 bg-surface-container-low px-4 pt-2 gap-2 overflow-x-auto">
          {(['location', 'workplaceType', 'employmentType'] as AutocompleteFieldType[]).map((tab) => {
            const isActive = activeTab === tab;
            const meta = tabLabels[tab];
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  setSearchQuery('');
                  setFeedback(null);
                }}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-[13px] font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-primary text-primary bg-surface-container-lowest rounded-t-lg shadow-xs'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 rounded-t-lg'
                }`}
              >
                {meta.icon}
                <span>{meta.name}</span>
                <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive ? 'bg-primary/15 text-primary' : 'bg-surface-container-high text-on-surface-variant'
                }`}>
                  {meta.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Bar inside active tab */}
        <div className="px-5 pt-4 pb-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`Search saved ${tabLabels[activeTab].name.toLowerCase()}s...`}
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl pl-10 pr-4 py-2 text-[14px] text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-on-surface p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="mx-5 mb-2 p-2.5 bg-secondary-container/80 text-on-secondary-container rounded-lg text-[13px] flex items-center gap-2 border border-secondary/20 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <span className="flex-1">{feedback}</span>
          </div>
        )}

        {/* List of items */}
        <div className="flex-1 overflow-y-auto px-5 py-2 divide-y divide-outline-variant/15 min-h-[200px]">
          {filteredItems.length > 0 ? (
            filteredItems.map(item => {
              let formattedDate = '';
              if (item.lastUsedAt) {
                try {
                  formattedDate = format(parseISO(item.lastUsedAt), 'MMM d, yyyy');
                } catch (e) {
                  formattedDate = item.lastUsedAt.substring(0, 10);
                }
              }

              return (
                <div 
                  key={item.normalized} 
                  className="py-3 flex items-center justify-between gap-3 group hover:bg-surface-container-low/40 px-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-on-surface truncate">
                        {item.value}
                      </span>
                      {item.isDefault && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant/80 border border-outline-variant/20">
                          Standard
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[12px] text-on-surface-variant/80 mt-0.5">
                      <span>Used {item.count} {item.count === 1 ? 'time' : 'times'}</span>
                      {formattedDate && (
                        <>
                          <span>•</span>
                          <span>Last used: {formattedDate}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(item.normalized, item.value)}
                    className="p-2 text-on-surface-variant/60 hover:text-error hover:bg-error/10 rounded-lg transition-colors cursor-pointer shrink-0"
                    title={`Remove "${item.value}" from autocomplete`}
                    aria-label={`Remove "${item.value}" from autocomplete`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-on-surface-variant">
              <p className="text-[14px] font-medium m-0">
                {searchQuery ? `No suggestions match "${searchQuery}"` : `No saved ${tabLabels[activeTab].name.toLowerCase()} suggestions yet.`}
              </p>
              <p className="text-[12px] text-on-surface-variant/70 mt-1 m-0">
                Answers you type and save in job applications will appear here automatically.
              </p>
            </div>
          )}
        </div>

        {/* Footer / Safety note */}
        <div className="p-4 border-t border-outline-variant/20 bg-surface-container-low/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[12px] text-on-surface-variant">
            <AlertCircle className="w-4 h-4 shrink-0 text-primary" />
            <span>Deleting a suggestion never alters or deletes any of your existing job applications.</span>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {(activeTab === 'workplaceType' || activeTab === 'employmentType') && (
              <button
                type="button"
                onClick={handleRestoreDefaults}
                className="px-3 py-1.5 text-[12px] font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                title="Restore default standard options"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Defaults</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-primary text-on-primary text-[13px] font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
