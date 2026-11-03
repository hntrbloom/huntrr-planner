import re

with open('src/lib/driveImageUtils.ts', 'r') as f:
    content = f.read()

thumbnail_func = """
export async function fetchDriveThumbnailWithAuth(fileId: string, size: number = 1000): Promise<string> {
  if (!fileId) throw new Error('Missing fileId');
  const cacheKey = `thumb_${size}_${fileId}`;
  const cached = memoryBlobCache.get(cacheKey);
  if (cached) return cached;
  
  return enqueueDownload(async () => {
    let token = getAccessToken();
    const endpoint = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=thumbnailLink`;
    const doFetch = async (authToken: string | null) => {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      return fetch(endpoint, { headers });
    };
    
    let res = await doFetch(token);
    if (res.status === 401 || !token) {
      token = await requestFreshDriveToken(false);
      if (token) res = await doFetch(token);
    }
    
    if (!res.ok) throw new Error(`Drive thumbnail fetch failed HTTP ${res.status}`);
    
    const data = await res.json();
    if (!data.thumbnailLink) throw new Error('No thumbnailLink returned from Drive');
    
    // Modify thumbnailLink for higher resolution
    const highResUrl = data.thumbnailLink.replace(/=s\d+/, `=s${size}`);
    
    // Fetch the actual thumbnail image (public URL, no auth needed)
    const imgRes = await fetch(highResUrl);
    if (!imgRes.ok) throw new Error(`Failed to fetch thumbnail image HTTP ${imgRes.status}`);
    
    const blob = await imgRes.blob();
    const objectUrl = URL.createObjectURL(blob);
    memoryBlobCache.set(cacheKey, objectUrl);
    return objectUrl;
  });
}
"""

if 'fetchDriveThumbnailWithAuth' not in content:
    content = content + "\n" + thumbnail_func

with open('src/lib/driveImageUtils.ts', 'w') as f:
    f.write(content)
