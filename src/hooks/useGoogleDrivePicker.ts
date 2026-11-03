import { useState, useCallback } from 'react';
import { getAccessToken, setAccessToken } from '../lib/AuthContext';
import { requestFreshDriveToken } from '../lib/driveAuth';
import firebaseConfig from '../../firebase-applet-config.json';

export const CHARMS_FOLDER_ID = "1u6wQY53ko6xp41e2sNDL-DRiy6xJa-hw";
export const PRINTS_FOLDER_ID = "19HKbZxzPmFWz0onno8YydY3uz4HJcUBv";
export const FIGURES_FOLDER_ID = "1Wu6BHjKxdJ5xzAQxLY5jLNa5HkDx026D";
export const REFERENCES_FOLDER_ID = "1Nbtn1RAep9MoOgVHVbkKNGSg_-i7T4jp";
export const MOCKUPS_FOLDER_ID = "1XaOkCP_lqGt7GnQ7VwxH6xZXjCiYo0Aa";
export const EXTRAS_FOLDER_ID = "181OrBplKIJwnbEFiQExWk4BIJLAxDqHK";

export function getFolderIdForSlot(slotType: string, customFolders?: any): string {
  const typeLower = (slotType || '').toLowerCase();
  
  if (typeLower === 'mini_charm' || typeLower === 'minicharm' || typeLower.includes('charm')) {
    return customFolders?.charmsFolderId || customFolders?.miniCharmsFolderId || CHARMS_FOLDER_ID;
  }

  if (typeLower === 'figures' || typeLower === 'figure' || typeLower.includes('figure') || typeLower.includes('figurine')) {
    const fId = customFolders?.figuresFolderId || customFolders?.figureFolderId || customFolders?.figures || customFolders?.figure;
    if (fId && fId !== '19HKbZxzPmFWz0onno8YydY3uz4HJcUBv' && !fId.startsWith('1_')) return fId;
    return FIGURES_FOLDER_ID;
  }

  if (typeLower === 'inspiration' || typeLower.includes('reference') || typeLower.includes('inspiration')) {
    return customFolders?.referencesFolderId || REFERENCES_FOLDER_ID;
  }
  
  if (typeLower === 'design' || typeLower === 'finished' || typeLower.includes('mockup') || typeLower.includes('design') || typeLower === 'front' || typeLower === 'back' || typeLower === 'left' || typeLower === 'right') {
    return customFolders?.mockupsFolderId || MOCKUPS_FOLDER_ID;
  }

  if (typeLower === 'wiki' || typeLower === 'character' || typeLower.includes('wiki') || typeLower.includes('character')) {
    const fId = customFolders?.wikiFolderId || customFolders?.wiki;
    if (fId && fId !== '1_wiki_subfolder' && !fId.startsWith('1_')) return fId;
    return '';
  }
  
  return customFolders?.extrasFolderId || EXTRAS_FOLDER_ID;
}

export interface DriveImage {
  provider: 'google-drive';
  fileId: string;
  name: string;
  mimeType: string;
  size?: number;
  category?: string;
  createdTime?: number;
  driveFolderId?: string;
  url?: string;
}

export interface ShowPickerOptions {
  slotType: string;
  slotLabel?: string;
  printsFolderId?: string;
  printType?: string;
  multiSelect?: boolean;
  includeFolders?: boolean;
  onPick: (images: DriveImage[]) => void;
  onError?: (errorMsg: string) => void;
  onNeedAuth?: () => void;
}

let globalDriveToken = '';

export function getDriveToken() {
  return globalDriveToken || getAccessToken();
}

export function setDriveToken(token: string) {
  globalDriveToken = token;
  setAccessToken(token);
}

/**
 * Dynamically loads https://apis.google.com/js/api.js if window.gapi is not present.
 */
export function ensureGapiLoaded(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).gapi && (window as any).gapi.load) {
      resolve();
      return;
    }
    const existingScript = document.getElementById('google-gapi-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Google Picker API failed to load.')));
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gapi-script';
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Picker API failed to load.'));
    document.head.appendChild(script);
  });
}

/**
 * Loads the picker API using gapi.load('picker', ...).
 */
export function loadPickerApi(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureGapiLoaded();
      if (!(window as any).gapi) {
        reject(new Error('Google Picker API failed to load.'));
        return;
      }
      (window as any).gapi.load('picker', {
        callback: () => resolve(),
        onerror: () => reject(new Error('Google Picker API failed to load.'))
      });
    } catch (err) {
      reject(err);
    }
  });
}

