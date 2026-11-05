import { safeGetDoc as getDoc, safeGetDocs as getDocs, safeGetDoc, safeGetDocs } from '../lib/firebase';
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Pencil, Check, X, Calendar as CalendarIcon, Clock, Settings2, Star, PaintBucket, Heart } from 'lucide-react';
import { db } from '../lib/firebase';
import { getGrayscalePalette, lightSurfaceColor } from '../lib/colors';
import { doc, setDoc, collection, query, orderBy, limit, where, documentId } from '../lib/workspaceStore';
import { useAuth } from '../lib/AuthContext';
import { logActivity } from '../lib/activityLogger';
import { SyncStatus } from './SyncStatus';
import { TopBar } from './TopBar';
import { GUEST_SAMPLE_DAILY_LOG_TASKS } from '../lib/guestSampleData';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Category {
  id: string;
  name: string;
  color?: string;
}

interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
  category: string;
  status?: 'todo' | 'in-progress' | 'done';
  dueDate?: string;
  dueTime?: string;
  timeDoneDate?: string;
  timeDoneTime?: string;
  important?: boolean;
}


const PAD_COLORS = ['#FCE4EF', '#FFF5F9', '#FFFFFF', '#F4A7C7', '#E8E3E7'];

interface TaskNotepadProps {
  categoryId: string;
  categoryName: string;
  color: string;
  activeItems: TaskItem[];
  doneItems: TaskItem[];
  openHistory: (id: string) => void;
  activeColorPicker: string | null;
  setActiveColorPicker: (id: string | null) => void;
  handleCategoryColorChange: (id: string, color: string | undefined) => void;
  handleAddSubmit: (text: string, category: string) => void;
  renderTaskItem: (item: TaskItem) => React.ReactNode;
}

