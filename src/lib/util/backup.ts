import type { VolumeMetadata } from '$lib/types';
import { driveApiClient, escapeNameForDriveQuery } from './google-drive/api-client';
import { driveFilesCache } from './google-drive/drive-files-cache';
import { createArchiveBlob } from './zip';

/**
 * Uploads a CBZ blob to Google Drive
 * @param blob The CBZ blob to upload
 * @param filename The name for the file
 * @param parentFolderId Optional parent folder ID
 * @returns Promise resolving to the uploaded file ID
 */
export async function uploadCbzToDrive(
  blob: Blob,
  filename: string,
  parentFolderId?: string
): Promise<string> {
  // Use simple resumable upload for large binary files
  const { access_token } = gapi.auth.getToken();

  const metadata = {
    name: filename,
    mimeType: 'application/x-cbz',
    ...(parentFolderId && { parents: [parentFolderId] })
  };

  // Step 1: Initiate resumable upload session
  const initResponse = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    }
  );

  if (!initResponse.ok) {
    throw new Error(`Upload init failed: ${initResponse.status} ${initResponse.statusText}`);
  }

  // Step 2: Upload the actual file data
  const uploadUrl = initResponse.headers.get('Location');
  if (!uploadUrl) {
    throw new Error('No upload URL returned');
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/x-cbz'
    },
    body: blob
  });

  if (!uploadResponse.ok) {
    throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
  }

  const result = await uploadResponse.json();
  return result.id;
}

/**
 * Finds or creates a folder in Google Drive
 * @param folderName The name of the folder
 * @param parentFolderId Optional parent folder ID
 * @returns Promise resolving to the folder ID
 */
export async function getOrCreateFolder(
  folderName: string,
  parentFolderId?: string
): Promise<string> {
  const escapedFolderName = escapeNameForDriveQuery(folderName);

  // Search for existing folder
  const query = parentFolderId
    ? `name='${escapedFolderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    : `name='${escapedFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const files = await driveApiClient.listFiles(query, 'files(id, name)');

  if (files.length > 0) {
    return files[0].id;
  }

  // Create folder if it doesn't exist
  return await driveApiClient.createFolder(folderName, parentFolderId);
}

/**
 * Checks if a file exists in Google Drive
 * @param fileName The name of the file
 * @param parentFolderId Optional parent folder ID
 * @returns Promise resolving to the file ID if it exists, or null
 */
export async function findFile(
  fileName: string,
  parentFolderId?: string
): Promise<string | null> {
  const escapedFileName = escapeNameForDriveQuery(fileName);

  const query = parentFolderId
    ? `name='${escapedFileName}' and '${parentFolderId}' in parents and trashed=false`
    : `name='${escapedFileName}' and trashed=false`;

  const files = await driveApiClient.listFiles(query, 'files(id, name)');

  return files.length > 0 ? files[0].id : null;
}

/**
 * Backs up a volume to Google Drive
 * @param volume The volume to backup
 * @param onProgress Optional progress callback (current, total)
 * @returns Promise resolving to the uploaded file ID
 */
export async function backupVolumeToDrive(
  volume: VolumeMetadata,
  onProgress?: (step: string) => void
): Promise<string> {
  let cbzBlob: Blob | null = null;

  try {
    // Create the series folder
    onProgress?.('Creating folder...');
    const rootFolderId = await getOrCreateFolder('mokuro-reader');
    const seriesFolderId = await getOrCreateFolder(volume.series_title, rootFolderId);

    // Create CBZ using the shared function
    onProgress?.('Creating archive...');
    cbzBlob = await createArchiveBlob([volume]);

    // Upload
    const fileName = `${volume.volume_title}.cbz`;
    onProgress?.('Uploading to Google Drive...');
    const fileId = await uploadCbzToDrive(cbzBlob, fileName, seriesFolderId);

    // Update the cache with the newly uploaded file
    driveFilesCache.addDriveFile(volume.series_title, volume.volume_title, {
      fileId,
      name: fileName,
      modifiedTime: new Date().toISOString(),
      size: cbzBlob.size,
      path: `${volume.series_title}/${fileName}`
    });

    return fileId;
  } finally {
    // Explicit memory cleanup
    cbzBlob = null;

    // Hint to garbage collector (non-standard but helps in V8/Chrome)
    if (typeof (globalThis as any).gc === 'function') {
      (globalThis as any).gc();
    }
  }
}

/**
 * Backs up multiple volumes to Google Drive with batching and memory management
 * @param volumes Array of volumes to backup
 * @param onProgress Optional progress callback (completed, total, currentVolume)
 * @returns Promise resolving to success/failure counts
 */
export async function backupMultipleVolumesToDrive(
  volumes: VolumeMetadata[],
  onProgress?: (completed: number, total: number, currentVolume: string) => void
): Promise<{ succeeded: number; failed: number }> {
  const BATCH_SIZE = 5; // Process 5 volumes at a time
  const BATCH_DELAY_MS = 2000; // 2 second delay between batches for GC

  let successCount = 0;
  let failCount = 0;

  // Process in batches
  for (let batchStart = 0; batchStart < volumes.length; batchStart += BATCH_SIZE) {
    const batch = volumes.slice(batchStart, batchStart + BATCH_SIZE);

    // Process each volume in the batch
    for (const volume of batch) {
      try {
        onProgress?.(successCount + failCount, volumes.length, volume.volume_title);
        await backupVolumeToDrive(volume);
        successCount++;
      } catch (error) {
        console.error(`Failed to backup ${volume.volume_title}:`, error);
        failCount++;
      }
    }

    // Delay between batches to allow garbage collection
    if (batchStart + BATCH_SIZE < volumes.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return { succeeded: successCount, failed: failCount };
}
