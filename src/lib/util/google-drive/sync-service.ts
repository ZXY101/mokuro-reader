import { writable } from 'svelte/store';
import { progressTrackerStore } from '../progress-tracker';
import { parseVolumesFromJson, volumes } from '$lib/settings';
import { showSnackbar } from '../snackbar';
import { driveApiClient, DriveApiError } from './api-client';
import { tokenManager } from './token-manager';
import { GOOGLE_DRIVE_CONFIG, type SyncProgress } from './constants';

class SyncService {
  private folderIds = writable({
    reader: '',
    volumeData: '',
    profiles: ''
  });

  get readerFolderId() {
    return this.folderIds;
  }

  async ensureReaderFolderExists(): Promise<string> {
    const folders = await driveApiClient.listFiles(
      `mimeType='${GOOGLE_DRIVE_CONFIG.MIME_TYPES.FOLDER}' and name='${GOOGLE_DRIVE_CONFIG.FOLDER_NAMES.READER}'`,
      'files(id)'
    );

    let folderId: string;

    if (folders.length === 0) {
      folderId = await driveApiClient.createFolder(GOOGLE_DRIVE_CONFIG.FOLDER_NAMES.READER);
    } else {
      folderId = folders[0].id;
    }

    this.folderIds.update(ids => ({ ...ids, reader: folderId }));
    return folderId;
  }

  async findFileInFolder(fileName: string, folderId: string): Promise<string> {
    const files = await driveApiClient.listFiles(
      `'${folderId}' in parents and name='${fileName}'`,
      'files(id)'
    );

    return files.length > 0 ? files[0].id : '';
  }

  async syncReadProgress(): Promise<void> {
    if (!tokenManager.isAuthenticated()) {
      localStorage.setItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.SYNC_AFTER_LOGIN, 'true');
      // Re-authentication: use minimal prompt to reuse existing permissions
      tokenManager.requestNewToken(false, false);
      return;
    }

    const processId = 'sync-read-progress';
    
    try {
      progressTrackerStore.addProcess({
        id: processId,
        description: 'Syncing read progress',
        progress: 0,
        status: 'Initializing...'
      });

      // Step 1: Ensure folder structure exists
      progressTrackerStore.updateProcess(processId, {
        progress: 10,
        status: 'Setting up folder structure...'
      });

      const readerFolderId = await this.ensureReaderFolderExists();
      const volumeDataFileId = await this.findFileInFolder(
        GOOGLE_DRIVE_CONFIG.FILE_NAMES.VOLUME_DATA,
        readerFolderId
      );

      // Step 2: Download cloud data if it exists
      let cloudVolumes = {};
      if (volumeDataFileId) {
        progressTrackerStore.updateProcess(processId, {
          progress: 30,
          status: 'Downloading cloud data...'
        });

        try {
          const cloudData = await driveApiClient.getFileContent(volumeDataFileId);
          cloudVolumes = parseVolumesFromJson(cloudData);
        } catch (error) {
          console.warn('Failed to download cloud data, continuing with local data only');
        }
      }

      // Step 3: Merge data
      progressTrackerStore.updateProcess(processId, {
        progress: 60,
        status: 'Merging local and cloud data...'
      });

      const mergedVolumes = await this.mergeVolumeData(cloudVolumes);

      // Step 4: Update local storage
      progressTrackerStore.updateProcess(processId, {
        progress: 80,
        status: 'Updating local data...'
      });

      volumes.update(() => mergedVolumes);

      // Step 5: Upload merged data
      progressTrackerStore.updateProcess(processId, {
        progress: 90,
        status: 'Uploading merged data...'
      });

      await this.uploadVolumeData(mergedVolumes, volumeDataFileId, readerFolderId);

      progressTrackerStore.updateProcess(processId, {
        progress: 100,
        status: 'Sync complete'
      });

      showSnackbar('Read progress synced successfully');
      
    } catch (error) {
      this.handleSyncError(error, processId);
    } finally {
      setTimeout(() => progressTrackerStore.removeProcess(processId), 3000);
    }
  }

  private async mergeVolumeData(cloudVolumes: any): Promise<any> {
    return new Promise((resolve) => {
      volumes.subscribe(localVolumes => {
        const merged = {};
        const allVolumeIds = new Set([
          ...Object.keys(localVolumes),
          ...Object.keys(cloudVolumes)
        ]);

        allVolumeIds.forEach(volumeId => {
          const local = localVolumes[volumeId];
          const cloud = cloudVolumes[volumeId];

          if (!local) {
            merged[volumeId] = cloud;
          } else if (!cloud) {
            merged[volumeId] = local;
          } else {
            // Keep the newer record based on lastProgressUpdate
            const localDate = new Date(local.lastProgressUpdate).getTime();
            const cloudDate = new Date(cloud.lastProgressUpdate).getTime();
            merged[volumeId] = localDate >= cloudDate ? local : cloud;
          }
        });

        resolve(merged);
      })();
    });
  }

  private async uploadVolumeData(
    volumeData: any,
    existingFileId: string,
    parentFolderId: string
  ): Promise<void> {
    const content = JSON.stringify(volumeData);
    const metadata = {
      name: GOOGLE_DRIVE_CONFIG.FILE_NAMES.VOLUME_DATA,
      mimeType: GOOGLE_DRIVE_CONFIG.MIME_TYPES.JSON,
      ...(existingFileId ? {} : { parents: [parentFolderId] })
    };

    await driveApiClient.uploadFile(content, metadata, existingFileId);
  }

  private handleSyncError(error: any, processId: string): void {
    let errorMessage = 'Sync failed';
    let shouldPromptReauth = false;

    if (error instanceof DriveApiError) {
      if (error.isNetworkError) {
        errorMessage = 'Network error - please check your connection';
      } else if (error.status === 401 || error.status === 403) {
        errorMessage = 'Session expired - please sign in again';
        shouldPromptReauth = true;
      } else {
        errorMessage = `Sync failed: ${error.message}`;
      }
    }

    progressTrackerStore.updateProcess(processId, {
      progress: 0,
      status: errorMessage
    });

    showSnackbar(errorMessage);
    console.error('Sync error:', error);

    // If auth error, set flag to prompt re-auth after next login
    if (shouldPromptReauth) {
      localStorage.setItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.SYNC_AFTER_LOGIN, 'true');
    }
  }
}

export const syncService = new SyncService();