export function useGoogleDrivePicker() {
  const [pickerError, setPickerError] = useState<string | null>(null);

  const openDrivePicker = useCallback(async (options: ShowPickerOptions) => {
    const { slotType, printsFolderId, multiSelect = false, includeFolders = true, onPick, onError, onNeedAuth } = options;

    const rawPrintType = (options.printType || '').trim().toLowerCase();
    const isCharms = rawPrintType === 'charms' || rawPrintType === 'charm' || rawPrintType === 'nail charms' || rawPrintType === 'nail charm' || rawPrintType === 'minicharms' || rawPrintType === 'mini charms' || slotType === 'mini_charm' || slotType === 'minicharm' || (slotType || '').includes('charm') || printsFolderId === CHARMS_FOLDER_ID;
    const isFigures = rawPrintType === 'figures' || rawPrintType === 'figure' || rawPrintType === 'figurines' || rawPrintType === 'figurine' || slotType === 'figures' || slotType === 'figure' || (slotType || '').includes('figure') || printsFolderId === FIGURES_FOLDER_ID;
    const printType = isCharms ? 'charms' : (isFigures ? 'figures' : (rawPrintType || slotType));

    // Debug logging as requested
    console.log("[Drive Picker] slotType:", slotType, "printType:", printType, "printsFolderId:", printsFolderId);

    let folderId: string = '';
    if (printsFolderId && printsFolderId !== '1_wiki_subfolder' && !printsFolderId.startsWith('1_') && printsFolderId !== '19HKbZxzPmFWz0onno8YydY3uz4HJcUBv') {
      folderId = printsFolderId;
    } else if (printType === "charms" || isCharms) {
      folderId = CHARMS_FOLDER_ID;
    } else if (printType === "figures" || isFigures) {
      folderId = FIGURES_FOLDER_ID;
    } else {
      const slotFolder = getFolderIdForSlot(slotType);
      if (slotFolder && slotFolder !== '1_wiki_subfolder' && !slotFolder.startsWith('1_')) {
        folderId = slotFolder;
      }
    }

    console.log("[Drive Picker] Target folder ID:", folderId || '(Root/All Images)');
    setPickerError(null);

    // Step 3: Check API Key and App ID
    const apiKey = (import.meta.env.VITE_GOOGLE_API_KEY as string) || (firebaseConfig as any).apiKey || '';
    const appId = (import.meta.env.VITE_GOOGLE_APP_ID as string) || (firebaseConfig as any).messagingSenderId || '495117552717';

    if (!apiKey) {
      const msg = 'Google API key is missing.';
      console.error('[Drive Picker]', msg);
      setPickerError(msg);
      if (onError) onError(msg);
      return;
    }

    if (!appId) {
      const msg = 'Google App ID is missing.';
      console.error('[Drive Picker]', msg);
      setPickerError(msg);
      if (onError) onError(msg);
      return;
    }

    // Step 4: Ensure Picker API is loaded
    try {
      await loadPickerApi();
    } catch (err: any) {
      const msg = 'Google Picker API failed to load.';
      console.error('[Drive Picker]', err);
      setPickerError(msg);
      if (onError) onError(msg);
      return;
    }

    const google = (window as any).google;
    if (!google || !google.picker) {
      const msg = 'Google Picker API failed to load.';
      console.error('[Drive Picker]', msg);
      setPickerError(msg);
      if (onError) onError(msg);
      return;
    }

    // Step 5: Authorization Token Check - silent then interactive if needed
    let accessToken = getDriveToken();
    if (!accessToken) {
      try {
        console.log('[Drive Picker] Attempting silent Drive token acquisition...');
        accessToken = await requestFreshDriveToken(false);
      } catch (err) {
        console.warn('[Drive Picker] Silent token request failed:', err);
      }
    }

    if (!accessToken) {
      try {
        console.log('[Drive Picker] Requesting interactive Drive authorization...');
        accessToken = await requestFreshDriveToken(true);
      } catch (err) {
        console.error('[Drive Picker] Interactive token request failed:', err);
      }
    }

    if (!accessToken) {
      const msg = 'Google Drive authorization is missing. Please sign in or authorize Drive.';
      console.error('[Drive Picker]', msg);
      setPickerError(msg);
      if (onNeedAuth) {
        onNeedAuth();
      } else if (onError) {
        onError(msg);
      }
      return;
    }

    // Step 6: Create DocsView for target folder or all images
    try {
      const imageMimeTypes = "image/png,image/jpeg,image/jpg,image/webp,image/gif,image/heic,image/heif";
      let view: any;

      if (printType === "charms" || isCharms || folderId === CHARMS_FOLDER_ID) {
        const charmsView = new google.picker.DocsView(google.picker.ViewId.DOCS)
          .setParent(folderId)
          .setIncludeFolders(true)
          .setSelectFolderEnabled(false)
          .setMimeTypes(imageMimeTypes);
        view = charmsView;
      } else if (printType === "figures" || isFigures || folderId === FIGURES_FOLDER_ID) {
        const figuresView = new google.picker.DocsView(google.picker.ViewId.DOCS)
          .setParent(folderId || FIGURES_FOLDER_ID)
          .setIncludeFolders(true)
          .setSelectFolderEnabled(false)
          .setMimeTypes(imageMimeTypes);
        view = figuresView;
      } else if (folderId) {
        const folderView = new google.picker.DocsView(google.picker.ViewId.DOCS_IMAGES)
          .setParent(folderId)
          .setIncludeFolders(includeFolders)
          .setSelectFolderEnabled(false)
          .setMimeTypes(imageMimeTypes);
        view = folderView;
      } else {
        const allImagesView = new google.picker.DocsView(google.picker.ViewId.DOCS_IMAGES)
          .setIncludeFolders(includeFolders)
          .setSelectFolderEnabled(false)
          .setMimeTypes(imageMimeTypes);
        view = allImagesView;
      }

      // Step 7: Build Picker
      const builder = new google.picker.PickerBuilder()
        .addView(view)
        .setDeveloperKey(apiKey)
        .setAppId(appId)
        .setOAuthToken(accessToken)
        .setOrigin(window.location.origin)
        .setCallback((data: any) => {
          const action = data[google.picker.Response.ACTION];
          if (action === google.picker.Action.PICKED) {
            const docs = data[google.picker.Response.DOCUMENTS];
            if (docs && docs.length > 0) {
              const selectedImages: DriveImage[] = docs.map((doc: any) => ({
                provider: 'google-drive',
                fileId: doc.id || doc[google.picker.Document.ID],
                name: doc.name || doc[google.picker.Document.NAME] || 'Drive Image',
                mimeType: doc.mimeType || doc[google.picker.Document.MIME_TYPE] || 'image/jpeg',
                size: doc.sizeBytes || 0,
                createdTime: Date.now(),
                driveFolderId: doc.parentId || folderId || undefined,
                url: doc.url || `https://drive.google.com/thumbnail?id=${doc.id || doc[google.picker.Document.ID]}`
              }));
              onPick(selectedImages);
            }
          } else if (action === google.picker.Action.CANCEL) {
            // Picker cancelled
          } else if (data[google.picker.Response.ERROR]) {
            const rawErr = String(data[google.picker.Response.ERROR]);
            let msg = 'Google Picker API failed to open.';
            if (rawErr.toLowerCase().includes('origin') || rawErr.toLowerCase().includes('unauthorized')) {
              msg = 'This website origin is not authorized.';
            } else if (rawErr.toLowerCase().includes('disabled')) {
              msg = 'Google Picker API is disabled.';
            }
            console.error('[Drive Picker Error]', rawErr);
            setPickerError(msg);
            if (onError) onError(msg);
          }
        });

      if (multiSelect) {
        builder.enableFeature(google.picker.Feature.MULTISELECT_ENABLED);
      }

      const picker = builder.build();
      picker.setVisible(true);

      // Step 8: Ensure Picker overlay has highest z-index above Wiki/modal overlays
      const applyZIndex = () => {
        const bgEls = document.querySelectorAll('.picker-dialog-bg');
        bgEls.forEach((el: any) => {
          el.style.zIndex = '999998';
        });
        const dialogEls = document.querySelectorAll('.picker-dialog');
        dialogEls.forEach((el: any) => {
          el.style.zIndex = '999999';
        });
      };
      setTimeout(applyZIndex, 50);
      setTimeout(applyZIndex, 150);
      setTimeout(applyZIndex, 350);
      setTimeout(applyZIndex, 750);
      setTimeout(applyZIndex, 1500);

    } catch (err: any) {
      console.error('[Drive Picker Exception]', err);
      let msg = 'Google Picker API failed to open.';
      const errStr = String(err?.message || err).toLowerCase();
      if (errStr.includes('origin')) {
        msg = 'This website origin is not authorized.';
      } else if (errStr.includes('disabled')) {
        msg = 'Google Picker API is disabled.';
      } else if (errStr.includes('key')) {
        msg = 'Google API key is missing.';
      }
      setPickerError(msg);
      if (onError) onError(msg);
    }
  }, []);

  // Backward compatible signature for existing callers
  const showPicker = useCallback(
    (
      onPick: (images: DriveImage[]) => void,
      multiSelect = false,
      folderId?: string,
      slotType = 'inspiration',
      slotLabel?: string,
      onError?: (err: string) => void,
      onNeedAuth?: () => void
    ) => {
      openDrivePicker({
        slotType,
        slotLabel,
        printsFolderId: folderId,
        multiSelect,
        onPick,
        onError,
        onNeedAuth
      });
    },
    [openDrivePicker]
  );

  return { openDrivePicker, showPicker, isPickerLoaded: true, pickerError, setPickerError };
}
