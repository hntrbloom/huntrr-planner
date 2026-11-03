import re

with open('src/hooks/useImageCache.ts', 'r') as f:
    content = f.read()

# Add import
if 'fetchDriveThumbnailWithAuth' not in content:
    content = content.replace(
        "import { fetchDriveFileWithAuth, getCachedBlobUrl, setCachedBlobUrl } from '../lib/driveImageUtils';",
        "import { fetchDriveFileWithAuth, fetchDriveThumbnailWithAuth, getCachedBlobUrl, setCachedBlobUrl } from '../lib/driveImageUtils';"
    )

# Replace signature
content = content.replace(
    """export const useImageCache = (
  storagePath?: string, 
  src?: string, 
  driveFileId?: string,
  fallbackDriveFileId?: string
) => {""",
    """export const useImageCache = (
  storagePath?: string, 
  src?: string, 
  driveFileId?: string,
  fallbackDriveFileId?: string,
  mimeType?: string,
  filename?: string,
  isThumbnail?: boolean
) => {
  const isHeic = (mime?: string, name?: string) => {
    if (mime?.toLowerCase().includes('heic') || mime?.toLowerCase().includes('heif')) return true;
    if (name?.toLowerCase().endsWith('.heic') || name?.toLowerCase().endsWith('.heif')) return true;
    return false;
  };
"""
)

# Replace fetch block in useEffect
old_fetch_block = """      fetchDriveFileWithAuth(primaryDriveId)
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
            console.log(`[useImageCache] Attempting fallback Drive ID ${secondaryDriveId}...`);
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
        });"""

new_fetch_block = """
      const fetchPrimary = async () => {
        try {
          if (isHeic(mimeType, filename)) {
             return await fetchDriveThumbnailWithAuth(primaryDriveId, isThumbnail ? 800 : 2000);
          }
          return await fetchDriveFileWithAuth(primaryDriveId);
        } catch (err) {
          // If first image source fails -> automatically try Drive thumbnail fallback
          if (!isHeic(mimeType, filename)) {
             console.log(`[useImageCache] Primary failed, attempting thumbnail fallback for ${primaryDriveId}`);
             return await fetchDriveThumbnailWithAuth(primaryDriveId, isThumbnail ? 800 : 2000);
          }
          throw err;
        }
      };

      fetchPrimary()
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
            console.log(`[useImageCache] Attempting fallback Drive ID ${secondaryDriveId}...`);
            try {
              let fallbackUrl;
              if (isHeic(mimeType, filename)) {
                fallbackUrl = await fetchDriveThumbnailWithAuth(secondaryDriveId, isThumbnail ? 800 : 2000);
              } else {
                try {
                  fallbackUrl = await fetchDriveFileWithAuth(secondaryDriveId);
                } catch (e) {
                  fallbackUrl = await fetchDriveThumbnailWithAuth(secondaryDriveId, isThumbnail ? 800 : 2000);
                }
              }
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
        });"""

content = content.replace(old_fetch_block, new_fetch_block)

# Replace retry block
old_retry_block = """    if (primaryDriveId) {
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
        console.error(`[useImageCache] Retry failed for driveFileId ${primaryDriveId}:`, err);
        setHasError(true);
        setErrorMessage(err?.message || 'Drive retry failed');
        setIsLoading(false);
        return;
      }
    }"""

new_retry_block = """    if (primaryDriveId) {
      try {
        let url;
        if (isHeic(mimeType, filename)) {
          url = await fetchDriveThumbnailWithAuth(primaryDriveId, isThumbnail ? 800 : 2000);
        } else {
          try {
            url = await fetchDriveFileWithAuth(primaryDriveId);
          } catch (e) {
            url = await fetchDriveThumbnailWithAuth(primaryDriveId, isThumbnail ? 800 : 2000);
          }
        }
        setDisplayUrl(url);
        setHasError(false);
        setIsLoading(false);
        return;
      } catch (err: any) {
        if (secondaryDriveId) {
          try {
            let fallbackUrl;
            if (isHeic(mimeType, filename)) {
              fallbackUrl = await fetchDriveThumbnailWithAuth(secondaryDriveId, isThumbnail ? 800 : 2000);
            } else {
              try {
                fallbackUrl = await fetchDriveFileWithAuth(secondaryDriveId);
              } catch (e) {
                fallbackUrl = await fetchDriveThumbnailWithAuth(secondaryDriveId, isThumbnail ? 800 : 2000);
              }
            }
            setDisplayUrl(fallbackUrl);
            setHasError(false);
            setIsLoading(false);
            return;
          } catch (_) {}
        }
        console.error(`[useImageCache] Retry failed for driveFileId ${primaryDriveId}:`, err);
        setHasError(true);
        setErrorMessage(err?.message || 'Drive retry failed');
        setIsLoading(false);
        return;
      }
    }"""

content = content.replace(old_retry_block, new_retry_block)

with open('src/hooks/useImageCache.ts', 'w') as f:
    f.write(content)

