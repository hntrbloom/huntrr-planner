import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from '../lib/workspaceStore';
import { useProfile } from '../lib/ProfileContext';
import { Pill, Check, X, AlertTriangle, Plus, Edit2, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export interface MedicationLog {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  timeTaken: string; // HH:mm
  dosage?: string;
  notes?: string;
  createdAt?: number;
}

export function MedicationPopup() {
  const { user } = useProfile();
  const [logs, setLogs] = useState<MedicationLog[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingLog, setEditingLog] = useState<MedicationLog | null>(null);

  // Sync medication logs from Firestore
  useEffect(() => {
    if (!user) {
      setLogs([]);
      return;
    }

    if (user.isAnonymous) {
      try {
        const saved = localStorage.getItem('guest_medication_logs');
        if (saved) setLogs(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading guest medication logs", e);
      }
      return;
    }

    const q = query(collection(db, `users/${user.uid}/medications`));
    const unsub = onSnapshot(q, (snap) => {
      const list: MedicationLog[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({
          id: d.id,
          name: data.name || 'Daily Medication',
          date: data.date || new Date().toISOString().split('T')[0],
          timeTaken: data.timeTaken || '08:00',
          dosage: data.dosage || '',
          notes: data.notes || '',
          createdAt: data.createdAt || Date.now()
        });
      });
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setLogs(list);
    }, (err) => {
      console.error("Error subscribing to medication logs:", err);
    });

    return () => unsub();
  }, [user]);

  const handleSaveLog = async (log: MedicationLog) => {
    if (!user) throw new Error("User not authenticated");

    if (user.isAnonymous) {
      setLogs(prev => {
        const exists = prev.find(l => l.id === log.id);
        const updated = exists ? prev.map(l => l.id === log.id ? log : l) : [log, ...prev];
        try { localStorage.setItem('guest_medication_logs', JSON.stringify(updated)); } catch(e){}
        return updated;
      });
      return;
    }

    // Save directly using setDoc to prevent index/query issues
    await setDoc(doc(db, `users/${user.uid}/medications`, log.id), {
      name: log.name,
      date: log.date,
      timeTaken: log.timeTaken,
      dosage: log.dosage || '',
      notes: log.notes || '',
      completed: true,
      createdAt: log.createdAt || Date.now()
    });
  };

  const handleDeleteLog = async (id: string) => {
    if (!confirm("Are you sure you want to delete this medication log?")) return;

    if (user?.isAnonymous) {
      setLogs(prev => {
        const updated = prev.filter(l => l.id !== id);
        try { localStorage.setItem('guest_medication_logs', JSON.stringify(updated)); } catch(e){}
        return updated;
      });
      return;
    }

    try {
      await deleteDoc(doc(db, `users/${user.uid}/medications`, id));
    } catch (err: any) {
      alert("Failed to delete log: " + (err?.message || "Unknown error"));
    }
  };

  return (
    <>
      {showModal && (
        <MedicationFormModal
          initialLog={editingLog}
          onSave={handleSaveLog}
          onClose={() => {
            setShowModal(false);
            setEditingLog(null);
          }}
        />
      )}
    </>
  );
}

export function MedicationLogModal({ initialLog, isOpen, onClose, onSave, onDelete }: {
  initialLog?: MedicationLog | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (log: MedicationLog) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  if (!isOpen) return null;
  return (
    <MedicationFormModal
      initialLog={initialLog || null}
      onSave={onSave}
      onClose={onClose}
    />
  );
}

export function MedicationFormModal({ initialLog, onSave, onClose }: {
  initialLog: MedicationLog | null;
  onSave: (log: MedicationLog) => Promise<void>;
  onClose: () => void;
}) {
  const now = new Date();
  const defaultDate = now.toISOString().split('T')[0];
  const defaultTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  const [name, setName] = useState(initialLog?.name || '');
  const [date, setDate] = useState(initialLog?.date || defaultDate);
  const [timeTaken, setTimeTaken] = useState(initialLog?.timeTaken || defaultTime);
  const [dosage, setDosage] = useState(initialLog?.dosage || '');
  const [notes, setNotes] = useState(initialLog?.notes || '');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Form Field Validation
    if (!name.trim()) {
      setErrorMsg("Medication name is required.");
      return;
    }
    if (!date) {
      setErrorMsg("Date is required.");
      return;
    }
    if (!timeTaken) {
      setErrorMsg("Time taken is required.");
      return;
    }

    setIsSaving(true);

    try {
      const payload: MedicationLog = {
        id: initialLog?.id || uuidv4(),
        name: name.trim(),
        date,
        timeTaken,
        dosage: dosage.trim(),
        notes: notes.trim(),
        createdAt: initialLog?.createdAt || Date.now()
      };

      await onSave(payload);

      setSuccessMsg("Medication log saved successfully!");
      
      // Reset & close after success feedback
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error("Save medication error:", err);
      setErrorMsg(err?.message || "Failed to save medication record. Please check your connection and try again.");
      setIsSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="MedicationPopup dialog" tabIndex={-1} className="fixed inset-0 bg-pink-100/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl p-6 shadow-2xl border border-outline-variant/30 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[20px] font-bold text-on-surface leading-tight">
                {initialLog ? "Edit Medication Log" : "Log Medication"}
              </h3>
              <p className="text-[13px] text-on-surface-variant font-medium">Record daily dosage details</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            disabled={isSaving}
            className="p-2 text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-100 border border-red-200 rounded-xl text-red-800 text-[14px] font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-100 border border-emerald-200 rounded-xl text-emerald-800 text-[14px] font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-bold text-on-surface mb-1">
              Medication Name <span className="text-red-500">*</span>
            </label>
            <input 
              type="text"
              required
              placeholder="e.g. Vitamin D3, Allergy Meds, Aspirin"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-4 py-2.5 text-[15px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-bold text-on-surface mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input 
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-3 py-2.5 text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-[13px] font-bold text-on-surface mb-1">
                Time Taken <span className="text-red-500">*</span>
              </label>
              <input 
                type="time"
                required
                value={timeTaken}
                onChange={(e) => setTimeTaken(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-3 py-2.5 text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-bold text-on-surface mb-1">
              Dosage / Amount <span className="text-on-surface-variant font-normal">(Optional)</span>
            </label>
            <input 
              type="text"
              placeholder="e.g. 1 pill, 500mg, 10ml"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-4 py-2.5 text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-[13px] font-bold text-on-surface mb-1">
              Notes <span className="text-on-surface-variant font-normal">(Optional)</span>
            </label>
            <textarea 
              rows={2}
              placeholder="e.g. Taken with breakfast and full glass of water"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-4 py-2.5 text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          <div className="flex gap-3 pt-3 border-t border-outline-variant/10">
            <button 
              type="button" 
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-3 px-4 rounded-full border border-outline-variant bg-surface text-on-surface font-semibold text-[14px] hover:bg-surface-variant transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSaving || !name.trim()}
              className="flex-1 py-3 px-4 rounded-full bg-primary text-on-primary font-bold text-[14px] hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? "Saving..." : (initialLog ? "Save Changes" : "Save Log")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
