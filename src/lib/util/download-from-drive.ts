import type { VolumeMetadata, VolumeData } from '$lib/types';
import { tokenManager } from './google-drive/token-manager';
import { progressTrackerStore } from './progress-tracker';
import { showSnackbar } from './snackbar';
import { db } from '$lib/catalog/db';
import { generateThumbnail } from '$lib/catalog/thumbnails';
import { driveApiClient } from './google-drive/api-client';
import { driveFilesCache } from './google-drive/drive-files-cache';
import DownloadWorker from '$lib/workers/download-worker?worker';

interface MokuroData {
  version: string;
  title: string;
  title_uuid: string;
  pages: any[];
  chars: number;
  volume: string;
  volume_uuid: string;
}

interface DecompressedEntry {
  filename: string;
  data: ArrayBuffer;
}

/**
 * Download a volume from Google Drive and save it to IndexedDB
 * Converts a placeholder into a real volume with all data
 */
export async function downloadVolumeFromDrive(placeholder: VolumeMetadata): Promise<void> {
  if (!placeholder.isPlaceholder || !placeholder.driveFileId) {
    throw new Error('Can only download placeholders with Drive file IDs');
  }

  const processId = `download-${placeholder.driveFileId}`;

  try {
    // Get access token
    let token = '';
    tokenManager.token.subscribe((value) => {
      token = value;
    })();
    if (!token) {
      throw new Error('No access token available');
    }

    progressTrackerStore.addProcess({
      id: processId,
      description: `Downloading ${placeholder.volume_title}`,
      progress: 0,
      status: 'Starting download...'
    });

    // Create and start worker
    const worker = new DownloadWorker();
    const downloadPromise = new Promise<DecompressedEntry[]>((resolve, reject) => {
      worker.onmessage = (event) => {
        const message = event.data;

        if (message.type === 'progress') {
          const percent = Math.round((message.loaded / message.total) * 100);
          progressTrackerStore.updateProcess(processId, {
            progress: percent,
            status: `Downloading... ${percent}%`
          });
        } else if (message.type === 'complete') {
          worker.terminate();
          resolve(message.entries);
        } else if (message.type === 'error') {
          worker.terminate();
          reject(new Error(message.error));
        }
      };

      worker.onerror = (error) => {
        worker.terminate();
        reject(error);
      };

      // Start download
      worker.postMessage({
        fileId: placeholder.driveFileId,
        fileName: placeholder.volume_title + '.cbz',
        accessToken: token
      });
    });

    const entries = await downloadPromise;

    progressTrackerStore.updateProcess(processId, {
      progress: 90,
      status: 'Processing files...'
    });

    // Find .mokuro file
    const mokuroEntry = entries.find((e) => e.filename.endsWith('.mokuro'));
    if (!mokuroEntry) {
      throw new Error('No .mokuro file found in CBZ');
    }

    // Parse mokuro JSON
    const mokuroText = new TextDecoder().decode(mokuroEntry.data);
    const mokuroData: MokuroData = JSON.parse(mokuroText);

    // Create VolumeMetadata from mokuro data
    const metadata: VolumeMetadata = {
      mokuro_version: mokuroData.version,
      series_title: mokuroData.title,
      series_uuid: mokuroData.title_uuid,
      volume_title: mokuroData.volume,
      volume_uuid: mokuroData.volume_uuid,
      page_count: mokuroData.pages.length,
      character_count: mokuroData.chars
    };

    // Convert image entries to File objects
    const files: Record<string, File> = {};
    for (const entry of entries) {
      if (!entry.filename.endsWith('.mokuro') && !entry.filename.includes('__MACOSX')) {
        const blob = new Blob([entry.data]);
        files[entry.filename] = new File([blob], entry.filename);
      }
    }

    // Create VolumeData
    const volumeData: VolumeData = {
      volume_uuid: mokuroData.volume_uuid,
      pages: mokuroData.pages,
      files
    };

    // Generate thumbnail from first image
    const fileNames = Object.keys(files).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
    if (fileNames.length > 0) {
      metadata.thumbnail = await generateThumbnail(files[fileNames[0]]);
    }

    // Save to IndexedDB
    const existingVolume = await db.volumes
      .where('volume_uuid')
      .equals(metadata.volume_uuid)
      .first();

    if (!existingVolume) {
      await db.transaction('rw', db.volumes, db.volumes_data, async () => {
        await db.volumes.add(metadata);
        await db.volumes_data.add(volumeData);
      });
    }

    // Update Drive file description if folder name doesn't match series title
    // This helps with sideloaded files where folder names differ from series titles
    if (placeholder.driveFileId) {
      try {
        // Extract folder name from placeholder's series_title (which came from folder)
        const folderName = placeholder.series_title;
        const actualSeriesTitle = mokuroData.title;

        // Only update if they differ and we have write permissions
        if (folderName !== actualSeriesTitle) {
          // Get file metadata (capabilities and description) in a single API call
          const fileMetadata = await driveApiClient.getFileMetadata(
            placeholder.driveFileId,
            'capabilities/canEdit,description'
          );
          const canEdit = fileMetadata.capabilities?.canEdit ?? false;
          const currentDescription = fileMetadata.description || '';

          if (!canEdit) {
            console.log(`Skipping description update for ${placeholder.volume_title} - file is read-only`);
          } else {
            // Check if description already has a "Series:" tag (case-insensitive)
            const hasSeriesTag = /^series:\s*.+/im.test(currentDescription);

            if (hasSeriesTag) {
              console.log(`Description for ${placeholder.volume_title} already has Series tag, skipping update`);
            } else {
              // Append our series tag to the existing description
              const seriesTag = `Series: ${actualSeriesTitle}`;
              const newDescription = currentDescription
                ? `${seriesTag}\n${currentDescription}`
                : seriesTag;

              console.log(`Updating description for ${placeholder.volume_title}: "${newDescription}"`);

              await driveApiClient.updateFileDescription(placeholder.driveFileId, newDescription);
              driveFilesCache.updateFileDescription(placeholder.driveFileId, newDescription);
            }
          }
        }
      } catch (error) {
        // Log but don't fail the download
        console.warn('Failed to update Drive file description:', error);
      }
    }

    progressTrackerStore.updateProcess(processId, {
      progress: 100,
      status: 'Download complete'
    });

    showSnackbar(`Downloaded ${metadata.volume_title} successfully`, 'success');
  } catch (error) {
    console.error('Failed to download volume:', error);
    progressTrackerStore.updateProcess(processId, {
      progress: 0,
      status: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
    showSnackbar(
      `Failed to download: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'error'
    );
    throw error;
  } finally {
    setTimeout(() => progressTrackerStore.removeProcess(processId), 3000);
  }
}

/**
 * Download all volumes in a series from Google Drive
 */
export async function downloadSeriesFromDrive(placeholders: VolumeMetadata[]): Promise<void> {
  const seriesTitle = placeholders[0]?.series_title;
  if (!seriesTitle) return;

  const processId = `download-series-${seriesTitle}`;

  try {
    progressTrackerStore.addProcess({
      id: processId,
      description: `Downloading ${seriesTitle}`,
      progress: 0,
      status: `0/${placeholders.length} volumes`
    });

    let successCount = 0;
    let failCount = 0;

    placeholders.sort((a, b) => {
      if (a.series_title === b.series_title) {
        return a.volume_title.localeCompare(b.volume_title, undefined, {
          numeric: true,
          sensitivity: 'base'
        });
      } else {
        return a.series_title.localeCompare(b.series_title, undefined, {
          numeric: true,
          sensitivity: 'base'
        });
      }
    });

    for (let i = 0; i < placeholders.length; i++) {
      const placeholder = placeholders[i];
      const progress = Math.round(((i + 1) / placeholders.length) * 100);

      progressTrackerStore.updateProcess(processId, {
        progress,
        status: `${i + 1}/${placeholders.length}: ${placeholder.volume_title}`
      });

      try {
        await downloadVolumeFromDrive(placeholder);
        successCount++;
      } catch (error) {
        console.error(`Failed to download ${placeholder.volume_title}:`, error);
        failCount++;
      }
    }

    if (failCount === 0) {
      showSnackbar(`Successfully downloaded ${successCount} volumes`, 'success');
    } else {
      showSnackbar(`Downloaded ${successCount} volumes, ${failCount} failed`, 'error');
    }
  } finally {
    progressTrackerStore.removeProcess(processId);
  }
}
