import type { VolumeMetadata } from '$lib/types';

/**
 * Download a volume from Google Drive and save it to IndexedDB
 * Converts a placeholder into a real volume with all data
 *
 * This function now uses the download queue for parallel processing
 */
export async function downloadVolumeFromDrive(placeholder: VolumeMetadata): Promise<void> {
  if (!placeholder.isPlaceholder || !placeholder.driveFileId) {
    throw new Error('Can only download placeholders with Drive file IDs');
  }

  // Import queue dynamically to avoid circular dependency
  const { queueVolume } = await import('./download-queue');
  queueVolume(placeholder);
}

/**
 * Download all volumes in a series from Google Drive
 * Uses the download queue for parallel processing
 */
export async function downloadSeriesFromDrive(placeholders: VolumeMetadata[]): Promise<void> {
  // Import queue dynamically to avoid circular dependency
  const { queueSeriesVolumes } = await import('./download-queue');
  queueSeriesVolumes(placeholders);
}
