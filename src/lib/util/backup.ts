import type { VolumeMetadata } from '$lib/types';
import { driveApiClient } from './google-drive/api-client';
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
  // Convert blob to base64
  const reader = new FileReader();
  const base64Promise = new Promise<string>((resolve, reject) => {
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix to get just the base64 string
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const base64Content = await base64Promise;

  // Upload using multipart upload
  const boundary = '-------314159265358979323846';
  const delimiter = '\r\n--' + boundary + '\r\n';
  const closeDelimiter = '\r\n--' + boundary + '--';

  const metadata = {
    name: filename,
    mimeType: 'application/x-cbz',
    ...(parentFolderId && { parents: [parentFolderId] })
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/x-cbz\r\n' +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    base64Content +
    closeDelimiter;

  const response = await gapi.client.request({
    path: '/upload/drive/v3/files',
    method: 'POST',
    params: { uploadType: 'multipart' },
    headers: {
      'Content-Type': 'multipart/related; boundary="' + boundary + '"'
    },
    body: multipartRequestBody
  });

  return response.result.id;
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
  // Escape single quotes and backslashes in folder name for Drive query
  const escapedFolderName = folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

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
  // Escape single quotes and backslashes in file name for Drive query
  const escapedFileName = fileName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

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
  // Create the series folder
  onProgress?.('Creating folder...');
  const rootFolderId = await getOrCreateFolder('mokuro-reader');
  const seriesFolderId = await getOrCreateFolder(volume.series_title, rootFolderId);

  // Check if file already exists
  const fileName = `${volume.volume_title}.cbz`;
  onProgress?.('Checking for existing file...');
  const existingFileId = await findFile(fileName, seriesFolderId);

  // Create CBZ using the shared function
  onProgress?.('Creating archive...');
  const cbzBlob = await createArchiveBlob([volume]);

  // Upload
  onProgress?.('Uploading to Google Drive...');
  const fileId = await uploadCbzToDrive(cbzBlob, fileName, seriesFolderId);

  // Delete old file if it existed and is different from the new one
  if (existingFileId && existingFileId !== fileId) {
    try {
      await gapi.client.drive.files.delete({ fileId: existingFileId });
    } catch (error) {
      console.warn('Failed to delete old file:', error);
    }
  }

  // Update the cache with the newly uploaded file
  driveFilesCache.addDriveFile(volume.series_title, volume.volume_title, {
    fileId,
    name: fileName,
    modifiedTime: new Date().toISOString(),
    size: cbzBlob.size,
    path: `${volume.series_title}/${fileName}`
  });

  return fileId;
}
