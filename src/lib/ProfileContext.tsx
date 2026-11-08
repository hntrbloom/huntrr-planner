import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createProfile, readProfiles, renameProfile, selectProfile, type Profile } from './profileStore';
import { importProfileBackup } from './backup';
import { findBrowserWorkspaces } from './legacyBackup';

interface ProfileUser {
  uid: string;
  displayName: string;
  // The existing modules use this to distinguish durable workspaces from their old sample-data mode.
  isAnonymous: false;
}

interface ProfileContextValue {
  user: ProfileUser | null;
  profile: Profile | null;
  profiles: Profile[];
  storageError: string;
  legacy: { local: boolean; browser: boolean };
  create: (nickname: string) => Promise<void>;
  select: (id: string) => Promise<void>;
  rename: (nickname: string) => Promise<void>;
  importBackup: (nickname: string, backup: unknown) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [legacy, setLegacy] = useState({ local: false, browser: false });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    readProfiles().then(result => {
      if (mounted) {
        setProfile(result.active);
        setProfiles(result.profiles);
        setReady(true);
      }
    }).catch(() => {
      if (mounted) {
        setError('Organizer could not open browser storage. Enable storage for this site, then try again.');
        setReady(true);
      }
    });
    findBrowserWorkspaces().then(result => { if (mounted) setLegacy(result); }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const uid = profile?.id;
  // Keep module subscriptions stable across a nickname edit.
  const user = useMemo<ProfileUser | null>(() => uid ? { uid, displayName: '', isAnonymous: false } : null, [uid]);
  const activate = async (next: Profile) => {
    if (profile && profile.id !== next.id) {
      // A fresh document releases all component state, file URLs and in-memory Drive grants.
      window.location.reload();
      return;
    }
    setProfile(next);
    setProfiles(current => current.some(item => item.id === next.id) ? current : [...current, next]);
  };

  if (!ready) return null;
  return <ProfileContext.Provider value={{
    user, profile, profiles, legacy, storageError: error,
    create: async nickname => activate(await createProfile(nickname)),
    select: async id => activate(await selectProfile(id)),
    rename: async nickname => {
      if (!profile) return;
      const updated = await renameProfile(profile.id, nickname);
      setProfile(updated);
      setProfiles(current => current.map(item => item.id === updated.id ? updated : item));
    },
    importBackup: async (nickname, backup) => activate(await importProfileBackup(nickname, backup)),
  }}>
    {children}
  </ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('ProfileProvider is required.');
  return context;
}
