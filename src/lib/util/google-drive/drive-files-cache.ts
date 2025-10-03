import { writable } from 'svelte/store';
import { driveApiClient } from './api-client';
import { GOOGLE_DRIVE_CONFIG } from './constants';

export interface DriveFileMetadata {
  fileId: string;
  name: string;
  modifiedTime: string;
  size?: number;
  path: string; // Relative path like "series/volume.cbz"
}

/**
 * In-memory representation of Google Drive's mokuro-reader folder state
 *
 * This cache mirrors the state of ALL .cbz files in Google Drive, serving two purposes:
 * 1. Detect backup status by checking if local volume paths exist in Drive (path collision check)
 * 2. Discover remote-only files for download placeholders (future feature)
 *
 * The cache is populated with a single bulk API call and lives only for the session.
 * It does NOT track local files - only what exists in Google Drive.
 */
class DriveFilesCacheManager {
  private cache = writable<Map<string, DriveFileMetadata>>(new Map());
  private isFetching = false;
  private lastFetchTime: number | null = null;

  get store() {
    return this.cache;
  }

  /**
   * Fetch metadata for ALL .cbz files in the mokuro-reader folder
   * and cache them in memory for the session
   */
  async fetchAllFiles(): Promise<void> {
    if (this.isFetching) {
      console.log('Drive files cache fetch already in progress');
      return;
    }

    this.isFetching = true;
    try {
      console.log('Fetching all Drive file metadata...');

      // Query for ALL .cbz files the app can see (no parent folder constraint)
      const allCbzFiles = await driveApiClient.listFiles(
        `name contains '.cbz' and trashed=false`,
        'id, name, mimeType, modifiedTime, size, parents'
      );
      console.log('Found .cbz files:', allCbzFiles);

      // Fetch all folder names in a single batch
      const folderIds = new Set<string>();
      for (const file of allCbzFiles) {
        if (file.parents && file.parents.length > 0) {
          folderIds.add(file.parents[0]); // Get immediate parent
        }
      }

      const folderNames = new Map<string, string>();
      for (const folderId of folderIds) {
        try {
          const folders = await driveApiClient.listFiles(
            `'${folderId}' in parents`,
            'id, name'
          );
          // Actually get the folder itself, not its contents
          const response = await gapi.client.drive.files.get({
            fileId: folderId,
            fields: 'id, name'
          });
          folderNames.set(folderId, response.result.name || folderId);
        } catch (err) {
          console.warn('Could not fetch folder name for:', folderId);
          folderNames.set(folderId, folderId);
        }
      }

      const cacheMap = new Map<string, DriveFileMetadata>();

      // Build paths from file metadata
      for (const file of allCbzFiles) {
        if (file.name.endsWith('.cbz')) {
          // Build path as seriesFolder/filename
          const parentId = file.parents?.[0];
          const seriesFolder = parentId ? folderNames.get(parentId) || 'unknown' : 'unknown';
          const path = `${seriesFolder}/${file.name}`;

          cacheMap.set(path, {
            fileId: file.id,
            name: file.name,
            modifiedTime: file.modifiedTime || new Date().toISOString(),
            size: file.size ? parseInt(file.size) : undefined,
            path: path
          });
        }
      }

      console.log(`Cached ${cacheMap.size} Drive files:`);
      console.log('Cache paths:', Array.from(cacheMap.keys()));
      this.cache.set(cacheMap);
      this.lastFetchTime = Date.now();
    } catch (error) {
      console.error('Failed to fetch Drive files cache:', error);
      console.error('Error details:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      // Don't clear cache on error, keep stale data
    } finally {
      this.isFetching = false;
    }
  }

  /**
   * Recursively list all .cbz files and build their paths
   */
  private async listAllCbzFiles(
    folderId: string,
    parentPath: string = ''
  ): Promise<DriveFileMetadata[]> {
    const files: DriveFileMetadata[] = [];

    // Get all items in this folder
    const response = await driveApiClient.listFiles(
      `'${folderId}' in parents and trashed=false`,
      'id, name, mimeType, modifiedTime, size'
    );

    if (!response) return files;

    for (const item of response) {
      const currentPath = parentPath ? `${parentPath}/${item.name}` : item.name;

      if (item.mimeType === GOOGLE_DRIVE_CONFIG.MIME_TYPES.FOLDER) {
        // Recurse into subfolders
        const subFiles = await this.listAllCbzFiles(item.id, currentPath);
        files.push(...subFiles);
      } else if (item.name.endsWith('.cbz')) {
        files.push({
          fileId: item.id,
          name: item.name,
          modifiedTime: item.modifiedTime,
          size: item.size ? parseInt(item.size) : undefined,
          path: currentPath
        });
      }
    }

    return files;
  }

  /**
   * Check if a file exists in Google Drive by path
   * Used to determine if a local volume is already backed up
   */
  existsInDrive(seriesTitle: string, volumeTitle: string): boolean {
    let currentCache: Map<string, DriveFileMetadata> = new Map();
    this.cache.subscribe((value) => {
      currentCache = value;
    })();

    const expectedPath = `${seriesTitle}/${volumeTitle}.cbz`;
    return currentCache.has(expectedPath);
  }

  /**
   * Get Drive file metadata by path
   */
  getDriveFile(seriesTitle: string, volumeTitle: string): DriveFileMetadata | undefined {
    let currentCache: Map<string, DriveFileMetadata> = new Map();
    this.cache.subscribe((value) => {
      currentCache = value;
    })();

    const expectedPath = `${seriesTitle}/${volumeTitle}.cbz`;
    return currentCache.get(expectedPath);
  }

  /**
   * Get all files that exist in Drive
   * Future use: Discover remote-only volumes for download placeholders
   */
  getAllDriveFiles(): DriveFileMetadata[] {
    let currentCache: Map<string, DriveFileMetadata> = new Map();
    this.cache.subscribe((value) => {
      currentCache = value;
    })();

    return Array.from(currentCache.values());
  }

  /**
   * Get all Drive files for a specific series
   * Future use: Show remote-only volumes in series view
   */
  getDriveFilesBySeries(seriesTitle: string): DriveFileMetadata[] {
    let currentCache: Map<string, DriveFileMetadata> = new Map();
    this.cache.subscribe((value) => {
      currentCache = value;
    })();

    return Array.from(currentCache.values()).filter((file) =>
      file.path.startsWith(`${seriesTitle}/`)
    );
  }

  /**
   * Add or update the Drive state after successful upload
   */
  addDriveFile(seriesTitle: string, volumeTitle: string, metadata: DriveFileMetadata): void {
    this.cache.update((cache) => {
      const expectedPath = `${seriesTitle}/${volumeTitle}.cbz`;
      const newCache = new Map(cache);
      newCache.set(expectedPath, metadata);
      return newCache;
    });
  }

  /**
   * Remove from cache after deletion from Drive
   */
  removeDriveFile(seriesTitle: string, volumeTitle: string): void {
    this.cache.update((cache) => {
      const expectedPath = `${seriesTitle}/${volumeTitle}.cbz`;
      const newCache = new Map(cache);
      newCache.delete(expectedPath);
      return newCache;
    });
  }

  /**
   * Clear the entire cache (useful for sign out)
   */
  clearCache(): void {
    this.cache.set(new Map());
    this.lastFetchTime = null;
  }

  /**
   * Get time since last fetch (for debugging/UI)
   */
  getLastFetchTime(): number | null {
    return this.lastFetchTime;
  }

  /**
   * Check if cache is currently being fetched
   */
  isFetchingCache(): boolean {
    return this.isFetching;
  }
}

export const driveFilesCache = new DriveFilesCacheManager();
