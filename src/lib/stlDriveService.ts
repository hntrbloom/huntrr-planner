import { getAccessToken } from './AuthContext';
import { requestFreshDriveToken } from './driveAuth';
import { getOrCreateModelsFolder } from './driveFolderUtils';

export interface DriveSTLFileItem {
  id: string;
  name: string;
  size?: number;
  mimeType?: string;
  modifiedTime?: string;
}

/**
 * Downloads the raw ArrayBuffer for an STL file stored in Google Drive.
 * Automatically handles silent token refresh on 401s.
 */
export async function fetchDriveSTLArrayBuffer(fileId: string): Promise<ArrayBuffer> {
  if (!fileId) throw new Error('A valid Google Drive file ID is required.');

  let token = getAccessToken();
  if (!token) {
    token = await requestFreshDriveToken(false);
  }

  const doFetch = async (authToken: string | null) => {
    const headers: Record<string, string> = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    return fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers });
  };

  let res = await doFetch(token);

  if (res.status === 401 || !token) {
    console.warn(`[STL Drive API] Token expired or missing. Refreshing silently...`);
    token = await requestFreshDriveToken(false);
    if (token) {
      res = await doFetch(token);
    }
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error('Google Drive session expired. Please sign in again to restore access.');
  }

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('This STL file was moved or deleted from Google Drive.');
    }
    throw new Error(`Failed to load STL file from Google Drive (HTTP ${res.status}).`);
  }

  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new Error('The downloaded STL file is empty (0 bytes).');
  }

  return arrayBuffer;
}

/**
 * Uploads an STL file directly to the dedicated Models folder on Google Drive.
 * Uses XMLHttpRequest for real-time progress callbacks.
 */
export async function uploadSTLToDrive(
  file: File | Blob,
  filename: string,
  onProgress?: (percent: number) => void
): Promise<{ driveFileId: string; folderId: string; filename: string; size: number }> {
  let token = getAccessToken();
  if (!token) {
    token = await requestFreshDriveToken(true);
  }

  if (!token) {
    throw new Error('Google Drive authorization is required to save models.');
  }

  // Ensure dedicated Models folder exists
  let folderId: string;
  try {
    folderId = await getOrCreateModelsFolder();
  } catch (err: any) {
    console.warn('Failed to get/create Models folder in Drive, falling back to root:', err);
    folderId = 'root';
  }

  const cleanFilename = filename.endsWith('.stl') ? filename : `${filename}.stl`;
  const boundary = '-------314159265358979323846' + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const metadata = {
    name: cleanFilename,
    parents: folderId === 'root' ? [] : [folderId],
    mimeType: 'model/stl',
  };

  const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
  
  // Construct multipart body using Blob parts to handle binary data efficiently
  const multipartBlob = new Blob([
    delimiter,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    metadataBlob,
    delimiter,
    'Content-Type: model/stl\r\n\r\n',
    file,
    closeDelim
  ]);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', `multipart/related; boundary=${boundary}`);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const resp = JSON.parse(xhr.responseText);
          if (resp.id) {
            resolve({
              driveFileId: resp.id,
              folderId,
              filename: cleanFilename,
              size: file.size,
            });
            return;
          }
        } catch (e) {
          // ignore parse error and reject below
        }
      }

      if (xhr.status === 401) {
        reject(new Error('Google Drive access token expired. Please reconnect Google Drive.'));
      } else {
        reject(new Error(`Google Drive upload failed with status ${xhr.status}: ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during Google Drive upload.'));
    };

    xhr.send(multipartBlob);
  });
}

/**
 * Queries Google Drive for STL files (searching the dedicated models folder or global Drive).
 */
export async function listDriveSTLFiles(folderId?: string): Promise<DriveSTLFileItem[]> {
  let token = getAccessToken();
  if (!token) {
    token = await requestFreshDriveToken(false);
  }
  if (!token) {
    throw new Error('Google Drive authorization needed.');
  }

  let q = "trashed = false and (name contains '.stl' or name contains '.STL' or mimeType = 'model/stl' or mimeType = 'application/sla')";
  if (folderId) {
    // When querying a designated folder, query non-trashed files directly
    q = `'${folderId}' in parents and trashed = false`;
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,size,mimeType,modifiedTime)&pageSize=100&orderBy=modifiedTime desc`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('Google Drive connection expired or permission denied.');
    }
    throw new Error(`Drive list error (HTTP ${res.status})`);
  }

  const data = await res.json();
  const allFiles: DriveSTLFileItem[] = (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    size: f.size ? parseInt(f.size, 10) : undefined,
    mimeType: f.mimeType,
    modifiedTime: f.modifiedTime,
  }));

  if (folderId) {
    // Exclude subfolders, and keep 3D models / files
    return allFiles.filter(f => 
      f.mimeType !== 'application/vnd.google-apps.folder' &&
      (f.name.toLowerCase().endsWith('.stl') || 
       f.mimeType === 'model/stl' || 
       f.mimeType === 'application/sla' ||
       f.mimeType === 'application/octet-stream' ||
       !f.mimeType)
    );
  }

  return allFiles;
}

/**
 * Deletes an STL file from Google Drive when explicitly confirmed by the user.
 */
export async function deleteSTLFromDrive(fileId: string): Promise<void> {
  if (!fileId) return;
  const token = getAccessToken();
  if (!token) {
    console.warn('Cannot delete Drive file: not authenticated');
    return;
  }

  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    console.warn('Failed to delete file from Google Drive:', err);
  }
}

/**
 * Triggers a browser download for an STL ArrayBuffer
 */
export function downloadSTLBuffer(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], { type: 'model/stl' });
  const cleanName = filename.endsWith('.stl') ? filename : `${filename}.stl`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = cleanName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
