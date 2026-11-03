import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getAccessToken } from './AuthContext';
import { checkAndCreateFolders } from './driveFolderUtils';

export interface UserSettings {
  driveFolders?: {
    mainFolderId?: string;
    printsFolderId?: string;
    miniCharmsFolderId?: string;
    charmsFolderId?: string;
    miniFurnitureFolderId?: string;
    figuresFolderId?: string;
    objectsFolderId?: string;
    setsFolderId?: string;
    referencesFolderId?: string;
    mockupsFolderId?: string;
    extrasFolderId?: string;
    boardsFolderId?: string;
    [key: string]: any;
  };
  printFolderIds?: Record<string, string>;
  [key: string]: any;
}

export async function getUserSettings(uid: string): Promise<UserSettings | null> {
  try {
    const docRef = doc(db, 'users', uid, 'settings', 'general');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as UserSettings;
      if (data.printFolderIds) {
        try {
          localStorage.setItem('huntrr_print_folder_ids', JSON.stringify(data.printFolderIds));
        } catch {}
      }
      return data;
    }
  } catch (err) {
    console.warn("Could not fetch user settings from Firestore:", err);
  }
  return null;
}

export async function updateUserSettings(uid: string, settings: Partial<UserSettings>): Promise<void> {
  if (settings.printFolderIds) {
    try {
      localStorage.setItem('huntrr_print_folder_ids', JSON.stringify(settings.printFolderIds));
    } catch {}
  }
  const docRef = doc(db, 'users', uid, 'settings', 'general');
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    await updateDoc(docRef, settings);
  } else {
    await setDoc(docRef, settings);
  }
}

export async function initializeDriveFolders(uid: string, forceRepair = false): Promise<UserSettings['driveFolders']> {
  const currentSettings = await getUserSettings(uid);
  
  if (!forceRepair && currentSettings?.driveFolders?.mainFolderId && currentSettings?.driveFolders?.boardsFolderId) {
    return currentSettings.driveFolders;
  }

  const newFolders = await checkAndCreateFolders();
  
  // Merge if exists
  const updatedFolders = {
    ...currentSettings?.driveFolders,
    ...newFolders
  };

  await updateUserSettings(uid, { driveFolders: updatedFolders });
  return updatedFolders;
}
