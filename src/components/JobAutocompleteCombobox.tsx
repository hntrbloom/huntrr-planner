import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, X, Clock, Sparkles, Settings2 } from 'lucide-react';
import { AutocompleteItem, filterSuggestions } from '../lib/jobAutocomplete';

interface JobAutocompleteComboboxProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: AutocompleteItem[];
  placeholder?: string;
  icon?: React.ReactNode;
  onOpenManage?: () => void;
  required?: boolean;
}

export function JobAutocompleteCombobox({
  id,
  label,
  value,
  onChange,
  suggestions,
  placeholder,
  icon,
  onOpenManage,
  required = false
}: JobAutocompleteComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = `${id}-listbox`;

  // Compute filtered suggestions based on current typed value
  const filtered = filterSuggestions(suggestions, value || '');

  // Close dropdown on outside click/tap
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick, { passive: true });
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setIsOpen(false);
    setHighlightedIndex(-1);
    // Keep focus on the input for accessibility
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange('');
    setIsOpen(true);
    setHighlightedIndex(-1);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filtered.length - 1));
        break;
      case 'Enter':
        if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
          e.preventDefault(); // Prevent accidental form submission
          handleSelect(filtered[highlightedIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      case 'Tab':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={id} className="block text-[14px] font-medium text-on-surface-variant">
          {label} {required && <span className="text-error">*</span>}
        </label>
        {onOpenManage && (
          <button
            type="button"
            onClick={onOpenManage}
            className="text-[11px] text-primary hover:text-primary/80 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            title={`Manage saved ${label.toLowerCase()} suggestions`}
            aria-label={`Manage saved ${label.toLowerCase()} suggestions`}
          >
            <Settings2 className="w-3 h-3" />
            <span>Manage</span>
          </button>
        )}
      </div>

      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50 pointer-events-none">
            {icon}
          </div>
        )}

        <input
          ref={inputRef}
          type="text"
          id={id}
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-activedescendant={
            isOpen && highlightedIndex >= 0 ? `${id}-opt-${highlightedIndex}` : undefined
          }
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={e => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => {
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full bg-surface-container-low border border-outline-variant/50 rounded-xl py-2.5 text-[16px] text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all ${
            icon ? 'pl-10' : 'pl-4'
          } ${value ? 'pr-16' : 'pr-9'}`}
        />

        {/* Clear input button */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant/50 hover:text-on-surface rounded-full transition-colors cursor-pointer"
            title="Clear text"
            aria-label="Clear field"
            tabIndex={-1}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Dropdown chevron toggle */}
        <button
          type="button"
          onClick={() => {
            setIsOpen(prev => !prev);
            if (!isOpen && inputRef.current) {
              inputRef.current.focus();
            }
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-on-surface-variant/60 hover:text-on-surface rounded-lg transition-colors cursor-pointer"
          title={isOpen ? 'Close suggestions' : 'Show suggestions'}
          aria-label={isOpen ? 'Close suggestions' : 'Show suggestions'}
          tabIndex={-1}
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`}
          />
        </button>
      </div>

      {/* Suggestion Dropdown Listbox */}
      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-outline-variant/40 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-outline-variant/15 animate-in fade-in zoom-in-95 duration-150"
        >
          {filtered.length > 0 ? (
            <div className="py-1">
              {filtered.map((item, index) => {
                const isSelected = item.value.toLowerCase() === value.trim().toLowerCase();
                const isHighlighted = highlightedIndex === index;

                return (
                  <div
                    key={`${item.normalized}-${index}`}
                    id={`${id}-opt-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    // onPointerDown prevents blur before click on mobile Safari/iPad
                    onPointerDown={(e) => {
                      e.preventDefault();
                      handleSelect(item.value);
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`px-3.5 py-2.5 flex items-center justify-between gap-2 cursor-pointer transition-colors select-none ${
                      isHighlighted
                        ? 'bg-primary/10 text-primary font-medium'
                        : isSelected
                        ? 'bg-surface-container-low text-primary font-medium'
                        : 'text-on-surface hover:bg-surface-container-low'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[14px] truncate leading-tight">
                        {item.value}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.isDefault && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant/70 border border-outline-variant/20">
                          Standard
                        </span>
                      )}
                      {item.count > 1 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                          {item.count}x used
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-3.5 text-center">
              <p className="text-[13px] text-on-surface-variant m-0">
                No saved suggestions match <strong className="text-on-surface">"{value}"</strong>.
              </p>
              <p className="text-[11px] text-on-surface-variant/70 mt-1 m-0">
                Your custom entry will be saved for future reuse when you save this application.
              </p>
            </div>
          )}

          {/* Footer with Manage Link */}
          {onOpenManage && (
            <div className="p-2 bg-surface-container-lowest/90 border-t border-outline-variant/20 flex items-center justify-between text-[11px] text-on-surface-variant px-3">
              <span>{suggestions.length} saved {label.toLowerCase()}{suggestions.length === 1 ? '' : 's'}</span>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setIsOpen(false);
                  onOpenManage();
                }}
                className="text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Settings2 className="w-3 h-3" />
                <span>Manage saved answers</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
