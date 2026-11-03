import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './lib/AuthContext';
import { WorkShiftsProvider } from './lib/WorkShiftsContext';
import { CalendarProvider } from './lib/CalendarContext';

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const filename = String(event.filename || '');
    const message = String(event.message || '');
    if (filename.includes('@vite/client') || message.includes('WebSocket') || message.includes('vite')) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true);
  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = String(event.reason?.message || event.reason || '');
    if (reasonStr.includes('WebSocket') || reasonStr.includes('vite')) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <WorkShiftsProvider>
        <CalendarProvider>
          <App />
        </CalendarProvider>
      </WorkShiftsProvider>
    </AuthProvider>
  </StrictMode>,
);

