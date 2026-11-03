import React, { useState } from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, AlignLeft, X, AlertTriangle, Edit2, Trash2, CheckCircle2, Tag, Circle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { CalendarAppointment, formatTime } from '../lib/CalendarContext';

export const CATEGORY_PRESETS = [
  { name: 'Personal', bg: 'bg-rose-100', text: 'text-rose-900', border: 'border-rose-200' },
  { name: 'Work', bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-200' },
  { name: 'Meeting', bg: 'bg-indigo-100', text: 'text-indigo-900', border: 'border-indigo-200' },
  { name: 'Studio', bg: 'bg-purple-100', text: 'text-purple-900', border: 'border-purple-200' },
  { name: 'Health', bg: 'bg-emerald-100', text: 'text-emerald-900', border: 'border-emerald-200' },
  { name: 'Supplies', bg: 'bg-sky-100', text: 'text-sky-900', border: 'border-sky-200' },
  { name: 'Social', bg: 'bg-pink-100', text: 'text-pink-900', border: 'border-pink-200' },
];

export function getCategoryStyle(categoryName?: string) {
  if (!categoryName) return { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-200' };
  const lower = categoryName.toLowerCase();
  if (lower.includes('work') || lower.includes('shift')) return { bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-200' };
  if (lower.includes('meet')) return { bg: 'bg-indigo-100', text: 'text-indigo-900', border: 'border-indigo-200' };
  if (lower.includes('studio') || lower.includes('craft') || lower.includes('print')) return { bg: 'bg-purple-100', text: 'text-purple-900', border: 'border-purple-200' };
  if (lower.includes('health') || lower.includes('doctor') || lower.includes('med')) return { bg: 'bg-emerald-100', text: 'text-emerald-900', border: 'border-emerald-200' };
  if (lower.includes('suppl') || lower.includes('shop')) return { bg: 'bg-sky-100', text: 'text-sky-900', border: 'border-sky-200' };
  if (lower.includes('social') || lower.includes('tea') || lower.includes('coffee')) return { bg: 'bg-pink-100', text: 'text-pink-900', border: 'border-pink-200' };
  if (lower.includes('person') || lower.includes('goal')) return { bg: 'bg-rose-100', text: 'text-rose-900', border: 'border-rose-200' };
  return { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' };
}

interface AppointmentFormModalProps {
  initialData: CalendarAppointment | null;
  defaultDate: string;
  onSave: (a: CalendarAppointment) => Promise<void>;
  onCancel: () => void;
}

export function AppointmentFormModal({ initialData, defaultDate, onSave, onCancel }: AppointmentFormModalProps) {
  const [formData, setFormData] = useState<CalendarAppointment>(
    initialData || {
      id: uuidv4(),
      name: '',
      date: defaultDate || new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '',
      location: '',
      notes: '',
      category: 'Personal',
      completed: false,
    }
  );

  const [isCustomCategory, setIsCustomCategory] = useState(() => {
    if (!initialData?.category) return false;
    return !CATEGORY_PRESETS.some((c) => c.name.toLowerCase() === initialData.category?.toLowerCase());
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!formData.name.trim()) {
      setErrorMsg('Event title is required');
      return;
    }
    if (!formData.date) {
      setErrorMsg('Date is required');
      return;
    }
    if (!formData.startTime) {
      setErrorMsg('Start time is required');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        ...formData,
        name: formData.name.trim(),
        category: (formData.category || 'General').trim(),
        location: formData.location?.trim() || '',
        notes: formData.notes?.trim() || '',
        completed: Boolean(formData.completed),
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save event. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Appointments dialog" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-outline-variant/30">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/20 bg-surface-container-lowest">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[20px] font-bold text-on-surface font-headline-sm">
                {initialData ? 'Edit Event' : 'New Calendar Event'}
              </h3>
              <p className="text-[12px] text-on-surface-variant font-medium">
                Saves directly to your calendar & agenda
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-red-100 border border-red-200 rounded-xl text-red-800 text-[14px] font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-[13px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
              Event Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Planning & Tea, Team Sync, Studio Print Batch"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium text-[15px]"
            />
          </div>

          <div>
            <label className="block text-[13px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
              Category
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {CATEGORY_PRESETS.map((preset) => {
                const isSelected =
                  !isCustomCategory && formData.category?.toLowerCase() === preset.name.toLowerCase();
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setIsCustomCategory(false);
                      setFormData({ ...formData, category: preset.name });
                    }}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-bold transition-all border ${
                      isSelected
                        ? `${preset.bg} ${preset.text} ${preset.border} ring-2 ring-primary/40 scale-105 shadow-sm`
                        : 'bg-surface-container-low text-on-surface-variant border-transparent hover:bg-surface-container'
                    }`}
                  >
                    {preset.name}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setIsCustomCategory(true)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-bold transition-all border ${
                  isCustomCategory
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-surface-container-low text-on-surface-variant border-transparent hover:bg-surface-container'
                }`}
              >
                + Custom
              </button>
            </div>
            {isCustomCategory && (
              <input
                type="text"
                placeholder="Enter custom category (e.g. Project X, Errands, Art)"
                value={formData.category || ''}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-3 py-2 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium text-[14px]"
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-[13px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-3 py-2.5 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium text-[14px]"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-[13px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                required
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-3 py-2.5 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium text-[14px]"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-[13px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                End Time <span className="text-on-surface-variant/70 font-normal lowercase">(opt)</span>
              </label>
              <input
                type="time"
                value={formData.endTime || ''}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-3 py-2.5 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium text-[14px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
              Location <span className="text-on-surface-variant/70 font-normal lowercase">(optional)</span>
            </label>
            <div className="relative flex items-center">
              <MapPin className="w-4 h-4 absolute left-3.5 text-on-surface-variant pointer-events-none" />
              <input
                type="text"
                placeholder="e.g. Studio Desk, Coffee Shop, Zoom link"
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl pl-10 pr-4 py-2.5 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium text-[14px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
              Notes <span className="text-on-surface-variant/70 font-normal lowercase">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Prep items, agenda points, or reminders..."
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none font-medium text-[14px]"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="event-completed-checkbox"
              checked={Boolean(formData.completed)}
              onChange={(e) => setFormData({ ...formData, completed: e.target.checked })}
              className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
            />
            <label htmlFor="event-completed-checkbox" className="text-[13px] font-medium text-on-surface cursor-pointer select-none">
              Mark as completed
            </label>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-full font-bold text-[14px] text-on-surface-variant hover:bg-surface-variant transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-7 py-2.5 rounded-full font-bold text-[14px] bg-primary text-white hover:bg-primary/90 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? 'Saving...' : initialData ? 'Save Changes' : 'Add to Calendar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AppointmentDetailsModalProps {
  appointment: CalendarAppointment;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleComplete?: () => void;
}

export function AppointmentDetailsModal({
  appointment,
  onClose,
  onEdit,
  onDelete,
  onToggleComplete,
}: AppointmentDetailsModalProps) {
  const catStyle = getCategoryStyle(appointment.category);

  return (
    <div role="dialog" aria-modal="true" aria-label="Appointments dialog" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-outline-variant/30">
        <div className="flex flex-col p-6 pb-4 border-b border-outline-variant/20 bg-surface-container-lowest">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-inner">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <div className="overflow-hidden">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                  >
                    {appointment.category || 'General'}
                  </span>
                  {appointment.completed && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Done
                    </span>
                  )}
                </div>
                <h3
                  className={`text-[19px] font-bold text-on-surface leading-tight truncate ${
                    appointment.completed ? 'line-through text-on-surface-variant/70' : ''
                  }`}
                >
                  {appointment.name}
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20 flex items-center justify-between">
            <span className="text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">Date & Time</span>
            <div className="text-right">
              <p className="text-[14px] font-bold text-on-surface">{appointment.date}</p>
              <p className="text-[13px] font-semibold text-primary flex items-center justify-end gap-1.5 mt-0.5">
                <Clock className="w-3.5 h-3.5" />
                {formatTime(appointment.startTime)}
                {appointment.endTime ? ` - ${formatTime(appointment.endTime)}` : ''}
              </p>
            </div>
          </div>

          {appointment.location && (
            <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20">
              <span className="block text-[11px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                Location
              </span>
              <span className="text-[14px] font-semibold text-on-surface flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary shrink-0" /> {appointment.location}
              </span>
            </div>
          )}

          {appointment.notes && (
            <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20">
              <span className="block text-[11px] font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">
                Notes
              </span>
              <p className="text-[13px] text-on-surface italic leading-relaxed whitespace-pre-wrap">
                {appointment.notes}
              </p>
            </div>
          )}

          {onToggleComplete && (
            <button
              onClick={onToggleComplete}
              className={`w-full py-2.5 px-4 rounded-2xl font-bold text-[13px] transition-all flex items-center justify-center gap-2 border ${
                appointment.completed
                  ? 'bg-surface-container-high hover:bg-surface-variant text-on-surface border-outline-variant/30'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-200 shadow-sm'
              }`}
            >
              {appointment.completed ? (
                <>
                  <Circle className="w-4 h-4 text-on-surface-variant" /> Mark as Incomplete
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Mark as Completed
                </>
              )}
            </button>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onEdit}
              className="flex-1 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-full font-bold text-[13px] transition-colors flex items-center justify-center gap-1.5"
            >
              <Edit2 className="w-4 h-4" /> Edit
            </button>
            <button
              onClick={onDelete}
              className="flex-1 py-2.5 bg-error-container hover:bg-error-container/80 text-on-error-container rounded-full font-bold text-[13px] transition-colors flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