// Keep this component's identity stable when the parent clock ticks, so the
// existing inline task entry retains its draft and keyboard focus.
function FullCategoryNotepad({ categoryId, categoryName, color, activeItems, doneItems,
  openHistory, activeColorPicker, setActiveColorPicker, handleCategoryColorChange,
  handleAddSubmit, renderTaskItem }: TaskNotepadProps) {
  const [localInput, setLocalInput] = useState('');
  return (
    <div className="task-notepad relative rounded-sm shadow-md border-[2px] border-gray-400 flex flex-col p-4 sm:p-6 transition-colors duration-300" style={{ backgroundColor: color }}>
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <button
          onClick={() => openHistory(categoryId)}
          className="p-1.5 hover:bg-pink-100/10 rounded-full text-black/40 hover:text-black transition-colors"
          title="History"
        >
          <Clock className="w-4 h-4" />
        </button>
        <div className="relative">
          <button
            aria-label={`Change ${categoryName} colour`}
          onClick={() => setActiveColorPicker(activeColorPicker === categoryId ? null : categoryId)}
            className="p-1.5 hover:bg-pink-100/10 rounded-full text-black/40 hover:text-black transition-colors"
          >
            <PaintBucket className="w-4 h-4" />
          </button>
          {activeColorPicker === categoryId && (
            <div className="absolute top-full right-0 mt-2 p-2 bg-white rounded-xl shadow-xl border border-gray-200 flex gap-2 z-30">
              <button
                onClick={() => { handleCategoryColorChange(categoryId, undefined); setActiveColorPicker(null); }}
                className="w-6 h-6 rounded-full border border-gray-300 bg-[#F5F5F5]"
                title="Default"
              />
              {PAD_COLORS.map(c => (
                 <button
                   key={c}
                   onClick={() => { handleCategoryColorChange(categoryId, c); setActiveColorPicker(null); }}
                   className="w-6 h-6 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                   style={{ backgroundColor: c }}
                 />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="absolute -top-5 right-8 w-4 h-12 border-[3px] border-gray-400/90 rounded-full bg-transparent rotate-[15deg] shadow-[1px_2px_2px_rgba(0,0,0,0.1)] z-10"></div>
      <div className="absolute top-4 left-4 w-2 h-2 rounded-full bg-pink-100/15 shadow-inner"></div>
      <div className="absolute bottom-4 left-4 w-2 h-2 rounded-full bg-pink-100/15 shadow-inner"></div>

      <div className="relative z-10 flex flex-col h-full mt-2">
        <div className="flex items-center justify-center gap-2 mb-6 pb-2 border-b-[3px] border-black/10 self-center px-4 w-full">
          <h3 className="text-[20px] md:text-[24px] font-bold text-black/70 uppercase tracking-widest text-center m-0 line-clamp-1">{categoryName}</h3>
        </div>

        <div className="flex-1 flex flex-col gap-4 w-full">
          <div className="grid grid-cols-1 gap-3 w-full">
            {activeItems.map(renderTaskItem)}
            {activeItems.length === 0 && (
              <div className="col-span-full flex items-center justify-center py-6">
                <p className="text-[14px] text-black/40 italic font-medium">Nothing added yet.</p>
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center h-[48px] w-full">
            <div
              className="inline-flex items-center h-full gap-2 px-3 rounded-xl transition-colors w-full"
              style={{ backgroundColor: 'var(--pink-blush)', border: '1px solid var(--black-light-gray)', boxShadow: '0 3px 10px color-mix(in srgb, var(--black-near) 5%, transparent)' }}
            >
              <button
                type="button"
                aria-label={`Add to ${categoryName}`}
                onClick={() => { if(localInput.trim()) { handleAddSubmit(localInput.trim(), categoryId); setLocalInput(''); } }}
                disabled={!localInput.trim()}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-pink-100/5 hover:bg-pink-100/10 disabled:opacity-50 text-black/60 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>
              <input
                type="text"
                value={localInput}
                onChange={(e) => setLocalInput(e.target.value)}
                aria-label={`New task in ${categoryName}`}
                placeholder={`Add to ${categoryName}...`}
                onKeyDown={(e) => { if (e.key === 'Enter' && localInput.trim()) { handleAddSubmit(localInput.trim(), categoryId); setLocalInput(''); } }}
                className="bg-transparent border-none outline-none text-[15px] font-medium text-black placeholder:text-black/30 flex-1 w-full min-w-0"
              />
            </div>
          </div>
        </div>

        {doneItems.length > 0 && (
          <div className="mt-6 pt-4 border-t-[2px] border-black/10 flex flex-col gap-3">
            <h4 className="text-[14px] font-bold text-black/50 uppercase tracking-widest text-center">Done</h4>
            <div className="grid grid-cols-1 gap-3 w-full opacity-70 hover:opacity-100 transition-opacity">
              {doneItems.map(renderTaskItem)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


function SortableCategoryNotepad({ id, categoryName, isSelected, onClick, bgColor, textColor, onColorChange }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : 1 };

  const [showPicker, setShowPicker] = useState(false);

  return (
    <div
      ref={setNodeRef} style={{ ...style, backgroundColor: bgColor }} {...attributes} {...listeners} onClick={onClick}
      aria-pressed={isSelected}
      onKeyDown={event => {
        if (event.key === 'Enter' && !isDragging) { event.preventDefault(); onClick(); }
        else listeners?.onKeyDown?.(event);
      }}
      className={`planner-category-tab group relative shrink-0 min-w-[130px] sm:min-w-[148px] max-w-[200px] h-16 sm:h-16 px-2.5 py-1.5 rounded-sm shadow-sm border-[2px] border-gray-400 flex items-center justify-center cursor-pointer transition-transform hover:-translate-y-1 ${isSelected ? 'ring-2 ring-[#666666] ring-offset-2 scale-105' : ''}`}
    >
      <div className="absolute -top-3 right-4 w-3 h-7 border-[2px] border-gray-400 rounded-full bg-transparent rotate-[15deg] shadow-[1px_1px_1px_rgba(0,0,0,0.1)] z-10 pointer-events-none"></div>
      <div className="absolute top-1 left-1.5 w-1.5 h-1.5 rounded-full bg-pink-100/15 shadow-inner pointer-events-none"></div>
      <div className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-pink-100/15 shadow-inner pointer-events-none"></div>
      <div className="absolute bottom-1 left-1.5 w-1.5 h-1.5 rounded-full bg-pink-100/15 shadow-inner pointer-events-none"></div>
      <div className="absolute bottom-1 right-1.5 w-1.5 h-1.5 rounded-full bg-pink-100/15 shadow-inner pointer-events-none"></div>
      <div className="absolute inset-0 pointer-events-none bg-pink-100/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-sm"></div>

      <div className="flex items-center justify-center w-full px-1.5 pr-5 overflow-hidden">
        <span
          className="font-bold text-[11px] sm:text-[12px] leading-tight text-center relative break-words uppercase tracking-wide line-clamp-2 max-w-full"
          style={{ color: textColor }}
          title={categoryName}
        >
          {categoryName}
        </span>
      </div>
      
      <div className="absolute bottom-0.5 right-0.5 opacity-100 transition-opacity z-20">
        <button 
          type="button"
          onPointerDown={(e) => { e.stopPropagation(); setShowPicker(!showPicker); }}
          className="p-1 hover:bg-pink-100/10 rounded-md text-black/60 hover:text-black transition-colors"
          title="Change Color"
        >
          <PaintBucket className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        </button>
        {showPicker && (
          <div className="absolute bottom-full right-0 mb-2 p-2 bg-white rounded-xl shadow-xl border border-gray-200 flex gap-1 z-30" onPointerDown={e => e.stopPropagation()}>
            <button
              onClick={(e) => { e.stopPropagation(); onColorChange(undefined); setShowPicker(false); }}
              className="w-5 h-5 rounded-full border border-gray-300 bg-[#F5F5F5]"
              title="Default"
            />
            {PAD_COLORS.map(c => (
               <button
                 key={c}
                 onClick={(e) => { e.stopPropagation(); onColorChange(c); setShowPicker(false); }}
                 className="w-5 h-5 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                 style={{ backgroundColor: c }}
               />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AddCategoryNotepad({ onClick }: any) {
  return (
    <div
      onClick={onClick}
      className="relative shrink-0 min-w-[130px] sm:min-w-[148px] h-16 sm:h-16 rounded-sm shadow-sm border-2 border-dashed border-outline-variant/40 flex items-center justify-center cursor-pointer transition-transform hover:-translate-y-1 bg-surface-container-lowest hover:bg-surface-container-low"
    >
      <Plus className="w-6 h-6 text-on-surface-variant/40" />
    </div>
  );
}

const defaultCategories: Category[] = [
  { id: 'Tasks', name: 'Tasks' },
  { id: 'Chores', name: 'Chores' },
  { id: 'Work', name: 'Work' },
  { id: 'Personal', name: 'Personal' },
  { id: 'Errands', name: 'Errands' }
];

export function DailyLogView() {
  const { user } = useAuth();
  const [items, setItems] = useState<TaskItem[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'offline'>('idle');

  useEffect(() => {
    const handleOnline = () => setSyncStatus('idle');
    const handleOffline = () => setSyncStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (!navigator.onLine) setSyncStatus('offline');
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [categoryOrder, setCategoryOrder] = useState<string[]>(['Tasks', 'Chores', 'Work', 'Personal', 'Errands']);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('Tasks');
  const [showCategoryColorPicker, setShowCategoryColorPicker] = useState(false);
  const [showDoneColorPicker, setShowDoneColorPicker] = useState(false);
  
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editCatName, setEditCatName] = useState('');
  
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<Partial<TaskItem>>({});
  
  const [inputValue, setInputValue] = useState('');

  const [historyModalCategory, setHistoryModalCategory] = useState<string | null>(null);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);

  const openHistory = async (categoryId: string) => {
    setHistoryModalCategory(categoryId);
    setLoadingHistory(true);
    setHistoryLogs([]);

    if (user?.isAnonymous) {
       setHistoryLogs([
         { date: '2023-10-01', items: [{ text: 'Sample past task', completed: true, status: 'done' }] }
       ]);
       setLoadingHistory(false);
       return;
    }

    try {
      const q = query(
        collection(db, `users/${user.uid}/dailyLogs`),
        where(documentId(), '<', todayStr),
        orderBy(documentId(), 'desc'),
        limit(30)
      );
      const snaps = await safeGetDocs(q);
      const logs: any[] = [];
      snaps.forEach(snap => {
         const date = snap.id;
         const data = snap.data();
         let catItems: any[] = [];
         if (data.items) {
           catItems = data.items.filter((i: any) => i.category === categoryId);
         } else {
           if (categoryId === 'Tasks') catItems = (data.tasks || []).map((t:any) => ({...t, category: 'Tasks'}));
           if (categoryId === 'Chores') catItems = (data.chores || []).map((t:any) => ({...t, category: 'Chores'}));
         }
         if (catItems.length > 0) {
           logs.push({ date, items: catItems });
         }
      });
      setHistoryLogs(logs);
    } catch (err) {
      console.error(err);
    }
    setLoadingHistory(false);
  };

  
  const todayStr = new Date().toISOString().split('T')[0];
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      if (user.isAnonymous) {
        setCategories(defaultCategories);
        setCategoryOrder(['Tasks', 'Chores', 'Work', 'Personal', 'Errands']);
        setSelectedCategoryId('Tasks');
        setItems(GUEST_SAMPLE_DAILY_LOG_TASKS);
        setLoading(false);
        return;
      }
      try {
        const prefRef = doc(db, `users/${user.uid}/preferences`, 'dailyLog');
        const prefSnap = await safeGetDoc(prefRef);
        let loadedOrder = ['Tasks', 'Chores', 'Work', 'Personal', 'Errands'];
        let loadedCats = [...defaultCategories];
        
        if (prefSnap.exists()) {
          const data = prefSnap.data();
          if (data.categories) {
             loadedCats = data.categories;
             setCategories(loadedCats);
          } else if (data.categoryOrder) {
             loadedCats = data.categoryOrder.map((c: string) => ({ id: c, name: c }));
             setCategories(loadedCats);
          }
          if (data.categoryOrder) {
             loadedOrder = data.categoryOrder;
             setCategoryOrder(loadedOrder);
          }
        }
        
        if (!(loadedOrder || []).includes(selectedCategoryId)) {
          setSelectedCategoryId(loadedOrder[0] || 'Tasks');
        }

        const docRef = doc(db, `users/${user.uid}/dailyLogs`, todayStr);
        const docSnap = await safeGetDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.items) {
             setItems(data.items);
          } else {
             const oldTasks = (data.tasks || []).map((t: any, i: number) => ({ id: `task-${i}`, text: t.text, completed: t.completed, category: 'Tasks' }));
             const oldChores = (data.chores || []).map((c: any, i: number) => ({ id: `chore-${i}`, text: c.text, completed: c.completed, category: 'Chores' }));
             setItems([...oldTasks, ...oldChores]);
          }
        } else {
          const prevQuery = query(
            collection(db, `users/${user.uid}/dailyLogs`),
            where(documentId(), '<', todayStr),
            orderBy(documentId(), 'desc'),
            limit(1)
          );
          const prevSnaps = await safeGetDocs(prevQuery);
          let carryOverItems: any[] = [];
          if (!prevSnaps.empty) {
            const prevData = prevSnaps.docs[0].data();
            if (prevData.items) {
              carryOverItems = prevData.items.filter((i: any) => !i.completed).map((i: any) => ({ ...i, id: `carry-${Date.now()}-${Math.random()}` }));
            } else {
              const oldTasks = (prevData.tasks || []).filter((t: any) => !t.completed).map((t: any, i: number) => ({ id: `task-carry-${Date.now()}-${i}`, text: t.text, completed: false, category: 'Tasks' }));
              const oldChores = (prevData.chores || []).filter((c: any) => !c.completed).map((c: any, i: number) => ({ id: `chore-carry-${Date.now()}-${i}`, text: c.text, completed: false, category: 'Chores' }));
              carryOverItems = [...oldTasks, ...oldChores];
            }
          }
          setItems(carryOverItems);
          if (carryOverItems.length > 0) {
            await setDoc(docRef, { items: carryOverItems }, { merge: true });
          }
        }
      } catch (err: any) {
        console.error('Error fetching daily log:', err);
        setLoadError(err.message || 'Failed to load data. Please refresh.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, todayStr]);

  const saveState = async (newItems: TaskItem[]) => {
    if (!user) return;
    setItems(newItems);
    if (user.isAnonymous) return;
    const docRef = doc(db, `users/${user.uid}/dailyLogs`, todayStr);
    await setDoc(docRef, { items: newItems }, { merge: true });
  };

  const saveCategoryData = async (newCategories: Category[], newOrder: string[]) => {
    if (!user) return;
    setCategories(newCategories);
    setCategoryOrder(newOrder);
    if (user.isAnonymous) return;
    const prefRef = doc(db, `users/${user.uid}/preferences`, 'dailyLog');
    await setDoc(prefRef, { categories: newCategories, categoryOrder: newOrder }, { merge: true });
  };

  const toggleImportant = (id: string) => {
    const newItems = items.map(i => i.id === id ? { ...i, important: !i.important } : i);
    saveState(newItems);
  };

  const handleItemStatusChange = (id: string, newStatus: 'todo' | 'in-progress' | 'done') => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    if (item.status === 'done' && newStatus !== 'done' && (item.timeDoneDate || item.timeDoneTime)) {
      if (!window.confirm('Are you sure you want to mark this task as incomplete? This will clear its completion time.')) {
        return;
      }
    }

    const newItems = items.map(i => {
      if (i.id === id) {
        let timeDoneDate = i.timeDoneDate;
        let timeDoneTime = i.timeDoneTime;
        
        if (newStatus === 'done' && i.status !== 'done') {
          if (!timeDoneDate && !timeDoneTime) {
            const now = new Date();
            timeDoneDate = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
            timeDoneTime = now.toTimeString().substring(0, 5); // HH:mm
          }
        } else if (newStatus !== 'done') {
          timeDoneDate = undefined;
          timeDoneTime = undefined;
        }
        
        return { ...i, status: newStatus, completed: newStatus === 'done', timeDoneDate, timeDoneTime };
      }
      return i;
    });
    saveState(newItems);
  };

  
  const handleAddSubmit = (text: string, catId: string) => {
    if (text) {
      saveState([...items, { id: Date.now().toString(), text, completed: false, category: catId, status: 'todo' }]);
    }
  };


  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      const oldIndex = categoryOrder.indexOf(active.id);
      const newIndex = categoryOrder.indexOf(over.id);
      saveCategoryData(categories, arrayMove(categoryOrder, oldIndex, newIndex));
    }
  }
  
  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || id;
  const getCategoryColor = (id: string) => {
    const saved = categories.find(c => c.id === id)?.color;
    return saved ? lightSurfaceColor(saved) : undefined;
  };
  const handleCategoryColorChange = (id: string, color?: string) => {
    const newCats = categories.map(c => c.id === id ? { ...c, color } : c);
    saveCategoryData(newCats, categoryOrder);
  };

  // Category Management
  const handleAddNewCategory = () => {
    const newId = `cat-${Date.now()}`;
    const newCat = { id: newId, name: 'New Category' };
    setEditingCategory(newCat);
    setEditCatName(newCat.name);
  };

  const saveEditedCategory = () => {
    if (!editingCategory || !editCatName.trim()) return;
    const name = editCatName.trim();
    if (categories.find(c => c.id === editingCategory.id)) {
      // Update
      const newCats = categories.map(c => c.id === editingCategory.id ? { ...c, name } : c);
      saveCategoryData(newCats, categoryOrder);
    } else {
      // Add new
      const newCats = [...categories, { id: editingCategory.id, name }];
      const newOrder = [...categoryOrder, editingCategory.id];
      saveCategoryData(newCats, newOrder);
      setSelectedCategoryId(editingCategory.id);
    }
    setEditingCategory(null);
  };

  const deleteCategory = (id: string) => {
    if (categoryOrder.length <= 1) return;
    if (!confirm(`Delete ${getCategoryName(id)}? Tasks in this category will also be deleted.`)) return;
    
    const newOrder = categoryOrder.filter(c => c !== id);
    const newCats = categories.filter(c => c.id !== id);
    saveCategoryData(newCats, newOrder);
    
    const newItems = items.filter(item => item.category !== id);
    saveState(newItems);
    
    if (selectedCategoryId === id) {
      setSelectedCategoryId(newOrder[0]);
    }
  };

  // Task Management
  const startEditingTask = (item: TaskItem) => {
    setEditingItemId(item.id);
    setEditTask({ ...item });
  };

  const saveEditedTask = () => {
    if (!editingItemId || !editTask.text?.trim()) return;
    const updated = items.map(i => i.id === editingItemId ? { ...i, ...editTask, text: editTask.text!.trim() } : i);
    saveState(updated as TaskItem[]);
    setEditingItemId(null);
  };
  
  const deleteTask = (id: string) => {
    const newItems = items.filter(i => i.id !== id);
    saveState(newItems);
    if (editingItemId === id) setEditingItemId(null);
  };
  
  // Format DateTime
  const formatTimeDone = (date?: string, time?: string) => {
    if (!date && !time) return null;
    let dateStr = '';
    let timeStr = '';
    
    if (time) {
      const [h, m] = time.split(':');
      const d = new Date();
      d.setHours(parseInt(h, 10));
      d.setMinutes(parseInt(m, 10));
      timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    if (date) {
      const d = new Date(date + 'T00:00:00');
      dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    if (dateStr && timeStr) {
      return `Done ${dateStr} at ${timeStr}`;
    } else if (dateStr && !time) {
      return `Done ${dateStr}`;
    } else if (timeStr && !dateStr) {
      return `Done at ${timeStr}`;
    }
    return null;
  };

  const formatTaskDateTime = (date?: string, time?: string) => {
    const formatTimeStr = (t: string) => {
      const [h, m] = t.split(':');
      const d = new Date();
      d.setHours(parseInt(h, 10));
      d.setMinutes(parseInt(m, 10));
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    if (date && time) {
      const d = new Date(date + 'T00:00:00');
      return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • ${formatTimeStr(time)}`;
    }
    if (date) {
      const d = new Date(date + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    if (time) return formatTimeStr(time);
    return null;
  };

  // Add missing items categories back into order if they exist
  const allItemCats = Array.from(new Set(items.map(i => i.category)));
  const missingCats = allItemCats.filter(c => !(categoryOrder || []).includes(c));
  const activeOrder = [...(categoryOrder || []), ...missingCats];
  
  if (!(activeOrder || []).includes(selectedCategoryId)) {
     if (activeOrder.length > 0) setSelectedCategoryId(activeOrder[0]);
  }

  const currentCategoryItems = items.filter(i => i.category === selectedCategoryId);
  const activeItems = currentCategoryItems.filter(i => !i.completed).sort((a, b) => {
    if (a.important && !b.important) return -1;
    if (!a.important && b.important) return 1;
    return 0;
  });
  const doneItems = currentCategoryItems.filter(i => i.completed).sort((a, b) => {
    if (a.important && !b.important) return -1;
    if (!a.important && b.important) return 1;
    return 0;
  });
  const palette = getGrayscalePalette(activeOrder.length);
  const selectedIndex = activeOrder.indexOf(selectedCategoryId);



  const renderTaskItem = (item: TaskItem) => (
    <div key={item.id} className="flex flex-col min-h-[48px] group bg-white/40 hover:bg-white/60 rounded-xl px-[14px] py-[8px] gap-[4px] border border-black/5 shadow-sm transition-colors relative">
                        {editingItemId === item.id ? (
                          <div className="flex flex-col gap-3 py-2 w-full z-20">
                            <input
                              type="text"
                              value={editTask.text || ''}
                              onChange={(e) => setEditTask({...editTask, text: e.target.value})}
                              className="w-full bg-white/80 border-b-2 border-black/30 outline-none text-[16px] md:text-[18px] leading-[1.2] font-medium text-black px-2 py-1 rounded-sm"
                              placeholder="Task name"
                            />
                            <div className="flex flex-wrap gap-3 items-center text-[14px]">
                              <select 
                                value={editTask.category || item.category}
                                onChange={(e) => setEditTask({...editTask, category: e.target.value})}
                                className="bg-white/80 border border-black/20 rounded-md px-2 py-1 text-black outline-none"
                              >
                                {activeOrder.map(cId => (
                                  <option key={cId} value={cId}>{getCategoryName(cId)}</option>
                                ))}
                              </select>
                              
                              <div className="flex items-center gap-1 bg-white/80 border border-black/20 rounded-md px-2 py-1">
                                <CalendarIcon className="w-4 h-4 text-black/50" />
                                <input 
                                  type="date" 
                                  value={editTask.dueDate || ''}
                                  onChange={(e) => setEditTask({...editTask, dueDate: e.target.value})}
                                  className="bg-transparent text-black outline-none w-[110px]"
                                />
                                {editTask.dueDate && (
                                  <button onClick={() => setEditTask({...editTask, dueDate: ''})} className="p-0.5 hover:bg-pink-100/10 rounded-full text-black/50">
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-1 bg-white/80 border border-black/20 rounded-md px-2 py-1">
                                <Clock className="w-4 h-4 text-black/50" />
                                <input 
                                  type="time" 
                                  value={editTask.dueTime || ''}
                                  onChange={(e) => setEditTask({...editTask, dueTime: e.target.value})}
                                  className="bg-transparent text-black outline-none w-[90px]"
                                />
                                {editTask.dueTime && (
                                  <button onClick={() => setEditTask({...editTask, dueTime: ''})} className="p-0.5 hover:bg-pink-100/10 rounded-full text-black/50">
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-3 items-center text-[14px]">
                              <span className="text-black/60 font-semibold w-[60px] shrink-0 text-right">Done</span>
                              <div className="flex items-center gap-1 bg-white/80 border border-black/20 rounded-md px-2 py-1">
                                <CalendarIcon className="w-4 h-4 text-black/50" />
                                <input 
                                  type="date" 
                                  value={editTask.timeDoneDate || ''}
                                  onChange={(e) => setEditTask({...editTask, timeDoneDate: e.target.value})}
                                  className="bg-transparent text-black outline-none w-[110px]"
                                />
                                {editTask.timeDoneDate && (
                                  <button onClick={() => setEditTask({...editTask, timeDoneDate: ''})} className="p-0.5 hover:bg-pink-100/10 rounded-full text-black/50">
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-1 bg-white/80 border border-black/20 rounded-md px-2 py-1">
                                <Clock className="w-4 h-4 text-black/50" />
                                <input 
                                  type="time" 
                                  value={editTask.timeDoneTime || ''}
                                  onChange={(e) => setEditTask({...editTask, timeDoneTime: e.target.value})}
                                  className="bg-transparent text-black outline-none w-[90px]"
                                />
                                {editTask.timeDoneTime && (
                                  <button onClick={() => setEditTask({...editTask, timeDoneTime: ''})} className="p-0.5 hover:bg-pink-100/10 rounded-full text-black/50">
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/10">
                              <button onClick={() => deleteTask(item.id)} className="text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-md text-[14px] font-semibold flex items-center gap-1 transition-colors">
                                <Trash2 className="w-4 h-4" /> Delete Task
                              </button>
                              <div className="flex gap-2">
                                <button onClick={() => setEditingItemId(null)} className="px-3 py-1.5 rounded-md text-[14px] font-semibold text-black/60 hover:bg-pink-100/5 transition-colors">Cancel</button>
                                <button onClick={saveEditedTask} disabled={!editTask.text?.trim()} className="bg-pink-100 text-white px-4 py-1.5 rounded-md text-[14px] font-semibold hover:bg-pink-100/90 transition-colors disabled:opacity-50">{user?.isAnonymous ? 'Test Save' : 'Save'}</button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="task-row py-2 relative group">
                            {/* Column 1: Checkbox */}
                            <div className="task-checkbox flex items-center gap-[6px] mt-0.5">
                              <button 
                                type="button"
                                onClick={() => handleItemStatusChange(item.id, item.status === 'in-progress' ? 'todo' : 'in-progress')}
                                className={`w-[22px] h-[22px] rounded-full border-[2px] flex items-center justify-center transition-all ${item.status === 'in-progress' ? 'bg-[#C7FFF5] border-[#C7FFF5]' : 'bg-white border-[#C7FFF5]'}`}
                                title="Mark In Progress"
                              >
                                {item.status === 'in-progress' && <Check className="w-3.5 h-3.5 text-[#245A56]" strokeWidth={3} />}
                              </button>
                              <button 
                                type="button"
                                onClick={() => handleItemStatusChange(item.id, item.status === 'done' || (item.completed && (item.status as string) !== 'todo') ? 'todo' : 'done')}
                                className={`w-[22px] h-[22px] rounded-full border-[2px] flex items-center justify-center transition-all ${(item.status === 'done' || (item.completed && (item.status as string) !== 'todo')) ? 'bg-[#FFB8CD] border-[#FFB8CD]' : 'bg-white border-[#FFB8CD]'}`}
                                title="Mark Done"
                              >
                                {(item.status === 'done' || (item.completed && (item.status as string) !== 'todo')) && <Check className="w-3.5 h-3.5 text-[#5A3540]" strokeWidth={3} />}
                              </button>
                            </div>

                            {/* Column 2: Status Badge */}
                            <div className="task-status flex items-center min-h-[22px] mt-0.5">
                              {(item.status === 'done' || (item.completed && (item.status as string) !== 'todo')) && (
                                <span className="text-[11px] font-bold px-[8px] py-[3px] rounded-full uppercase tracking-wider bg-[#FFB8CD] text-[#5A3540] inline-block whitespace-nowrap">DONE</span>
                              )}
                              {item.status === 'in-progress' && (
                                <span className="text-[11px] font-bold px-[8px] py-[3px] rounded-full uppercase tracking-wider bg-[#C7FFF5] text-[#245A56] inline-block whitespace-nowrap">IN PROGRESS</span>
                              )}
                            </div>

                            {/* Column 3: Task Title */}
                            <div className="task-title">
                              <div className={`text-[16px] md:text-[18px] leading-[1.5] font-medium text-black/80 ${(item.status === 'done' || (item.completed && (item.status as string) !== 'todo')) ? 'opacity-50 line-through' : ''}`}>
                                {item.text}
                              </div>
                            </div>

                            {/* Column 4: Star & Actions / Dates */}
                            <div className="task-star flex flex-col items-end justify-between self-stretch min-w-[70px]">
                              <div className="flex items-center justify-end gap-1">
                                <button 
                                  type="button"
                                  onClick={() => toggleImportant(item.id)}
                                  className={`p-1.5 md:p-2 rounded-lg transition-colors ${item.important ? 'text-[#F8DA78] opacity-100' : 'text-black/40 hover:text-black/80 hover:bg-pink-100/10 opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}
                                  title="Mark as Important"
                                >
                                  <Star className={`w-4 h-4 ${item.important ? 'fill-current' : ''}`} />
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => startEditingTask(item)}
                                  className="p-1.5 md:p-2 text-black/40 hover:text-black/80 hover:bg-pink-100/10 rounded-lg transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                  title="Edit Task"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              </div>

                              {(formatTaskDateTime(item.dueDate, item.dueTime) || (item.status === 'done' || item.completed) && formatTimeDone(item.timeDoneDate, item.timeDoneTime)) && (
                                <div className={`flex flex-col items-end gap-0.5 mt-auto text-right ${(item.status === 'done' || (item.completed && (item.status as string) !== 'todo')) ? 'opacity-50' : ''}`}>
                                  {formatTaskDateTime(item.dueDate, item.dueTime) && (
                                    <div className="text-[11px] md:text-[12px] font-semibold text-black/50 whitespace-nowrap">
                                      Due: {formatTaskDateTime(item.dueDate, item.dueTime)}
                                    </div>
                                  )}
                                  {(item.status === 'done' || item.completed) && formatTimeDone(item.timeDoneDate, item.timeDoneTime) && (
                                    <div className="text-[11px] md:text-[12px] font-semibold text-black/40 whitespace-nowrap">
                                      Done: {formatTimeDone(item.timeDoneDate, item.timeDoneTime)}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
  );

  return (
    <div className="flex-1 md:overflow-y-auto flex flex-col">
      <TopBar title="Daily Log" />
      <main className="flex-1 md:overflow-y-auto px-margin-mobile md:px-margin-desktop py-6 md:py-8 bg-transparent relative">
      <div className="w-full bg-surface-container-lowest border border-outline-variant/20 shadow-md rounded-xl min-h-[1200px] relative flex flex-col overflow-hidden mb-8">
        <div className="absolute left-14 md:left-24 top-0 bottom-0 w-[2px] bg-primary/20 z-0"></div>
        <div className="flex-1 lined-paper relative z-10 px-4 md:px-8 pt-8 pb-safe-nav">
          <div className="h-auto min-h-[128px] pl-16 md:pl-24 flex flex-col justify-center py-4 relative">
            <button 
              onClick={() => setIsCategoryModalOpen(true)}
              className="absolute right-4 top-4 p-2.5 bg-surface rounded-full shadow-sm border border-outline-variant/20 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors z-20"
              title="Manage Categories"
            >
              <Settings2 className="w-5 h-5" />
            </button>
            <h1 className="text-[40px] md:text-[64px] lg:text-[72px] leading-none font-bold font-headline-lg-mobile md:font-headline-lg text-on-surface mb-2 tracking-tight">
              {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </h1>
            <h2 className="text-[18px] md:text-[24px] leading-[1.2] font-semibold text-on-surface-variant">
              {currentTime.toLocaleDateString('en-US', { month: 'long', day: 'numeric', weekday: 'long' })}
            </h2>
            <p className="text-[16px] leading-[1.6] font-normal font-body-md text-on-surface-variant/70 mt-1 uppercase tracking-widest">Daily Log</p>
          </div>
          
          {loadError && (
  <div className="pl-14 md:pl-24 pr-4 md:pr-12 mt-8">
    <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-200 shadow-sm flex flex-col items-start gap-4">
      <h3 className="font-bold text-lg">Error loading planner data</h3>
      <p className="font-medium">{loadError}</p>
      <p className="text-sm">We stopped loading to prevent overwriting your existing data with an empty state. Please refresh the page.</p>
      <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-sm transition-colors">Refresh Page</button>
    </div>
  </div>
)}
{!loading && !loadError && (
            <div className="pl-14 md:pl-24 pr-4 md:pr-12 flex flex-col gap-8">
              <div className="category-strip w-full py-4 -my-4 relative">
                <div className="flex items-center gap-2 mb-2 px-4">
                  <span className="text-black/50 font-bold uppercase tracking-widest text-[12px]">Categories</span>
                  <button onClick={() => setIsCategoryModalOpen(true)} className="p-1 hover:bg-pink-100/5 rounded-full text-black/40 hover:text-black/80 transition-colors" title="Manage Categories">
                     <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex gap-4 w-max px-4 pb-6 pt-2">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={activeOrder} strategy={rectSortingStrategy}>
                      {activeOrder.map((catId, index) => (
                        <SortableCategoryNotepad 
                          key={catId} id={catId} categoryName={getCategoryName(catId)}
                          bgColor={getCategoryColor(catId) || PAD_COLORS[index % PAD_COLORS.length]} textColor={getCategoryColor(catId) ? '#222222' : palette[index]?.text}
                          isSelected={selectedCategoryId === catId}
                          onClick={() => setSelectedCategoryId(catId)}
                          onColorChange={(color: string | undefined) => handleCategoryColorChange(catId, color)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                  <AddCategoryNotepad onClick={() => setIsCategoryModalOpen(true)} />
                </div>
              </div>

              
              <div className="lg:hidden flex flex-col">
                <FullCategoryNotepad
                  openHistory={openHistory} activeColorPicker={activeColorPicker} setActiveColorPicker={setActiveColorPicker}
                  handleCategoryColorChange={handleCategoryColorChange} handleAddSubmit={handleAddSubmit} renderTaskItem={renderTaskItem}
                  categoryId={selectedCategoryId} 
                  categoryName={getCategoryName(selectedCategoryId)} 
                  color={getCategoryColor(selectedCategoryId) || PAD_COLORS[Math.max(0, selectedIndex) % PAD_COLORS.length]}
                  activeItems={activeItems} 
                  doneItems={doneItems} 
                />
              </div>

              <div className="hidden lg:grid grid-cols-3 gap-8 w-full mt-4">
                {activeOrder.map((catId, index) => {
                  const catColor = getCategoryColor(catId) || PAD_COLORS[index % PAD_COLORS.length] || '#F5F5F5';
                  const cItems = items.filter(i => i.category === catId);
                  const cActive = cItems.filter(i => !i.completed).sort((a, b) => (a.important && !b.important ? -1 : (!a.important && b.important ? 1 : 0)));
                  const cDone = cItems.filter(i => i.completed).sort((a, b) => (a.important && !b.important ? -1 : (!a.important && b.important ? 1 : 0)));
                  return (
                    <FullCategoryNotepad
                      openHistory={openHistory} activeColorPicker={activeColorPicker} setActiveColorPicker={setActiveColorPicker}
                      handleCategoryColorChange={handleCategoryColorChange} handleAddSubmit={handleAddSubmit} renderTaskItem={renderTaskItem}
                      key={catId}
                      categoryId={catId}
                      categoryName={getCategoryName(catId)}
                      color={catColor}
                      activeItems={cActive}
                      doneItems={cDone}
                    />
                  );
                })}
              </div>

            </div>
          )}
        </div>
      </div>

      
      {/* History Modal */}
      {historyModalCategory && (
        <div role="dialog" aria-modal="true" aria-label="DailyLog dialog" tabIndex={-1} className="fixed inset-0 bg-pink-100/90 backdrop-blur-sm z-[100] flex justify-end">
           <div className="w-full max-w-md bg-surface h-full shadow-2xl flex flex-col animate-in slide-in-from-right relative">
              <div className="flex items-center justify-between p-6 border-b border-outline-variant/20 bg-surface-container-low">
                 <div>
                   <h2 className="text-xl font-bold">{getCategoryName(historyModalCategory)} History</h2>
                   <p className="text-sm text-on-surface-variant">Past 30 days</p>
                 </div>
                 <button onClick={() => setHistoryModalCategory(null)} className="p-2 hover:bg-pink-100/10 rounded-full">
                    <X className="w-5 h-5" />
                 </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                 {loadingHistory ? (
                   <div className="text-center text-on-surface-variant py-8">Loading history...</div>
                 ) : historyLogs.length === 0 ? (
                   <div className="text-center text-on-surface-variant py-8">No past logs found for this category.</div>
                 ) : (
                   historyLogs.map(log => (
                     <div key={log.date} className="flex flex-col gap-2">
                        <h3 className="font-bold text-sm text-on-surface-variant/80 border-b border-outline-variant/20 pb-1">
                           {new Date(log.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </h3>
                        <div className="flex flex-col gap-2">
                           {log.items.map((item: any, i: number) => (
                              <div key={i} className="flex items-start gap-2 bg-surface-container-lowest p-3 rounded-lg border border-outline-variant/20">
                                 <div className={`mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center border ${item.completed ? 'bg-green-100 border-green-300' : 'bg-gray-100 border-gray-300'}`}>
                                    {item.completed && <Check className="w-3 h-3 text-green-700" />}
                                 </div>
                                 <div className={`flex-1 text-sm ${item.completed ? 'opacity-60 line-through text-on-surface-variant' : 'text-on-surface'}`}>
                                    {item.text}
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                   ))
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Category Management Modal */}
      {isCategoryModalOpen && (
        <div role="dialog" aria-modal="true" aria-label="DailyLog dialog" tabIndex={-1} className="fixed inset-0 bg-pink-100/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-outline-variant/20">
              <h3 className="text-[18px] md:text-[20px] font-headline-sm text-on-surface">Manage Categories</h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="p-2 hover:bg-surface-variant rounded-full text-on-surface-variant">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 flex-1 flex flex-col gap-3">
              {activeOrder.map(catId => {
                const isEditing = editingCategory?.id === catId;
                return (
                  <div key={catId} className="flex items-center justify-between p-3 bg-surface-container-lowest border border-outline-variant/30 rounded-xl">
                    {isEditing ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input 
                          type="text" 
                          autoFocus
                          value={editCatName} 
                          onChange={(e) => setEditCatName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEditedCategory(); else if (e.key === 'Escape') setEditingCategory(null); }}
                          className="flex-1 bg-surface-variant/50 border border-outline-variant/50 rounded-lg px-3 py-1.5 text-on-surface outline-none focus:border-primary"
                        />
                        <button onClick={saveEditedCategory} disabled={!editCatName.trim()} className="p-1.5 bg-primary text-on-primary rounded-lg disabled:opacity-50">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingCategory(null)} className="p-1.5 bg-surface-variant text-on-surface-variant rounded-lg">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium text-on-surface text-[15px]">{getCategoryName(catId)}</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditingCategory({ id: catId, name: getCategoryName(catId) }); setEditCatName(getCategoryName(catId)); }} className="p-2 text-on-surface-variant hover:bg-surface-variant rounded-lg">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => deleteCategory(catId)} 
                            disabled={categoryOrder.length <= 1}
                            className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container/50 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-on-surface-variant"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              
              {editingCategory && !(activeOrder || []).includes(editingCategory.id) && (
                <div className="flex items-center justify-between p-3 bg-surface-container-lowest border border-outline-variant/30 rounded-xl">
                  <div className="flex-1 flex items-center gap-2">
                    <input 
                      type="text" 
                      autoFocus
                      value={editCatName} 
                      onChange={(e) => setEditCatName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEditedCategory(); else if (e.key === 'Escape') setEditingCategory(null); }}
                      className="flex-1 bg-surface-variant/50 border border-outline-variant/50 rounded-lg px-3 py-1.5 text-on-surface outline-none focus:border-primary"
                    />
                    <button onClick={saveEditedCategory} disabled={!editCatName.trim()} className="p-1.5 bg-primary text-on-primary rounded-lg disabled:opacity-50">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingCategory(null)} className="p-1.5 bg-surface-variant text-on-surface-variant rounded-lg">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
              
              {!editingCategory?.id.startsWith('cat-') && (
                <button 
                  onClick={handleAddNewCategory}
                  className="mt-2 flex items-center justify-center gap-2 p-3 border-2 border-dashed border-outline-variant/50 rounded-xl text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface transition-colors font-medium"
                >
                  <Plus className="w-5 h-5" /> Add Category
                </button>
              )}
            </div>
            
            <div className="p-4 border-t border-outline-variant/20 bg-surface-container-lowest">
              <button 
                onClick={() => {
                  if (editingCategory && editCatName.trim()) {
                    saveEditedCategory();
                  }
                  setIsCategoryModalOpen(false);
                }}
                className="w-full py-2.5 bg-primary text-on-primary rounded-xl font-semibold hover:bg-primary/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
    </div>
  );
}
