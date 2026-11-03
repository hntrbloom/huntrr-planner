import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  CalendarDays,
  CheckCircle2,
  Circle,
  MapPin,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Briefcase,
  Coffee,
  CalendarCheck,
  Tag,
  AlignLeft,
  X,
  Edit2,
  Trash2
} from 'lucide-react';
import { NotebookPen, ListTodo, Heart } from 'lucide-react';
import { TodaySummary } from './TodaySummary';
import { PocketFriend } from './PlannerDecor';
import { useCalendar, CalendarAppointment, getLocalDateString, formatTime } from '../lib/CalendarContext';
import { useWorkShifts, WorkShift } from '../lib/WorkShiftsContext';
import { AppointmentFormModal, AppointmentDetailsModal, getCategoryStyle } from './AppointmentModals';
import { ViewState } from '../types';

interface AgendaViewProps {
  onNavigate?: (view: ViewState) => void;
}

// Unified item for both appointments and shifts in the agenda timeline
interface AgendaItem {
  id: string;
  sourceType: 'appointment' | 'shift';
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime?: string; // HH:mm
  category: string;
  location?: string;
  notes?: string;
  completed?: boolean;
  rawAppointment?: CalendarAppointment;
  rawShift?: WorkShift;
}

export function AgendaView({ onNavigate }: AgendaViewProps) {
  const { appointments, saveAppointment, deleteAppointment, toggleCompleteAppointment, loading } = useCalendar();
  const { workShifts } = useWorkShifts();

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<CalendarAppointment | null>(null);
  const [selectedApptDetails, setSelectedApptDetails] = useState<CalendarAppointment | null>(null);
  const [selectedShiftDetails, setSelectedShiftDetails] = useState<WorkShift | null>(null);
  const [formDefaultDate, setFormDefaultDate] = useState<string>('');

  // Today's date calculations
  const todayDate = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => getLocalDateString(todayDate), [todayDate]);

  // Combine and normalize appointments & shifts into a unified agenda stream
  const allAgendaItems: AgendaItem[] = useMemo(() => {
    const apptItems: AgendaItem[] = (appointments || []).map((a) => ({
      id: a.id,
      sourceType: 'appointment',
      title: a.name,
      date: a.date,
      startTime: a.startTime || '00:00',
      endTime: a.endTime,
      category: a.category || 'General',
      location: a.location,
      notes: a.notes,
      completed: Boolean(a.completed),
      rawAppointment: a,
    }));

    const shiftItems: AgendaItem[] = (workShifts || []).map((s) => ({
      id: s.id,
      sourceType: 'shift',
      title: s.workplace ? `${s.workplace}` : 'Work Shift',
      date: s.date,
      startTime: s.clockIn || '00:00',
      endTime: s.clockOut,
      category: 'Work Shift',
      location: s.workplace,
      notes: s.notes,
      completed: false,
      rawShift: s,
    }));

    return [...apptItems, ...shiftItems];
  }, [appointments, workShifts]);

  // Today's items sorted strictly in time order
  const todayItems = useMemo(() => {
    return allAgendaItems
      .filter((item) => item.date === todayStr)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [allAgendaItems, todayStr]);

  // Upcoming items for the next 7 days (dates strictly > today and <= today + 7 days)
  const upcomingGrouped = useMemo(() => {
    const next7DaysStr: string[] = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() + i);
      next7DaysStr.push(getLocalDateString(d));
    }

    const items = allAgendaItems
      .filter((item) => next7DaysStr.includes(item.date))
      .sort((a, b) => {
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }
        return a.startTime.localeCompare(b.startTime);
      });

    // Group items by date string
    const groups: { dateStr: string; label: string; items: AgendaItem[] }[] = [];
    for (const dStr of next7DaysStr) {
      const dayMatches = items.filter((it) => it.date === dStr);
      if (dayMatches.length > 0) {
        const [y, m, d] = dStr.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const dayDiff = Math.round((dateObj.getTime() - new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate()).getTime()) / (1000 * 60 * 60 * 24));
        
        let label = dateObj.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' });
        if (dayDiff === 1) {
          label = `Tomorrow • ${label}`;
        }

        groups.push({
          dateStr: dStr,
          label,
          items: dayMatches,
        });
      }
    }

    return groups;
  }, [allAgendaItems, todayDate, todayStr]);

  // Today's formatted display header
  const todayFormatted = useMemo(() => {
    return todayDate.toLocaleDateString('default', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [todayDate]);

  // Handler to open item details
  const handleItemClick = (item: AgendaItem) => {
    if (item.sourceType === 'appointment' && item.rawAppointment) {
      setSelectedApptDetails(item.rawAppointment);
    } else if (item.sourceType === 'shift' && item.rawShift) {
      setSelectedShiftDetails(item.rawShift);
    }
  };

  const openAddModal = (dateToUse?: string) => {
    setEditingAppt(null);
    setFormDefaultDate(dateToUse || todayStr);
    setIsFormOpen(true);
  };

  const completedCount = useMemo(() => {
    return todayItems.filter((it) => it.completed).length;
  }, [todayItems]);

  return (
    <main className="agenda-scroll-container flex-1 md:overflow-y-auto px-4 sm:px-6 md:px-8 lg:px-10 py-5 sm:py-6 md:py-8 pb-28 md:pb-12 w-full max-w-[1260px] mx-auto min-w-0">
      <div className="home-page-label"><span><Sparkles size={14} aria-hidden="true" /> YOUR EVERYDAY HAPPY PLACE</span><span>{todayFormatted}</span></div>
      <section className="planner-welcome">
        <div className="welcome-copy"><p className="planner-eyebrow">Hello, lovely <span aria-hidden="true">♡</span></p><h1>Make a little space<br />for your day.</h1><p>Your plans, ideas & little everyday things. All tucked in here.</p></div>
        <PocketFriend className="welcome-friend" />
        <div className="welcome-date" aria-label={todayFormatted}><span>{todayDate.toLocaleDateString('default', { month: 'short' })}</span><strong>{todayDate.getDate().toString().padStart(2, '0')}</strong><span>{todayDate.toLocaleDateString('default', { weekday: 'long' })}</span></div>
      </section>
      <div className="home-actions">
        <span>A little planning goes a long way</span>
        <div className="quick-actions">
          {onNavigate && <button onClick={() => onNavigate('log')}><ListTodo size={15} aria-hidden="true" /> Add task</button>}
          <button onClick={() => openAddModal(todayStr)}><Plus size={15} aria-hidden="true" /> Add event</button>
          {onNavigate && <><button onClick={() => onNavigate('notes')}><NotebookPen size={15} aria-hidden="true" /> Write a note</button><button onClick={() => onNavigate('habits')}><Heart size={15} aria-hidden="true" /> Habit check-in</button></>}
        </div>
      </div>
      <TodaySummary onNavigate={onNavigate} eventTotal={todayItems.filter(item => item.sourceType === 'appointment').length} eventDone={completedCount} eventsReady={!loading} date={todayDate} />
      <div className="agenda-section-label"><span>My daily agenda</span><span aria-hidden="true">✦</span></div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap agenda-toolbar">
        <div className="inline-flex items-center gap-2 text-primary text-[12px] font-bold tracking-wider">
          <CalendarIcon className="w-4 h-4" aria-hidden="true" /><span>{todayFormatted}</span>
        </div>
        <div className="flex items-center gap-2.5">
          {onNavigate && (
            <button
              onClick={() => onNavigate('month')}
              className="h-9 px-3.5 rounded-full bg-white hover:bg-[#f8f4f7] border border-[#e5e1e4] text-on-surface-variant hover:text-on-surface font-semibold text-[13px] transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5 active:scale-95"
              title="View Full Calendar"
            >
              <CalendarDays className="w-4 h-4 text-primary shrink-0" />
              <span className="hidden sm:inline">Open Calendar</span>
              <span className="sm:hidden">Calendar</span>
              <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant/70 shrink-0" />
            </button>
          )}

          <button
            onClick={() => openAddModal(todayStr)}
            className="h-9 px-4 rounded-full bg-primary hover:bg-[#604b5b] text-white font-semibold text-[13px] transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5 active:scale-95"
            title="Add New Event"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>New Event</span>
          </button>
        </div>
      </div>

      {/* TWO-COLUMN DASHBOARD GRID (Desktop: ~65% Today's Schedule, ~35% Upcoming Events) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Column 1: Today's Schedule (Primary, approx 65% width on desktop) */}
        <section className="lg:col-span-7 xl:col-span-8 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-3 px-0.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-[18px] sm:text-[20px] font-bold font-headline-md text-on-surface">
                Today's Schedule
              </h2>
              <span className="ml-1 px-2 py-0.5 rounded-full bg-[#f1edf0] text-on-surface-variant font-bold text-[11px] tabular-nums">
                {todayItems.length}
              </span>
            </div>

            {todayItems.length > 0 && (
              <button
                onClick={() => openAddModal(todayStr)}
                className="text-primary hover:text-[#523e4d] font-bold text-[13px] flex items-center gap-1 hover:underline cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            )}
          </div>

          {/* Empty State when nothing scheduled today */}
          {loading ? <p role="status" className="p-4 text-sm text-on-surface-variant">Opening your calendar…</p> : todayItems.length === 0 ? (
            <div className="bg-white border border-dashed border-[#ded5db] rounded-2xl p-6 sm:p-7 text-center shadow-xs flex flex-col items-center justify-center transition-all">
              <div className="w-11 h-11 rounded-xl bg-[#faf2f7] border border-[#f0e2ec] text-primary flex items-center justify-center mb-2.5">
                <Coffee className="w-5 h-5" />
              </div>
              <h3 className="text-[17px] font-bold text-on-surface font-headline-sm mb-1">
                Nothing Scheduled Today
              </h3>
              <p className="text-[13px] text-on-surface-variant font-medium max-w-sm mx-auto mb-4 leading-relaxed">
                You have no appointments or work shifts planned for today. Enjoy a restful day, or add a quick event to your calendar.
              </p>
              <button
                onClick={() => openAddModal(todayStr)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary hover:bg-[#604b5b] text-white font-semibold text-[13px] shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Event for Today
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {todayItems.map((item) => {
                const catStyle = getCategoryStyle(item.category);
                return (
                  <div
                    key={`${item.sourceType}-${item.id}`}
                    onClick={() => handleItemClick(item)}
                    role="button"
                    tabIndex={0}
                    aria-label={`View ${item.title}`}
                    onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); handleItemClick(item); } }}
                    className={`group relative bg-white border rounded-xl sm:rounded-2xl p-3.5 sm:p-4 transition-all duration-150 cursor-pointer shadow-xs hover:shadow-sm hover:border-primary/40 flex items-center justify-between gap-3 ${
                      item.completed
                        ? 'border-[#e8e2e6] bg-[#fbf9fb] opacity-80'
                        : 'border-[#e5e1e4]'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Completion button */}
                      {item.sourceType === 'appointment' ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCompleteAppointment(item.id);
                          }}
                          className="p-1 rounded-full text-on-surface-variant hover:text-emerald-600 transition-colors shrink-0"
                          aria-label={item.completed ? `Mark ${item.title} incomplete` : `Mark ${item.title} complete`}
                          title={item.completed ? 'Mark incomplete' : 'Mark complete'}
                        >
                          {item.completed ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                          ) : (
                            <Circle className="w-5 h-5 text-on-surface-variant/70 hover:text-emerald-600 transition-colors" />
                          )}
                        </button>
                      ) : (
                        <div className="p-1 text-secondary shrink-0" title="Work Shift">
                          <Briefcase className="w-5 h-5" />
                        </div>
                      )}

                      {/* Time pill */}
                      <div className="shrink-0 bg-[#f8f4f7] px-2.5 py-1 rounded-xl border border-[#ece4eb] text-center min-w-[80px]">
                        <span className="text-[12px] font-bold text-on-surface flex items-center justify-center gap-1 tabular-nums">
                          <Clock className="w-3 h-3 text-primary" />
                          {formatTime(item.startTime)}
                        </span>
                        {item.endTime && (
                          <span className="text-[10.5px] text-on-surface-variant font-medium block tabular-nums">
                            until {formatTime(item.endTime)}
                          </span>
                        )}
                      </div>

                      {/* Title & Metadata */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                          >
                            {item.category}
                          </span>
                          {item.location && (
                            <span className="text-[12px] text-on-surface-variant flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 shrink-0 text-primary/70" />
                              <span className="truncate">{item.location}</span>
                            </span>
                          )}
                        </div>

                        <h3
                          className={`text-[15px] sm:text-[16px] font-bold text-on-surface leading-snug truncate ${
                            item.completed ? 'line-through text-on-surface-variant/60' : ''
                          }`}
                        >
                          {item.title}
                        </h3>

                        {item.notes && (
                          <p className="text-[12px] text-on-surface-variant line-clamp-1 italic mt-0.5">
                            "{item.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right chevron / Action hint */}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[12px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">
                        Details
                      </span>
                      <div className="w-7 h-7 rounded-full bg-[#f8f4f7] group-hover:bg-primary/10 flex items-center justify-center text-on-surface-variant group-hover:text-primary transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Column 2: Upcoming in Next Few Days (Secondary, approx 35% width on desktop) */}
        <section className="lg:col-span-5 xl:col-span-4 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-3 px-0.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
                <CalendarDays className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-[18px] sm:text-[20px] font-bold font-headline-md text-on-surface">
                Upcoming Days
              </h2>
            </div>

            {onNavigate && (
              <button
                onClick={() => onNavigate('month')}
                className="text-primary hover:text-[#523e4d] font-bold text-[13px] flex items-center gap-1 hover:underline cursor-pointer transition-colors"
              >
                See Month <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {upcomingGrouped.length === 0 ? (
            <div className="bg-white border border-[#e8e2e6] rounded-2xl p-5 text-center shadow-xs">
              <p className="text-[13px] text-on-surface-variant font-medium">
                No upcoming events scheduled for the next 7 days.
              </p>
              <button
                onClick={() => openAddModal()}
                className="mt-2 text-primary font-bold text-[13px] hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Schedule an upcoming event
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingGrouped.map((group) => (
                <div key={group.dateStr} className="space-y-2">
                  <div className="flex items-center justify-between gap-2 px-1">
                    <span className="text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">
                      {group.label}
                    </span>
                    <div className="flex-1 h-px bg-[#ece4eb]" />
                    <button
                      onClick={() => openAddModal(group.dateStr)}
                      className="text-[11px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-0.5 shrink-0"
                      title={`Add event for ${group.label}`}
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
                    {group.items.map((item) => {
                      const catStyle = getCategoryStyle(item.category);
                      return (
                        <div
                          key={`${item.sourceType}-${item.id}`}
                          onClick={() => handleItemClick(item)}
                          role="button" tabIndex={0} aria-label={`View ${item.title}`}
                          onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); handleItemClick(item); } }}
                          className="group bg-white border border-[#e7e1e5] hover:border-primary/40 rounded-xl p-3 sm:p-3.5 transition-all duration-150 shadow-xs hover:shadow-sm cursor-pointer flex flex-col gap-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                            >
                              {item.category}
                            </span>
                            <span className="text-[12px] font-semibold text-on-surface-variant flex items-center gap-1 tabular-nums">
                              <Clock className="w-3 h-3 text-primary" />
                              {formatTime(item.startTime)}
                            </span>
                          </div>

                          <div>
                            <h4
                              className={`text-[14px] font-bold text-on-surface line-clamp-1 ${
                                item.completed ? 'line-through text-on-surface-variant/60' : ''
                              }`}
                            >
                              {item.title}
                            </h4>

                            {item.location && (
                              <p className="text-[12px] text-on-surface-variant flex items-center gap-1 mt-0.5 truncate">
                                <MapPin className="w-3 h-3 shrink-0 text-primary/70" />
                                <span className="truncate">{item.location}</span>
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-on-surface-variant/70 border-t border-[#f2edf1] pt-1.5 mt-0.5">
                            <span>{item.sourceType === 'shift' ? 'Work Shift' : 'Calendar Event'}</span>
                            <span className="text-primary font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                              Details <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Appointment Form Modal (Add / Edit) */}
      {isFormOpen && (
        <AppointmentFormModal
          initialData={editingAppt}
          defaultDate={formDefaultDate || todayStr}
          onSave={async (appt) => {
            await saveAppointment(appt);
            setIsFormOpen(false);
            setEditingAppt(null);
          }}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingAppt(null);
          }}
        />
      )}

      {/* Appointment Details Modal */}
      {selectedApptDetails && (
        <AppointmentDetailsModal
          appointment={selectedApptDetails}
          onClose={() => setSelectedApptDetails(null)}
          onEdit={() => {
            setEditingAppt(selectedApptDetails);
            setFormDefaultDate(selectedApptDetails.date);
            setSelectedApptDetails(null);
            setIsFormOpen(true);
          }}
          onDelete={async () => {
            if (confirm('Are you sure you want to delete this event?')) {
              await deleteAppointment(selectedApptDetails.id);
              setSelectedApptDetails(null);
            }
          }}
          onToggleComplete={async () => {
            await toggleCompleteAppointment(selectedApptDetails.id);
            setSelectedApptDetails((prev) =>
              prev ? { ...prev, completed: !prev.completed } : null
            );
          }}
        />
      )}

      {/* Work Shift Details Modal (if user taps a work shift) */}
      {selectedShiftDetails && (
        <div role="dialog" aria-modal="true" aria-label="Agenda dialog" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-outline-variant/30">
            <div className="flex flex-col p-6 pb-4 border-b border-outline-variant/20 bg-surface-container-lowest">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0 shadow-inner">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200 mb-1">
                      Work Shift
                    </span>
                    <h3 className="text-[19px] font-bold text-on-surface leading-tight">
                      {selectedShiftDetails.workplace || 'Work Shift'}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedShiftDetails(null)}
                  className="p-2 -mr-2 text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20 flex items-center justify-between">
                <span className="text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">Date & Time</span>
                <div className="text-right">
                  <p className="text-[14px] font-bold text-on-surface">{selectedShiftDetails.date}</p>
                  <p className="text-[13px] font-semibold text-primary flex items-center justify-end gap-1.5 mt-0.5">
                    <Clock className="w-3.5 h-3.5" />
                    {formatTime(selectedShiftDetails.clockIn)} - {formatTime(selectedShiftDetails.clockOut)}
                  </p>
                </div>
              </div>

              {selectedShiftDetails.notes && (
                <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20">
                  <span className="block text-[11px] font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">
                    Notes
                  </span>
                  <p className="text-[13px] text-on-surface italic leading-relaxed">
                    {selectedShiftDetails.notes}
                  </p>
                </div>
              )}

              {onNavigate && (
                <button
                  onClick={() => {
                    setSelectedShiftDetails(null);
                    onNavigate('month');
                  }}
                  className="w-full py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-full font-bold text-[13px] transition-colors flex items-center justify-center gap-1.5"
                >
                  <CalendarDays className="w-4 h-4" /> Open in Monthly Calendar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
