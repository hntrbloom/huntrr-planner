import { safeGetDoc as getDoc, safeGetDocs as getDocs, safeGetDoc } from '../lib/firebase';
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Pencil, Check, RefreshCw } from 'lucide-react';
import { db } from '../lib/firebase';
import { getGrayscalePalette } from '../lib/colors';
import { doc, setDoc, collection, query, orderBy } from '../lib/workspaceStore';
import { useAuth } from '../lib/AuthContext';
import { SyncStatus } from './SyncStatus';
import { FocusSession } from './FocusTimer';
import { Clock } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export type Habit = {
  id: string;
  name: string;
  category: string;
  timeOfDay: 'daily' | 'multiple-times-daily' | 'weekly' | 'monthly' | 'as-needed';
  scheduledDays: number[];
  reminderTime?: string;
  createdAt: string;
  order: number;
  type?: 'standard' | 'medication';
  notes?: string;
  completions: {
    [date: string]: any;
  };
};

export type Category = {
  id: string;
  name: string;
  color?: string;
};

const defaultHabits: Habit[] = [];





function getLatestCompletion(habit: any) {
  const dates = Object.keys(habit.completions || {}).filter(d => habit.completions[d]);
  if (dates.length === 0) return null;
  
  let latestStr = null;
  let latestTime = 0;
  
  for (const d of dates) {
    const val = habit.completions[d];
    if (Array.isArray(val) && val.length > 0) {
       const lastInArray = val[val.length - 1];
       const time = new Date(lastInArray).getTime();
       if (time > latestTime) {
         latestTime = time;
         latestStr = lastInArray;
       }
    } else if (typeof val === 'string') {
       const time = new Date(val).getTime();
       if (time > latestTime) {
         latestTime = time;
         latestStr = val;
       }
    } else {
       // fallback for old boolean records
       const time = new Date(d + "T23:59:59").getTime();
       if (time > latestTime) {
         latestTime = time;
         latestStr = d + "T23:59:59";
       }
    }
  }
  return latestStr;
}

