import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './planner.css';
import './retro-shell.css';
import './light-theme.css';
import './profiles.css';
import { ProfileProvider } from './lib/ProfileContext';
import { WorkShiftsProvider } from './lib/WorkShiftsContext';
import { CalendarProvider } from './lib/CalendarContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProfileProvider>
      <WorkShiftsProvider>
        <CalendarProvider>
          <App />
        </CalendarProvider>
      </WorkShiftsProvider>
    </ProfileProvider>
  </StrictMode>,
);

