import { useState, useEffect, useCallback } from 'react';
import { getPhotoFromIDB } from '../lib/idb';
import { storage } from '../lib/firebase';
import { ref, getDownloadURL } from 'firebase/storage';
import { ACCOUNT_FILE_PREFIX, readAccountFile } from '../lib/accountFiles';
import { 
  fetchDriveFileWithAuth, 
  fetchDriveThumbnailWithAuth,
  getCachedBlobUrl, 
  extractDriveFileId 
} from '../lib/driveImageUtils';
import { getAccessToken, setAccessToken } from '../lib/AuthContext';
import { requestFreshDriveToken } from '../lib/driveAuth';

// Global memory cache for resolved Firebase Storage / HTTP / IDB URLs
const imageCache = new Map<string, string | Promise<string>>();

export const getCachedImageUrl = async (path: string): Promise<string> => {
  if (!path) return '';
  
  if (imageCache.has(path)) {
    const cached = imageCache.get(path)!;
    if (typeof cached === 'string') return cached;
    return cached; // wait for in-progress resolution
  }

  const resolvePromise = (async () => {
    try {
      // 1. Handle IndexedDB Fallbacks (Guest Mode / Offline Cache)
      if (path.startsWith('idb://') || path.startsWith('photo_')) {
        const key = path.replace('idb://', '');
        const blob = await getPhotoFromIDB(key);
        if (blob) {
          const objUrl = URL.createObjectURL(blob);
          imageCache.set(path, objUrl);
          return objUrl;
        }
        if (path.startsWith('idb://')) {
          throw new Error(`IDB photo not found: ${key}`);
        }
      }

      // 2. Handle Normal HTTP/Data URLs
      if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
        imageCache.set(path, path);
        return path;
      }

      // 3. Handle Firebase Storage Paths
      const cleanPath = path.startsWith('gs://') 
        ? path.replace(/^gs:\/\/[^/]+\//, '') 
        : path;
      
      const storageRef = ref(storage, cleanPath);
      const url = await getDownloadURL(storageRef);
      imageCache.set(path, url);
      return url;
    } catch (error) {
      imageCache.delete(path);
      throw error;
    }
  })();

  imageCache.set(path, resolvePromise);
  return resolvePromise;
};

export const prefetchImages = (paths: string[]) => {
  paths.forEach(path => {
    if (path && !imageCache.has(path)) {
      getCachedImageUrl(path).catch(err => {
        console.warn(`[Prefetch Error] Failed to prefetch ${path}:`, err);
      });
    }
  });
};

const isTempUrl = (url?: string) => {
  if (!url) return false;
  return url.startsWith('blob:') || url.startsWith('file:');
};