function getElapsedTime(lastCompletedStr: string, currentTime: Date) {
  if (!lastCompletedStr) return "Not completed yet";
  
  const lastCompleted = new Date(lastCompletedStr);
  const diffMs = currentTime.getTime() - lastCompleted.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `Last completed ${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  if (diffHours < 24) return `Last completed ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  
  const yesterday = new Date(currentTime);
  yesterday.setDate(yesterday.getDate() - 1);
  if (lastCompleted.getDate() === yesterday.getDate() && lastCompleted.getMonth() === yesterday.getMonth() && lastCompleted.getFullYear() === yesterday.getFullYear()) {
    return "Last completed yesterday";
  }

  return `Last completed ${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
}

function CategoryNotepad({ category, isSelected, onClick, onEdit, bgColor, textColor }: any) {
  return (
    <div
      onClick={onClick} role="button" tabIndex={0} aria-pressed={isSelected}
      onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onClick(); } }}
      style={{ backgroundColor: bgColor }}
      className={`group relative shrink-0 min-w-[130px] sm:min-w-[148px] max-w-[200px] h-16 sm:h-16 px-2.5 py-1.5 rounded-sm shadow-sm border-[2px] border-gray-400 flex items-center justify-center cursor-pointer transition-transform hover:-translate-y-1 ${isSelected ? 'ring-2 ring-[#666666] ring-offset-2 scale-105' : ''}`}
    >
      <div className="absolute -top-3 right-4 w-3 h-7 border-[2px] border-gray-400 rounded-full bg-transparent rotate-[15deg] shadow-[1px_1px_1px_rgba(0,0,0,0.1)] z-10 pointer-events-none"></div>
      <div className="absolute top-1 left-1.5 w-1.5 h-1.5 rounded-full bg-black/15 shadow-inner pointer-events-none"></div>
      <div className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-black/15 shadow-inner pointer-events-none"></div>
      <div className="absolute bottom-1 left-1.5 w-1.5 h-1.5 rounded-full bg-black/15 shadow-inner pointer-events-none"></div>
      <div className="absolute bottom-1 right-1.5 w-1.5 h-1.5 rounded-full bg-black/15 shadow-inner pointer-events-none"></div>
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(transparent 90%, rgba(0,0,0,0.1) 90%)', backgroundSize: '100% 16px' }}></div>
      <div className="absolute inset-0 pointer-events-none bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      
      <div className={`flex items-center justify-center w-full px-1.5 ${onEdit ? 'pr-5' : ''} overflow-hidden`}>
        <span 
          className="font-bold text-[11px] sm:text-[12px] leading-tight text-center relative break-words uppercase tracking-wide z-10 line-clamp-2 max-w-full" 
          style={{ color: textColor }}
          title={category}
        >
          {category}
        </span>
      </div>

      {onEdit && (
        <button 
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(); }} 
          className="absolute bottom-0.5 right-0.5 p-1 hover:bg-black/10 rounded-full transition-colors z-20"
          title="Edit Category"
        >
          <Pencil className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-black/50" />
        </button>
      )}
    </div>
  );
}

function getLocalTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function calculateStreaks(habit: Habit, todayStr: string) {
  let currentStreak = 0;
  let bestStreak = 0;
  let total = 0;
  
  // Sort dates
  const dates = Object.keys(habit.completions || {}).filter(d => habit.completions[d]).sort();
  total = dates.length;

  if (dates.length === 0) return { currentStreak, bestStreak, total };

  // Calculate best streak
  let currentRun = 1;
  bestStreak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(dates[i-1]);
    const currDate = new Date(dates[i]);
    const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Check if the days between prevDate and currDate were scheduled
    let isContinuous = true;
    for (let d = 1; d < diffDays; d++) {
       const checkDate = new Date(prevDate.getTime() + d * 86400000);
       if ((habit.scheduledDays || []).includes(checkDate.getDay())) {
         isContinuous = false;
         break;
       }
    }

    if (diffDays === 1 || isContinuous) {
      currentRun++;
      if (currentRun > bestStreak) bestStreak = currentRun;
    } else {
      currentRun = 1;
    }
  }

  // Calculate current streak backwards from today or yesterday
  currentRun = 0;
  let checkDate = new Date(todayStr + "T12:00:00");
  // if today is not completed, we start checking from yesterday if today was scheduled
  
  let continueChecking = true;
  let firstCheck = true;
  
  while (continueChecking) {
    const dStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    const isScheduled = (habit.scheduledDays || []).includes(checkDate.getDay());
    const isCompleted = habit.completions && habit.completions[dStr];

    if (isCompleted) {
      currentRun++;
    } else if (isScheduled) {
      if (firstCheck && dStr === todayStr) {
        // missing today doesn't break streak yet
      } else {
        break; // Streak broken
      }
    }
    
    firstCheck = false;
    checkDate.setDate(checkDate.getDate() - 1);
    
    // Safety break
    if (currentRun > 10000) break;
  }

  return { currentStreak: currentRun, bestStreak, total };
}


function SortableHabitItem({ habit, todayStr, viewMode, last7Days, toggleHabit, deleteHabit, editHabit, currentTime, categoryColor }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: habit.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };
  
  const isMedication = habit.type === 'medication';
  const isMultipleTimes = isMedication || habit.timeOfDay === 'multiple-times-daily';
  let isCompletedToday = false;
  let dosesToday = 0;
  
  if (isMultipleTimes) {
     const val = habit.completions?.[todayStr];
     if (Array.isArray(val)) {
        dosesToday = val.length;
        isCompletedToday = dosesToday > 0;
     } else if (val) {
        dosesToday = 1;
        isCompletedToday = true;
     }
  } else {
     isCompletedToday = !!habit.completions?.[todayStr];
  }
  
  const { currentStreak, bestStreak, total } = calculateStreaks(habit, todayStr);
  const latestCompletionStr = getLatestCompletion(habit);
  const timeSinceText = latestCompletionStr ? getElapsedTime(latestCompletionStr, currentTime) : "Not completed yet";
  const exactTimeText = latestCompletionStr ? `Completed ${new Date(latestCompletionStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${new Date(latestCompletionStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : "";

  return (
    <div ref={setNodeRef} style={style} className={`bg-white rounded-sm shadow-md border-[2px] border-gray-400 flex flex-col relative group transition-all ${isDragging ? 'shadow-lg ring-2 ring-primary scale-[1.02]' : 'hover:-translate-y-1'}`}>
      <div className="absolute -top-3 right-4 w-3 h-7 border-[2px] border-gray-400 rounded-full bg-transparent rotate-[15deg] shadow-[1px_1px_1px_rgba(0,0,0,0.1)] z-10 pointer-events-none"></div>
      
      {/* Header */}
      <div className="px-4 py-4 border-b-[2px] border-black/5 flex items-start gap-3 transition-colors" style={{ backgroundColor: isCompletedToday ? '#f3f4f6' : (categoryColor?.bg || '#FFF0F4') }}>
        <div {...attributes} {...listeners} className="cursor-grab pt-1 text-black/30 hover:text-black/60 touch-none">
           <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M4 6h2v2H4zm0 6h2v-2H4zm6-8H8v2h2zm0 6H8v-2h2z"/></svg>
        </div>
        
        <div className="flex-1 min-w-0 pr-2">
          <p className={`text-[17px] leading-[1.2] font-semibold text-[#1c1b1d] ${isCompletedToday ? 'opacity-60 line-through' : ''}`}>{habit.name}</p>
          {isMedication && habit.notes && <p className="text-xs text-[#555555] mt-1 line-clamp-2">{habit.notes}</p>}
        </div>

        <button
          type="button"
          aria-label={`${isCompletedToday ? 'Update check-in for' : 'Check in'} ${habit.name}`}
          aria-pressed={isCompletedToday}
          onClick={(e) => { e.stopPropagation(); toggleHabit(habit.id); }}
          className={`shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${
            isCompletedToday
              ? 'bg-primary border-primary text-white shadow-sm'
              : 'bg-white border-black/30 hover:border-black/60 shadow-sm'
          }`}
        >
          {isCompletedToday && (
            <Check className="w-5 h-5 text-white shrink-0" strokeWidth={3} />
          )}
        </button>
      </div>

      {/* Body / Lined Paper */}
      <div className="p-4 flex-1 bg-white lined-paper relative min-h-[100px]">
        <div className="space-y-3 relative z-10 flex flex-col h-full">
          {/* Metadata */}
          <div className="flex flex-wrap gap-2 text-[11px] font-bold text-[#555555]">
            <span className="uppercase tracking-wider px-2 py-0.5 bg-black/5 border border-black/5 rounded-md text-[#333333]">
               {habit.timeOfDay === 'multiple-times-daily' ? 'Multiple times daily' : habit.timeOfDay}
            </span>
            {isMedication && habit.reminderTime && <span className="uppercase tracking-wider px-2 py-0.5 text-primary border border-primary/20 bg-primary/5 rounded-md">Reminder: {habit.reminderTime}</span>}
            <span className="uppercase tracking-wider px-2 py-0.5 bg-black/5 border border-black/5 rounded-md text-[#333333]">Streak: {currentStreak}</span>
          </div>

          <div className="text-xs text-[#777777] font-medium" title={exactTimeText}>
            {latestCompletionStr ? (
              <span className="text-primary/90 font-bold">Last: {new Date(latestCompletionStr).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
            ) : "Not completed yet"}
          </div>

          <div className="flex-1"></div>

          {/* Multiple Times Doses Actions */}
          {isMultipleTimes && (
             <div className="flex flex-wrap items-center gap-2 mt-2">
               {!isCompletedToday ? (
                 <button onClick={(e) => { e.stopPropagation(); toggleHabit(habit.id); }} className="bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-full hover:bg-primary-dark transition-colors shadow-sm">
                   {isMedication ? 'Mark as Taken' : 'Mark as Done'}
                 </button>
               ) : (
                 <div className="flex gap-2">
                   <button onClick={(e) => { e.stopPropagation(); toggleHabit(habit.id, todayStr, false); }} className="bg-black/5 text-black/70 hover:bg-rose-100 hover:text-rose-600 text-xs font-bold px-3 py-1.5 rounded-full transition-colors border border-black/10">
                     {isMedication ? 'Undo' : 'Undo'}
                   </button>
                   <button onClick={(e) => { e.stopPropagation(); toggleHabit(habit.id, todayStr, true); }} className="bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 text-xs font-bold px-3 py-1.5 rounded-full transition-colors">
                     {isMedication ? '+ Dose' : '+ Do Again'}
                   </button>
                 </div>
               )}
               {dosesToday > 0 && (
                 <span className="text-[11px] font-bold text-primary ml-1 uppercase tracking-wider">
                   {dosesToday} {isMedication ? `taken` : `done`}
                 </span>
               )}
             </div>
          )}

          {/* Weekly view circles */}
          {viewMode === 'weekly' && (
            <div className="mt-4 pt-4 border-t border-dashed border-black/15 flex justify-between items-center px-1">
              {last7Days.map((d: string) => {
                const dObj = new Date(d + "T12:00:00");
                const scheduled = (habit.scheduledDays || []).includes(dObj.getDay());
                const completed = habit.completions?.[d] || false;
                return (
                  <div key={d} className="flex flex-col items-center gap-1.5">
                    <span className="text-[9px] uppercase font-bold text-black/40">{dObj.toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
                    <div 
                      className={`w-5 h-5 shrink-0 rounded-full border-[1.5px] flex items-center justify-center ${completed ? 'bg-primary border-primary' : scheduled ? 'border-black/20 bg-white' : 'border-transparent bg-black/5'}`}
                    >
                      {!!completed && <Check className="w-3.5 h-3.5 text-white shrink-0" strokeWidth={3} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Actions (Edit/Delete) */}
        <div className="absolute bottom-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <button
             aria-label={`Edit ${habit.name}`}
             onClick={(e) => { e.stopPropagation(); editHabit(habit); }}
             className="p-1.5 bg-white text-black/40 hover:text-primary hover:bg-primary/10 rounded-full shadow-sm border border-black/10 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
             aria-label={`Delete ${habit.name}`}
             onClick={(e) => { e.stopPropagation(); deleteHabit(habit.id); }}
             className="p-1.5 bg-white text-black/40 hover:text-rose-600 hover:bg-rose-50 rounded-full shadow-sm border border-black/10 hover:border-rose-200 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function HabitsView() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{id: string, name: string} | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatColor, setEditCatColor] = useState('');
  const [editCatHabits, setEditCatHabits] = useState<{id: string, name: string, isNew?: boolean, deleted?: boolean}[]>([]);
  const todayStr = getLocalTodayStr();
  const [inlineEditCatId, setInlineEditCatId] = useState<string | null>(null);
  const [inlineEditCatName, setInlineEditCatName] = useState('');
  const [inlineEditStatus, setInlineEditStatus] = useState<'idle'|'saving'|'success'|'error'>('idle');
  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || id;
  const handleInlineSaveCategory = async () => {
     if (!inlineEditCatId) return;
     const trimmed = inlineEditCatName.trim();
     if (!trimmed) {
       setInlineEditStatus('error');
       setTimeout(() => setInlineEditStatus('idle'), 3000);
       return;
     }
     if (categories.some(c => (c.name || '').toLowerCase() === trimmed.toLowerCase() && c.id !== inlineEditCatId)) {
       setInlineEditStatus('error');
       setTimeout(() => setInlineEditStatus('idle'), 3000);
       return;
     }
     const newCats = categories.map(c => c.id === inlineEditCatId ? { ...c, name: trimmed } : c);
     try {
       await saveHabits(habits, newCats);
       setInlineEditStatus('success');
       setTimeout(() => {
         setInlineEditStatus('idle');
         setInlineEditCatId(null);
       }, 2000);
     } catch (e) {
       setInlineEditStatus('error');
       setTimeout(() => setInlineEditStatus('idle'), 3000);
     }
  };
  const [viewMode, setViewMode] = useState<'today' | 'weekly'>('today');
  const [showFocusTimer, setShowFocusTimer] = useState(false);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);

  
  useEffect(() => {
    const handleSessionSaved = (e: any) => {
      setFocusSessions(prev => [...prev, e.detail]);
    };
    window.addEventListener('focus-session-saved', handleSessionSaved);
    return () => window.removeEventListener('focus-session-saved', handleSessionSaved);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      const currentCatHabits = habits.filter(h => h.category === selectedCategoryId).sort((a,b) => a.order - b.order);
      const oldIndex = currentCatHabits.findIndex(h => h.id === active.id);
      const newIndex = currentCatHabits.findIndex(h => h.id === over.id);
      
      const newCatHabits = arrayMove(currentCatHabits, oldIndex, newIndex) as Habit[];
      
      newCatHabits.forEach((h, i) => h.order = i);
      
      const newHabits = habits.map(h => {
         const updated = newCatHabits.find(n => n.id === h.id);
         return updated ? updated : h;
      });
      saveHabits(newHabits);
    }
  }

  const [currentTime, setCurrentTime] = useState(new Date());


  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      if (user.isAnonymous) {
        setHabits([
          {
            id: 'guest-h-1',
            name: 'Sketch Daily Design Idea',
            category: 'cat-1',
            timeOfDay: 'daily',
            scheduledDays: [0,1,2,3,4,5,6],
            createdAt: new Date().toISOString(),
            order: 0,
            completions: {
              [todayStr]: [new Date().toISOString()]
            }
          },
          {
            id: 'guest-h-2',
            name: 'Drink 2L Water',
            category: 'cat-2',
            timeOfDay: 'daily',
            scheduledDays: [0,1,2,3,4,5,6],
            createdAt: new Date().toISOString(),
            order: 1,
            completions: {
              [todayStr]: [new Date().toISOString()]
            }
          }
        ]);
        setCategories([
          { id: 'cat-1', name: 'Creative' },
          { id: 'cat-2', name: 'Health' }
        ]);
        setSelectedCategoryId('cat-1');
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, `users/${user.uid}/preferences`, 'habitsData');
        const snap = await safeGetDoc(docRef);
        
        const focusDocRef = doc(db, `users/${user.uid}/preferences`, 'focusData');
        const focusSnap = await safeGetDoc(focusDocRef);
        if (focusSnap.exists()) {
          setFocusSessions(focusSnap.data().sessions || []);
        }

        let loadedHabits = [];
        let loadedCategories = [];
        let hasData = false;

        if (snap.exists() && snap.data().habits) {
          loadedHabits = snap.data().habits || [];
          loadedCategories = snap.data().categories || [];
          hasData = true;
        }
        
        if (!hasData || loadedHabits.length === 0) {
           try {
             const rootRef = doc(db, 'users', user.uid);
             const rootSnap = await safeGetDoc(rootRef);
             if (rootSnap.exists() && rootSnap.data().habits) {
               loadedHabits = rootSnap.data().habits;
               loadedCategories = rootSnap.data().habitCategories || rootSnap.data().categories || [];
               hasData = true;
             }
           } catch(e) {}
        }

        if (hasData) {
          
          setHabits(loadedHabits);
          setCategories(loadedCategories);
          setSelectedCategoryId(previous => loadedCategories.some((c: any) => c.id === previous) ? previous : loadedCategories[0]?.id || '');
        } else {
          // Initialize
          setHabits(defaultHabits);
        }
      } catch (err: any) { setLoadError(err.message || 'Failed to load data.'); 
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const saveHabits = async (newHabits: Habit[], newCategories = categories) => {
    // Strip undefined values to avoid Firestore errors
    const cleanedHabits = newHabits.map(h => {
        const clean: any = { ...h };
        if (clean.reminderTime === undefined) delete clean.reminderTime;
        if (clean.notes === undefined) delete clean.notes;
        if (clean.type === undefined) delete clean.type;
        return clean as Habit;
    });
    setHabits(cleanedHabits);
    setCategories(newCategories);
    if (user && !user.isAnonymous) {
      const docRef = doc(db, `users/${user.uid}/preferences`, 'habitsData');
      await setDoc(docRef, { habits: cleanedHabits, categories: newCategories }, { merge: true });
    }
  };

  const toggleHabit = (id: string, date: string = todayStr, isAdditionalDose: boolean = false) => {
    const newHabits = habits.map(h => {
      if (h.id === id) {
        const current = h.completions?.[date];
        const newCompletions = { ...(h.completions || {}) };
        
        if (h.type === 'medication' || h.timeOfDay === 'multiple-times-daily') {
           let doses = Array.isArray(current) ? [...current] : (current ? [current] : []);
           if (isAdditionalDose) {
              doses.push(new Date().toISOString());
           } else {
              if (doses.length > 0) {
                 doses.pop(); // Undo last completion
              } else {
                 doses.push(new Date().toISOString());
              }
           }
           if (doses.length === 0) {
              delete newCompletions[date];
           } else {
              newCompletions[date] = doses;
           }
        } else {
           if (current) {
             delete newCompletions[date];
           } else {
             newCompletions[date] = new Date().toISOString();
           }
        }
        
        return {
          ...h,
          completions: newCompletions
        };
      }
      return h;
    });
    saveHabits(newHabits);
  };

  const deleteHabit = (id: string) => {
    if(confirm('Delete this habit?')) {
       saveHabits(habits.filter(h => h.id !== id));
    }
  };

  // Add Habit form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHabit, setNewHabit] = useState<Partial<Habit>>({ name: '', timeOfDay: 'daily', scheduledDays: [0,1,2,3,4,5,6], type: 'standard' });

  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);

  const editHabit = (habit: Habit) => {
    setEditingHabitId(habit.id);
    setNewHabit({
      name: habit.name, category: habit.category,
      timeOfDay: habit.timeOfDay,
      scheduledDays: habit.scheduledDays,
    });
    setShowAddForm(true);
  };


  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabit.name) return;
    
    if (editingHabitId) {
      const newHabits = habits.map(h => {
        if (h.id === editingHabitId) {
          return {
            ...h,
            name: newHabit.name || h.name,
            timeOfDay: newHabit.timeOfDay || h.timeOfDay,
            scheduledDays: newHabit.scheduledDays || h.scheduledDays,
            type: newHabit.type || h.type,
            reminderTime: newHabit.reminderTime || h.reminderTime,
            notes: newHabit.notes || h.notes
          };
        }
        return h;
      });
      saveHabits(newHabits);
      setEditingHabitId(null);
    } else {
      const habit: Habit = {
        id: Date.now().toString(),
        name: newHabit.name,
        category: newHabit.category || selectedCategoryId,
        timeOfDay: newHabit.timeOfDay || 'daily',
        scheduledDays: newHabit.scheduledDays || [0,1,2,3,4,5,6],
        type: newHabit.type || 'standard',
        createdAt: new Date().toISOString(),
        order: habits.length,
        completions: {}
      };
      if (newHabit.reminderTime) habit.reminderTime = newHabit.reminderTime;
      if (newHabit.notes) habit.notes = newHabit.notes;
      saveHabits([...habits, habit]);
    }
    setShowAddForm(false);
    setNewHabit({ name: '', timeOfDay: 'daily', scheduledDays: [0,1,2,3,4,5,6] });
  };

  // Filter and sort habits
  const currentCategoryHabits = habits.filter(h => h.category === selectedCategoryId).sort((a, b) => {
    const frequencyOrder = { 'multiple-times-daily': 1, 'daily': 2, 'weekly': 3, 'monthly': 4, 'as-needed': 5 } as Record<string, number>;
    if (frequencyOrder[a.timeOfDay] !== frequencyOrder[b.timeOfDay]) {
      return (frequencyOrder[a.timeOfDay] || 5) - (frequencyOrder[b.timeOfDay] || 5);
    }
    return a.order - b.order;
  });

  const scheduledToday = currentCategoryHabits.filter(h => (h.scheduledDays || []).includes(new Date().getDay()));
  const allScheduledToday = habits.filter(h => (h.scheduledDays || []).includes(new Date().getDay()));
  const completedTodayCount = allScheduledToday.filter(h => h.completions?.[todayStr]).length;

  const catIndex = Math.max(0, categories.findIndex(c => c.id === selectedCategoryId));
  const selCat = categories.find(c => c.id === selectedCategoryId);
  const palette = getGrayscalePalette(categories.length);
  const selectedColor = palette[catIndex] || palette[0] || { bg: '#F5F5F5', text: '#222222' };

  const last7Days = Array.from({length: 7}).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }).reverse();

  return (
    <main className="flex-1 md:overflow-y-auto px-margin-mobile md:px-margin-desktop py-6 md:py-8 pb-safe-nav bg-transparent">
      <div className="w-full bg-surface-container-lowest border border-outline-variant/20 shadow-md rounded-xl min-h-[1200px] relative flex flex-col overflow-hidden mb-8">
        {/* Notebook Margin Line */}
        <div className="absolute left-14 md:left-24 top-0 bottom-0 w-[2px] bg-primary/20 z-0"></div>
        <div className="absolute left-[52px] md:left-[92px] top-0 bottom-0 w-[1px] bg-primary/10 z-0"></div>

        <div className="flex-1 lined-paper relative z-10 px-4 md:px-8 pt-8 pb-safe-nav">
          <div className="pl-14 md:pl-24 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-[28px] md:text-[36px] font-bold font-headline-lg-mobile md:font-headline-lg text-on-surface mb-2 tracking-tight">
                  Habit Tracker
                </h1>
                <h2 className="text-[20px] md:text-[24px] leading-[1.2] font-semibold text-on-surface-variant">
                  {currentTime.toLocaleDateString('en-US', { month: 'long', day: 'numeric', weekday: 'long' })}
                </h2>
              </div>
              <button 
                aria-label="Open focus timer"
                onClick={() => window.dispatchEvent(new CustomEvent('open-focus-timer'))}
                className="flex items-center gap-2 bg-white/60 hover:bg-white/90 p-3 rounded-xl border border-outline-variant/30 shadow-sm transition-colors text-on-surface z-20"
              >
                <Clock className="w-5 h-5 text-primary" />
                <span className="font-semibold text-sm hidden sm:inline">Focus Timer</span>
              </button>
            </div>

            {/* Progress */}
            <div className="mt-6 inline-flex items-center gap-4 bg-white/60 p-4 rounded-xl border border-outline-variant/30">
              <div className="relative w-12 h-12 flex items-center justify-center">
                 <svg className="w-full h-full transform -rotate-90">
                    <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-outline-variant/30" />
                    <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray={125.6} strokeDashoffset={allScheduledToday.length > 0 ? 125.6 - (completedTodayCount / allScheduledToday.length) * 125.6 : 125.6} className="text-primary transition-all duration-500" />
                 </svg>
                 <span className="absolute text-[12px] font-bold">{allScheduledToday.length > 0 ? Math.round((completedTodayCount/allScheduledToday.length)*100) : 0}%</span>
              </div>
              <div>
                <p className="text-[18px] font-semibold text-on-surface">{completedTodayCount} of {allScheduledToday.length} completed</p>
                <p className="text-[14px] text-on-surface-variant">habits scheduled for today</p>
              </div>
            </div>
            
            {/* View Mode Toggle */}
            <div className="mt-6 flex gap-2">
               <button onClick={() => setViewMode('today')} className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${viewMode === 'today' ? 'bg-primary text-on-primary' : 'bg-white/50 text-on-surface hover:bg-white/80'}`}>Today</button>
               <button onClick={() => setViewMode('weekly')} className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${viewMode === 'weekly' ? 'bg-primary text-on-primary' : 'bg-white/50 text-on-surface hover:bg-white/80'}`}>Weekly History</button>
            </div>
            
            {viewMode === 'weekly' && (
              <div className="mt-6 flex flex-wrap gap-4">
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex-1 min-w-[200px] shadow-sm">
                  <p className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Weekly Focus Time</p>
                  <p className="text-3xl font-bold text-primary">
                    {(focusSessions || []).filter(s => s && s.date && (last7Days || []).includes(s.date)).reduce((acc, s) => acc + (s.actualDurationMinutes || s.durationMinutes || 0), 0)} <span className="text-xl font-semibold text-primary/70">mins</span>
                  </p>
                  <p className="text-sm text-on-surface-variant mt-1 font-medium">
                    {(focusSessions || []).filter(s => s && s.date && (last7Days || []).includes(s.date)).length} sessions completed
                  </p>
                </div>
              </div>
            )}
          </div>

          {loadError && (
  <div className="pl-14 md:pl-24 pr-4 md:pr-12 mt-8">
    <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-200 shadow-sm flex flex-col items-start gap-4">
      <h3 className="font-bold text-lg">Error loading planner data</h3>
      <p className="font-medium">{loadError}</p>
      <p className="text-sm">We stopped loading to prevent overwriting your existing data. Please refresh the page.</p>
      <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-sm transition-colors">Refresh Page</button>
    </div>
  </div>
)}
{!loading && !loadError && (
            <div className="pl-14 md:pl-24 pr-4 md:pr-12 flex flex-col gap-8">
              {/* Category Notepads */}
              <div className="w-full py-4 -my-4">
                <div className="flex flex-wrap gap-4 px-4 py-6">
                  {categories.map((cat, index) => {
                    const padColor = palette[index] || palette[0] || { bg: '#F5F5F5', text: '#222222' };
                    return (
                      <CategoryNotepad 
                         key={cat.id}
                        category={cat.name}
                        bgColor={padColor.bg}
                        textColor={padColor.text}
                        isSelected={selectedCategoryId === cat.id}
                        onClick={() => setSelectedCategoryId(cat.id)}
                        onEdit={() => {
                          setEditingCategory(cat);
                          setEditCatName(cat.name);

                          setEditCatHabits(habits.filter(h => h.category === cat.id).map(h => ({ id: h.id, name: h.name })));
                          setShowCategoryManager(true);
                        }}
                      />
                    );
                  })}
                  
                  <button
                    onClick={() => {
                      setEditCatName('');
                      setEditingCategory(null);

                      setEditCatHabits([]);
                      setShowCategoryManager(true);
                    }}
                    className="flex shrink-0 items-center justify-center gap-2 px-5 w-32 sm:w-36 h-16 sm:h-16 rounded-sm shadow-sm border-2 border-dashed border-outline-variant/40 hover:-translate-y-1 bg-surface-container-lowest hover:bg-surface-container-low transition-transform text-on-surface-variant text-xs font-semibold self-center"
                  >
                    <Plus className="w-4 h-4" /> Add Category
                  </button>
                </div>
              </div>

              {/* Large Selected Category Notepad */}
              {categories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <p className="text-[20px] text-black/50 font-medium mb-6">No habit categories yet.</p>
                  <button 
                    onClick={() => {
                      setEditCatName('');
                      setEditingCategory(null);
                      setShowCategoryManager(true);
                    }}
                    className="flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-primary text-on-primary font-semibold transition-colors shadow-sm hover:shadow-md"
                  >
                    <Plus className="w-5 h-5" /> Add Category
                  </button>
                </div>
              ) : (
                <div className="relative z-10 flex flex-col h-full mt-4 md:mt-8 pb-12">
                  <div className="flex flex-col items-start md:items-center mb-10">
                    <div className="flex items-center gap-3">
                      {inlineEditCatId === selectedCategoryId ? (
                        <div className="flex flex-col items-center">
                          <div className="flex items-center gap-2">
                            <input 
                              type="text" 
                              value={inlineEditCatName} 
                              onChange={e => setInlineEditCatName(e.target.value)} 
                              onKeyDown={e => { if(e.key === 'Enter') handleInlineSaveCategory(); else if(e.key === 'Escape') { setInlineEditCatId(null); setInlineEditStatus('idle'); } }}
                              autoFocus
                              className="text-[28px] md:text-[36px] font-bold text-black/70 uppercase tracking-widest text-center border-b-2 border-primary outline-none bg-transparent"
                            />
                            <button onClick={handleInlineSaveCategory} className="p-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors">{user?.isAnonymous ? 'Test Save' : 'Save'}</button>
                            <button onClick={() => { setInlineEditCatId(null); setInlineEditStatus('idle'); }} className="p-2 bg-black/10 text-black/60 rounded hover:bg-black/20 transition-colors">Cancel</button>
                          </div>
                          {inlineEditStatus === 'success' && <p className="text-green-600 text-sm font-bold mt-2">Saved successfully!</p>}
                          {inlineEditStatus === 'error' && <p className="text-red-500 text-sm font-bold mt-2">Error saving or invalid name.</p>}
                        </div>
                      ) : (
                        <div className="group flex items-center gap-3 relative pb-2 border-b-[3px] border-black/10 px-0 md:px-8">
                          <h3 className="text-[28px] md:text-[36px] font-bold text-black/70 uppercase tracking-widest text-center">{getCategoryName(selectedCategoryId)}</h3>
                          <button aria-label="Rename habit category" onClick={() => { setInlineEditCatId(selectedCategoryId); setInlineEditCatName(getCategoryName(selectedCategoryId)); setInlineEditStatus('idle'); }} className="p-2 text-black/30 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors md:absolute md:-right-10 opacity-100 md:opacity-0 group-hover:opacity-100 focus:opacity-100">
                            <Pencil className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 w-full">
                    {currentCategoryHabits.length === 0 && !showAddForm && (
                      <div className="col-span-full flex items-center justify-center py-12">
                        <p className="text-[18px] text-black/40 italic font-medium">No habits in {getCategoryName(selectedCategoryId)} yet.</p>
                      </div>
                    )}
                    
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={currentCategoryHabits.map(h => h.id)} strategy={rectSortingStrategy}>
                        {currentCategoryHabits.map(habit => (
                          <SortableHabitItem currentTime={currentTime} 
                            key={habit.id} 
                            habit={habit} 
                            categoryColor={selectedColor}
                            todayStr={todayStr} 
                            viewMode={viewMode} 
                            last7Days={last7Days} 
                            toggleHabit={toggleHabit} 
                            deleteHabit={deleteHabit} editHabit={editHabit} 
                          />
                        ))}
                      </SortableContext>
                    </DndContext>

                    {/* Add Form Toggle */}
                    <div className="col-span-1">
                    {!showAddForm ? (
                      <button onClick={() => setShowAddForm(true)} className="flex flex-col items-center justify-center gap-2 p-8 w-full h-full min-h-[200px] rounded-sm border-[2px] border-dashed border-gray-400/50 bg-white/50 hover:bg-white text-black/60 font-semibold transition-colors shadow-sm">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-primary shadow-sm border border-gray-200 mb-4">
                          <Plus className="w-6 h-6" />
                        </div>
                        Add New Habit
                      </button>
                    ) : (
                      <form onSubmit={handleAddSubmit} className="p-5 rounded-sm border-[2px] border-gray-400 bg-white shadow-md flex flex-col gap-4 relative">
                        <h4 className="font-bold text-black/70">{editingHabitId ? `Edit Habit` : `Add New Habit to ${getCategoryName(selectedCategoryId)}`}</h4>
                        <input 
                          type="text" 
                          autoFocus
                          aria-label="Habit name"
                          placeholder="Habit name..." 
                          className="bg-transparent border-b-2 border-black/20 p-2 outline-none focus:border-black/50 font-medium text-[16px]"
                          value={newHabit.name || ''}
                          onChange={e => setNewHabit({...newHabit, name: e.target.value})}
                        />

                        <div className="flex gap-4 items-center">
                          <label className="text-sm font-medium text-black/60">Type:</label>
                          <select aria-label="Habit type" className="bg-white border border-black/20 rounded p-1 outline-none text-black/80 flex-1" value={newHabit.type || 'standard'} onChange={e => setNewHabit({...newHabit, type: e.target.value as any})}>
                            <option value="standard">Standard Habit</option>
                            <option value="medication">Medication</option>
                          </select>
                        </div>
                        {newHabit.type === 'medication' && (
                          <>
                            <div className="flex gap-4 items-center">
                              <label className="text-sm font-medium text-black/60">Time:</label>
                              <input type="time" className="bg-white border border-black/20 rounded p-1 outline-none text-black/80 flex-1" value={newHabit.reminderTime || ''} onChange={e => setNewHabit({...newHabit, reminderTime: e.target.value})} />
                            </div>
                            <div className="flex flex-col gap-1 items-start">
                              <label className="text-sm font-medium text-black/60 mt-1">Notes (Optional):</label>
                              <textarea className="w-full bg-white border border-black/20 rounded p-2 outline-none text-black/80 flex-1 min-h-[60px]" value={newHabit.notes || ''} onChange={e => setNewHabit({...newHabit, notes: e.target.value})} placeholder="e.g., Take with food" />
                            </div>
                          </>
                        )}
                        <div className="flex gap-4 items-center">
                          <label className="text-sm font-medium text-black/60">Cat:</label>
                          <select aria-label="Habit category" className="bg-white border border-black/20 rounded p-1 outline-none text-black/80 flex-1" value={newHabit.category || selectedCategoryId} onChange={e => setNewHabit({...newHabit, category: e.target.value})}>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1 items-start">
                          <label className="text-sm font-medium text-black/60">How often:</label>
                          <select aria-label="Habit frequency" className="w-full bg-white border border-black/20 rounded p-1 outline-none text-black/80" value={newHabit.timeOfDay} onChange={e => setNewHabit({...newHabit, timeOfDay: e.target.value as any})}>
                            <option value="daily">Daily</option>
                            <option value="multiple-times-daily">Multiple times daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="as-needed">As Needed</option>
                          </select>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 mt-4">
                           <button type="submit" className="flex-1 bg-black/80 text-white px-4 py-2 rounded-lg font-semibold hover:bg-black transition-colors">{user?.isAnonymous ? 'Test Save' : 'Save Habit'}</button>
                           <button type="button" onClick={() => { setShowAddForm(false); setEditingHabitId(null); setNewHabit({ name: '', timeOfDay: 'daily', scheduledDays: [0,1,2,3,4,5,6] }); }} className="flex-1 px-4 py-2 rounded-lg font-semibold text-black/50 border border-black/10 hover:bg-black/10 transition-colors">Cancel</button>
                        </div>
                      </form>
                    )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showCategoryManager && (
        <div role="dialog" aria-modal="true" aria-label="Habits dialog" tabIndex={-1} className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl max-w-sm w-full p-6 flex flex-col gap-4 border border-outline-variant/20 max-h-[90vh]">
            <h3 className="text-xl font-bold text-on-surface">
              {editingCategory ? 'Edit Category' : 'Add Category'}
            </h3>
            
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider">Name</label>
              <input 
                type="text" 
                autoFocus
                placeholder="Category Name" 
                value={editCatName}
                onChange={e => setEditCatName(e.target.value)}
                onKeyDown={(e) => { 
                   if (e.key === 'Enter') {
                     const btn = document.getElementById('save-category-btn');
                     if (btn) btn.click();
                   }
                }}
                className="w-full px-4 py-3 rounded-xl border-2 border-outline-variant/40 bg-transparent text-on-surface focus:border-primary focus:outline-none transition-colors font-medium text-lg"
              />
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <label className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider">Color</label>

            </div>

            {editingCategory && (
              <div className="flex flex-col gap-2 mt-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider">Habits</label>
                  <button 
                    onClick={() => {
                      const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
                      setEditCatHabits([...editCatHabits, { id, name: '', isNew: true }]);
                    }}
                    className="text-primary hover:bg-primary/10 px-2 py-1 rounded flex items-center gap-1 font-semibold text-sm transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add Habit
                  </button>
                </div>
                <div className="flex flex-col gap-2 max-h-48 pr-2">
                  {editCatHabits.filter(h => !h.deleted).length === 0 ? (
                    <p className="text-sm text-on-surface-variant italic py-2">No habits in this category.</p>
                  ) : (
                    editCatHabits.filter(h => !h.deleted).map((h, i) => (
                      <div key={h.id} className="flex gap-2 items-center bg-black/5 p-2 rounded-xl">
                        <input 
                          value={h.name || ''}
                          aria-label="Habit name"
                          placeholder="Habit name..."
                          autoFocus={h.isNew}
                          onChange={(e) => {
                            const newH = [...editCatHabits];
                            const idx = newH.findIndex(x => x.id === h.id);
                            if (idx !== -1) newH[idx].name = e.target.value;
                            setEditCatHabits(newH);
                          }}
                          className="flex-1 bg-transparent border-b-2 border-transparent focus:border-black/20 outline-none text-sm font-medium px-2 py-1"
                        />
                        <button 
                          onClick={() => {
                            const newH = [...editCatHabits];
                            const idx = newH.findIndex(x => x.id === h.id);
                            if (idx !== -1) newH[idx].deleted = true;
                            setEditCatHabits(newH);
                          }} 
                          className="text-error/70 hover:text-error hover:bg-error/10 p-2 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-outline-variant/20">
              {editingCategory && (
                <button 
                  onClick={() => {
                    if (window.confirm(`Delete "${editingCategory.name}"? All habits and history assigned to this category will also be deleted.`)) {
                      const newCats = categories.filter(c => c.id !== editingCategory.id);
                      const newHabits = habits.filter(h => h.category !== editingCategory.id);
                      saveHabits(newHabits, newCats);
                      if (selectedCategoryId === editingCategory.id) {
                         setSelectedCategoryId(newCats.length > 0 ? newCats[0].id : '');
                      }
                      setShowCategoryManager(false);
                    }
                  }}
                  className="px-4 py-2 font-semibold text-error hover:bg-error/10 rounded-xl transition-colors mr-auto"
                >
                  Delete Category
                </button>
              )}
              
              <button 
                onClick={() => setShowCategoryManager(false)}
                className="px-4 py-2 font-semibold text-on-surface-variant hover:bg-on-surface-variant/10 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  try {
                  const trimmed = editCatName.trim();
                  if (!trimmed) return;
                  const safeCategories = Array.isArray(categories) ? categories : [];
                  if (safeCategories.find(c => (c.name || '').toLowerCase() === trimmed.toLowerCase() && c.id !== (editingCategory ? editingCategory.id : undefined))) {
                    setEditCatName(editCatName + ' (Duplicate)');
                    return;
                  }
                  
                                    let newCats;
                  if (editingCategory) {
                    newCats = safeCategories.map(c => c.id === editingCategory.id ? { id: c.id, name: trimmed } : c);
                  } else {
                    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
                    newCats = [...safeCategories, { id, name: trimmed }];
                    setSelectedCategoryId(id);
                  }

                  let newHabits = [...habits];
                  
                  const targetCatId = editingCategory ? editingCategory.id : newCats[newCats.length - 1].id;
                  
                  editCatHabits.forEach(editH => {
                     if (editH.deleted) {
                        newHabits = newHabits.filter(h => h.id !== editH.id);
                     } else if (editH.isNew) {
                        if (editH.name.trim()) {
                          newHabits.push({
                            id: editH.id,
                            name: editH.name.trim(),
                            category: targetCatId,
                            timeOfDay: 'daily',
                            scheduledDays: [0,1,2,3,4,5,6],
                            createdAt: new Date().toISOString(),
                            order: newHabits.filter(h => h.category === targetCatId).length,
                            completions: {}
                          });
                        }
                     } else {
                        const idx = newHabits.findIndex(h => h.id === editH.id);
                        if (idx !== -1 && editH.name.trim()) {
                           newHabits[idx] = { ...newHabits[idx], name: editH.name.trim() };
                        }
                     }
                  });
                  
                                    saveHabits(newHabits, newCats);
                  setShowCategoryManager(false);
                  } catch (e) {
                      console.error('Error saving category:', e);
                      alert('Error saving category: ' + e.message);
                  }
                }}
                id="save-category-btn"
                className="px-6 py-2 font-semibold bg-primary text-on-primary hover:bg-primary/90 rounded-xl transition-colors shadow-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      
    </main>
  );
}