import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, query, setDoc, doc, deleteDoc } from './workspaceStore';
import { useAuth } from './AuthContext';

export interface CalendarAppointment {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime?: string; // HH:mm
  location?: string;
  notes?: string;
  category?: string; // e.g. 'Personal', 'Work', 'Meeting', 'Studio', 'Health', etc.
  completed?: boolean;
}

export interface CalendarContextType {
  appointments: CalendarAppointment[];
  loading: boolean;
  saveAppointment: (appt: CalendarAppointment) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  toggleCompleteAppointment: (id: string) => Promise<void>;
  getAppointmentsForDate: (dateStr: string) => CalendarAppointment[];
}

export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const formattedM = (m || 0).toString().padStart(2, '0');
  return `${h12}:${formattedM} ${ampm}`;
}

export function getInitialGuestAppointments(): CalendarAppointment[] {
  const today = new Date();
  const todayStr = getLocalDateString(today);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = getLocalDateString(tomorrow);
  
  const inThreeDays = new Date(today);
  inThreeDays.setDate(inThreeDays.getDate() + 3);
  const inThreeDaysStr = getLocalDateString(inThreeDays);

  return [
    {
      id: 'guest-appt-1',
      name: 'Morning Planning & Tea Session',
      date: todayStr,
      startTime: '09:30',
      endTime: '10:15',
      location: 'Cozy Studio Desk',
      notes: 'Review weekly goals, organize stationery notebook, and plan print priorities.',
      category: 'Personal',
      completed: false
    },
    {
      id: 'guest-appt-2',
      name: 'Design Review: Kawaii Keychains',
      date: todayStr,
      startTime: '14:00',
      endTime: '15:00',
      location: 'Craft Studio',
      notes: 'Check filament color samples and resin charm test pours.',
      category: 'Studio',
      completed: false
    },
    {
      id: 'guest-appt-3',
      name: 'Print Supply Restock Pickup',
      date: tomorrowStr,
      startTime: '11:00',
      endTime: '12:00',
      location: 'Local Craft & Hardware Market',
      notes: 'Pick up UV resin, pastel acrylic sheets, and jump rings.',
      category: 'Supplies',
      completed: false
    },
    {
      id: 'guest-appt-4',
      name: 'Pop-up Booth Strategy Meeting',
      date: inThreeDaysStr,
      startTime: '15:30',
      endTime: '16:30',
      location: 'Cafe Roasters Room 2',
      notes: 'Discuss table layout, signage, price tags, and inventory display stands.',
      category: 'Meeting',
      completed: false
    }
  ];
}

const CalendarContext = createContext<CalendarContextType>({
  appointments: [],
  loading: true,
  saveAppointment: async () => {},
  deleteAppointment: async () => {},
  toggleCompleteAppointment: async () => {},
  getAppointmentsForDate: () => [],
});

export const useCalendar = () => useContext(CalendarContext);

export const CalendarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    if (user.isAnonymous) {
      try {
        const saved = localStorage.getItem('guest_appointments');
        if (saved) {
          const parsed = JSON.parse(saved);
          setAppointments(Array.isArray(parsed) ? parsed : []);
        } else {
          const initial = getInitialGuestAppointments();
          localStorage.setItem('guest_appointments', JSON.stringify(initial));
          setAppointments(initial);
        }
      } catch (e) {
        console.error('Error reading guest appointments:', e);
        const fallback = getInitialGuestAppointments();
        setAppointments(fallback);
      }
      setLoading(false);
      return;
    }

    const q = query(collection(db, `users/${user.uid}/appointments`));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: CalendarAppointment[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as CalendarAppointment);
        });
        setAppointments(list);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load appointments from Firestore', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const saveAppointment = async (appt: CalendarAppointment) => {
    if (!user) return;
    
    // Normalize data
    const normalized: CalendarAppointment = {
      ...appt,
      name: appt.name.trim(),
      category: appt.category?.trim() || 'General',
      location: appt.location?.trim() || '',
      notes: appt.notes?.trim() || '',
      completed: Boolean(appt.completed),
    };

    if (user.isAnonymous) {
      setAppointments((prev) => {
        const exists = prev.some((a) => a.id === normalized.id);
        const updated = exists
          ? prev.map((a) => (a.id === normalized.id ? normalized : a))
          : [...prev, normalized];
        try {
          localStorage.setItem('guest_appointments', JSON.stringify(updated));
        } catch (e) {
          console.error('Error writing guest appointments to localStorage', e);
        }
        return updated;
      });
      return;
    }

    try {
      await setDoc(doc(db, `users/${user.uid}/appointments`, normalized.id), normalized);
    } catch (err) {
      console.error('Error saving appointment:', err);
      throw err;
    }
  };

  const deleteAppointment = async (id: string) => {
    if (!user) return;

    if (user.isAnonymous) {
      setAppointments((prev) => {
        const updated = prev.filter((a) => a.id !== id);
        try {
          localStorage.setItem('guest_appointments', JSON.stringify(updated));
        } catch (e) {
          console.error('Error deleting guest appointment from localStorage', e);
        }
        return updated;
      });
      return;
    }

    try {
      await deleteDoc(doc(db, `users/${user.uid}/appointments`, id));
    } catch (err) {
      console.error('Failed to delete appointment:', err);
      throw err;
    }
  };

  const toggleCompleteAppointment = async (id: string) => {
    const existing = appointments.find((a) => a.id === id);
    if (!existing) return;
    const updated: CalendarAppointment = {
      ...existing,
      completed: !existing.completed,
    };
    await saveAppointment(updated);
  };

  const getAppointmentsForDate = (dateStr: string) => {
    return appointments.filter((a) => a.date === dateStr);
  };

  const value = useMemo(
    () => ({
      appointments,
      loading,
      saveAppointment,
      deleteAppointment,
      toggleCompleteAppointment,
      getAppointmentsForDate,
    }),
    [appointments, loading]
  );

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
};
