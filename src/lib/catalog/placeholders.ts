import type { VolumeMetadata } from '$lib/types';
import type { DriveFileMetadata } from '$lib/util/google-drive/drive-files-cache';
import { db } from './db';
import { browser } from '$app/environment';

/**
 * Generate a deterministic UUID from a string (used for placeholder UUIDs)
 */
function generateUuidFromString(str: string): string {
  // Simple hash-based UUID generation
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Format as UUID-like string with placeholder prefix
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `placeholder-${hex}`;
}

/**
 * Extract series title from description field
 * Format: "Series: <series name>" on the first line (case-insensitive)
 * Allows user to add their own notes on subsequent lines
 */
function extractSeriesTitleFromDescription(description: string | undefined): string | null {
  if (!description) return null;

  const lines = description.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Match "Series:" prefix (case-insensitive)
    const match = trimmed.match(/^series:\s*(.+)$/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Parse series and volume title from Drive file path and description
 * Expected format: "SeriesTitle/VolumeTitle.cbz"
 * Description overrides folder name if present
 */
function parseDrivePath(
  path: string,
  description?: string
): { seriesTitle: string; volumeTitle: string } | null {
  const parts = path.split('/');
  if (parts.length !== 2) return null;

  const folderName = parts[0];
  const volumeWithExt = parts[1];

  // Remove .cbz extension
  const volumeTitle = volumeWithExt.replace(/\.cbz$/i, '');

  // Prefer verified series title from description over folder name
  const seriesTitle = extractSeriesTitleFromDescription(description) || folderName;

  return { seriesTitle, volumeTitle };
}

/**
 * Generate placeholder VolumeMetadata for a Drive-only file
 */
function createPlaceholder(driveFile: DriveFileMetadata, seriesUuid: string): VolumeMetadata | null {
  const parsed = parseDrivePath(driveFile.path, driveFile.description);
  if (!parsed) return null;

  const { seriesTitle, volumeTitle } = parsed;

  // Use fileId for volume UUID to ensure uniqueness
  const volumeUuid = generateUuidFromString(driveFile.fileId);

  return {
    mokuro_version: 'unknown', // Will be filled in after download
    series_title: seriesTitle,
    series_uuid: seriesUuid,
    volume_title: volumeTitle,
    volume_uuid: volumeUuid,
    page_count: 0, // Unknown until downloaded
    character_count: 0, // Unknown until downloaded

    // Placeholder-specific fields
    isPlaceholder: true,
    driveFileId: driveFile.fileId,
    driveModifiedTime: driveFile.modifiedTime,
    driveSize: driveFile.size
  };
}

/**
 * Identify Drive-only files by comparing Drive cache with local DB
 * Returns placeholder VolumeMetadata for files that exist in Drive but not locally
 */
export async function generatePlaceholders(
  driveFiles: DriveFileMetadata[]
): Promise<VolumeMetadata[]> {
  // Skip during SSR/build - IndexedDB is not available
  if (!browser) {
    return [];
  }

  // Get all local volumes from DB
  const localVolumes = await db.volumes.toArray();

  // Create a set of local volume paths for fast lookup
  const localPaths = new Set(
    localVolumes.map(vol => `${vol.series_title}/${vol.volume_title}.cbz`)
  );

  // Create a map of series titles to their UUIDs from local volumes
  const seriesTitleToUuid = new Map<string, string>();
  for (const vol of localVolumes) {
    if (!seriesTitleToUuid.has(vol.series_title)) {
      seriesTitleToUuid.set(vol.series_title, vol.series_uuid);
    }
  }

  // Find Drive-only files
  const driveOnlyFiles = driveFiles.filter(file => !localPaths.has(file.path));

  // Generate placeholders
  const placeholders: VolumeMetadata[] = [];
  for (const driveFile of driveOnlyFiles) {
    const parsed = parseDrivePath(driveFile.path, driveFile.description);
    if (!parsed) continue;

    // Use existing series UUID if we have local volumes with this series title
    // Otherwise generate a deterministic UUID for a new series
    const seriesUuid = seriesTitleToUuid.get(parsed.seriesTitle)
      || generateUuidFromString(parsed.seriesTitle);

    const placeholder = createPlaceholder(driveFile, seriesUuid);
    if (placeholder) {
      placeholders.push(placeholder);
    }
  }

  return placeholders;
}

/**
 * Check if a volume is a placeholder
 */
export function isPlaceholder(volume: VolumeMetadata): boolean {
  return volume.isPlaceholder === true;
}