export const useImageCache = (
  storagePath?: string, 
  src?: string, 
  driveFileId?: string,
  fallbackDriveFileId?: string
) => {
  const primaryDriveId = extractDriveFileId(driveFileId) || extractDriveFileId(fallbackDriveFileId) || extractDriveFileId(src) || extractDriveFileId(storagePath);
  const secondaryDriveId = (driveFileId && fallbackDriveFileId && extractDriveFileId(driveFileId) !== extractDriveFileId(fallbackDriveFileId))
    ? extractDriveFileId(fallbackDriveFileId)
    : undefined;

  const [displayUrl, setDisplayUrl] = useState<string | null>(() => {
    const cleanStoragePath = (typeof storagePath === 'string' ? storagePath : '').trim();
    const cleanSrc = (typeof src === 'string' ? src : '').trim();

    if (primaryDriveId) {
      const cachedDrive = getCachedBlobUrl(primaryDriveId);
      if (cachedDrive) return cachedDrive;
      return null;
    }

    if (cleanStoragePath && imageCache.has(cleanStoragePath)) {
      const cached = imageCache.get(cleanStoragePath);
      if (typeof cached === 'string') return cached;
    }
    if (cleanSrc && imageCache.has(cleanSrc)) {
      const cached = imageCache.get(cleanSrc);
      if (typeof cached === 'string') return cached;
    }

    if (cleanSrc && !cleanSrc.startsWith(ACCOUNT_FILE_PREFIX) && !cleanSrc.startsWith('idb://') && !cleanSrc.startsWith('photo_') && !cleanSrc.includes('drive.google.com') && !cleanSrc.includes('docs.google.com') && !cleanSrc.includes('googleusercontent.com')) {
      return cleanSrc;
    }

    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (displayUrl) return false;
    const cleanStoragePath = (typeof storagePath === 'string' ? storagePath : '').trim();
    const cleanSrc = (typeof src === 'string' ? src : '').trim();
    return !!(primaryDriveId || cleanStoragePath || (cleanSrc && (cleanSrc.startsWith('idb://') || cleanSrc.startsWith('photo_'))));
  });

  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [accountRetry, setAccountRetry] = useState(0);

  useEffect(() => {
    let active = true;

    const cleanStoragePath = (typeof storagePath === 'string' ? storagePath : '').trim();
    const cleanSrc = (typeof src === 'string' ? src : '').trim();
    const accountFile = [cleanSrc, cleanStoragePath].find(value => value.startsWith(ACCOUNT_FILE_PREFIX));
    if (accountFile) {
      let objectUrl: string | undefined;
      setDisplayUrl(null);
      setIsLoading(true);
      setHasError(false);
      readAccountFile(accountFile).then(blob => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setDisplayUrl(objectUrl);
      }).catch(error => {
        if (!active) return;
        setHasError(true);
        setErrorMessage(error.message);
      }).finally(() => { if (active) setIsLoading(false); });
      return () => {
        active = false;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }

    if (primaryDriveId) {
      const cachedPrimary = getCachedBlobUrl(primaryDriveId);

      if (cachedPrimary) {
        setDisplayUrl(cachedPrimary);
        setIsLoading(false);
        setHasError(false);
        return;
      }

      setIsLoading(true);
      setHasError(false);
      setErrorMessage(null);

      fetchDriveFileWithAuth(primaryDriveId)
        .then(url => {
          if (active) {
            setDisplayUrl(url);
            setIsLoading(false);
            setHasError(false);
          }
        })
        .catch(async primaryErr => {
          console.warn(`[useImageCache] Drive fetch failed for primary ID ${primaryDriveId}:`, primaryErr?.message || primaryErr);
          if (secondaryDriveId) {
            const cachedSecondary = getCachedBlobUrl(secondaryDriveId);

            if (cachedSecondary) {
              if (active) {
                setDisplayUrl(cachedSecondary);
                setIsLoading(false);
                setHasError(false);
              }
              return;
            }
            try {
              const fallbackUrl = await fetchDriveFileWithAuth(secondaryDriveId);
              if (active) {
                setDisplayUrl(fallbackUrl);
                setIsLoading(false);
                setHasError(false);
                return;
              }
            } catch (secondaryErr: any) {
              console.warn(`[useImageCache] Secondary Drive fetch also failed for ${secondaryDriveId}:`, secondaryErr?.message || secondaryErr);
            }
          }
          if (active) {
            setIsLoading(false);
            setHasError(true);
            setErrorMessage(primaryErr?.message || 'Drive fetch failed');
          }
        });

      return () => { active = false; };
    }

    if (cleanStoragePath) {
      const cached = imageCache.get(cleanStoragePath);
      if (typeof cached === 'string') {
        setDisplayUrl(cached);
        setIsLoading(false);
        setHasError(false);
        return;
      }

      setIsLoading(true);
      setHasError(false);

      getCachedImageUrl(cleanStoragePath)
        .then(url => {
          if (active) {
            setDisplayUrl(url);
            setIsLoading(false);
            setHasError(false);
          }
        })
        .catch(async err => {
          console.warn(`[useImageCache] Storage path load failed for ${cleanStoragePath}:`, err);
          if (cleanSrc && !isTempUrl(cleanSrc)) {
            if (active) {
              setDisplayUrl(cleanSrc);
              setIsLoading(false);
              setHasError(false);
              return;
            }
          }
          if (active) {
            setIsLoading(false);
            setHasError(true);
            setErrorMessage(err?.message || 'Storage fetch failed');
          }
        });

      return () => { active = false; };
    }

    if (cleanSrc) {
      setDisplayUrl(cleanSrc);
      setIsLoading(false);
      setHasError(false);
    } else {
      setIsLoading(false);
      setHasError(true);
      setErrorMessage('No valid photo URL or Drive ID');
    }

    return () => { active = false; };
  }, [storagePath, src, driveFileId, fallbackDriveFileId, accountRetry]);

  const retry = useCallback(async (interactiveAuth: boolean = false) => {
    if (!primaryDriveId && !storagePath && !src) return;
    if ([src, storagePath].some(value => value?.trim().startsWith(ACCOUNT_FILE_PREFIX))) {
      setAccountRetry(value => value + 1);
      return;
    }

    setIsLoading(true);
    setHasError(false);
    setErrorMessage(null);

    if (primaryDriveId) {
      let token = getAccessToken();
      if (!token && interactiveAuth) {
        token = await requestFreshDriveToken(true);
        if (token) setAccessToken(token);
      }
      try {
        const url = await fetchDriveFileWithAuth(primaryDriveId);
        setDisplayUrl(url);
        setHasError(false);
        setIsLoading(false);
        return;
      } catch (err: any) {
        if (secondaryDriveId) {
          try {
            const fallbackUrl = await fetchDriveFileWithAuth(secondaryDriveId);
            setDisplayUrl(fallbackUrl);
            setHasError(false);
            setIsLoading(false);
            return;
          } catch (_) {}
        }
        console.warn(`[useImageCache] Retry failed for driveFileId ${primaryDriveId}:`, err);
        setHasError(true);
        setErrorMessage(err?.message || 'Drive retry failed');
        setIsLoading(false);
        return;
      }
    }

    const cleanStoragePath = (typeof storagePath === 'string' ? storagePath : '').trim();
    if (cleanStoragePath) {
      imageCache.delete(cleanStoragePath);
      try {
        const url = await getCachedImageUrl(cleanStoragePath);
        setDisplayUrl(url);
        setHasError(false);
      } catch (err: any) {
        console.error(`[useImageCache] Retry failed for storagePath ${cleanStoragePath}:`, err);
        setHasError(true);
        setErrorMessage(err?.message || 'Storage retry failed');
      } finally {
        setIsLoading(false);
      }
      return;
    }
  }, [primaryDriveId, secondaryDriveId, storagePath, src]);

  // Automatically retry when a fresh Google Drive token becomes available
  useEffect(() => {
    const handleTokenUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.hasToken && primaryDriveId && (hasError || !displayUrl)) {
        retry(false);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('drive-token-updated', handleTokenUpdate);
      return () => window.removeEventListener('drive-token-updated', handleTokenUpdate);
    }
  }, [primaryDriveId, hasError, displayUrl, retry]);

  return { displayUrl, isLoading, hasError, errorMessage, retry: (interactiveAuth: boolean = true) => retry(interactiveAuth) };
};
