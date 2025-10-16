import { driveApiClient } from './google-drive/api-client';
import { driveFilesCache } from './google-drive/drive-files-cache';

interface DecompressedEntry {
  filename: string;
  data: ArrayBuffer;
}

interface MokuroData {
  title: string;
  volume: string;
}

/**
 * Update Drive file descriptions for sideloaded files downloaded via cloud page
 * Adds series title tag if not already present in the description
 * This helps future placeholder generation work correctly even if folder names don't match
 */
export async function updateDriveFileDescriptionForEntries(
  fileId: string,
  fileName: string,
  entries: DecompressedEntry[]
): Promise<void> {
  try {
    // Find the .mokuro file in the entries
    const mokuroEntry = entries.find((e) => e.filename.endsWith('.mokuro'));
    if (!mokuroEntry) {
      console.log(`No .mokuro file found in ${fileName}, skipping description update`);
      return;
    }

    // Parse the mokuro data
    const mokuroText = new TextDecoder().decode(mokuroEntry.data);
    const mokuroData: MokuroData = JSON.parse(mokuroText);

    const actualSeriesTitle = mokuroData.title;

    // Get file metadata (capabilities and description) in a single API call
    const fileMetadata = await driveApiClient.getFileMetadata(fileId, 'capabilities/canEdit,description');
    const canEdit = fileMetadata.capabilities?.canEdit ?? false;
    const currentDescription = fileMetadata.description || '';

    if (!canEdit) {
      console.log(`Skipping description update for ${fileName} - file is read-only`);
      return;
    }

    // Check if description already has a "Series:" tag (case-insensitive)
    const hasSeriesTag = /^series:\s*.+/im.test(currentDescription);

    if (hasSeriesTag) {
      console.log(`Description for ${fileName} already has Series tag, skipping update`);
      return;
    }

    // Append our series tag to the existing description
    const seriesTag = `Series: ${actualSeriesTitle}`;
    const newDescription = currentDescription
      ? `${seriesTag}\n${currentDescription}`
      : seriesTag;

    console.log(`Updating description for ${fileName}: "${newDescription}"`);

    await driveApiClient.updateFileDescription(fileId, newDescription);

    // Also update the cache
    driveFilesCache.updateFileDescription(fileId, newDescription);

    console.log(`Successfully updated description for ${fileName}`);
  } catch (error) {
    // Log but don't fail the entire process
    console.warn(`Failed to update Drive file description for ${fileName}:`, error);
  }
}
