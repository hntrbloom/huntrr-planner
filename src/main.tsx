import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './planner.css';
import { AuthProvider } from './lib/AuthContext';
import { WorkShiftsProvider } from './lib/WorkShiftsContext';
import { CalendarProvider } from './lib/CalendarContext';

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

