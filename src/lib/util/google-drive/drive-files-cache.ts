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

      // Single query to get ALL items (both .cbz files and folders) in one call
      // This is much more efficient than multiple API calls
      const allItems = await driveApiClient.listFiles(
        `(name contains '.cbz' or mimeType='${GOOGLE_DRIVE_CONFIG.MIME_TYPES.FOLDER}') and trashed=false`,
        'files(id,name,mimeType,modifiedTime,size,parents)'
      );
      console.log('Found items:', allItems);

      // Separate files and folders, build folder ID->name map
      const cbzFiles: any[] = [];
      const folderNames = new Map<string, string>();

      for (const item of allItems) {
        if (item.mimeType === GOOGLE_DRIVE_CONFIG.MIME_TYPES.FOLDER) {
          folderNames.set(item.id, item.name);
        } else if (item.name.endsWith('.cbz')) {
          cbzFiles.push(item);
        }
      }

      console.log(`Found ${cbzFiles.length} .cbz files and ${folderNames.size} folders`);

      // Build cache from files using the folder map
      const cacheMap = new Map<string, DriveFileMetadata>();

      for (const file of cbzFiles) {
        const parentId = file.parents?.[0];
        const parentName = parentId ? folderNames.get(parentId) : null;

        if (parentName) {
          const path = `${parentName}/${file.name}`;
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
   * Check if a file exists in Google Drive by path (parent/filename)
   * Used to determine if a local volume is already backed up
   */
  existsInDrive(seriesTitle: string, volumeTitle: string): boolean {
    let currentCache: Map<string, DriveFileMetadata> = new Map();
    this.cache.subscribe((value) => {
      currentCache = value;
    })();

    const path = `${seriesTitle}/${volumeTitle}.cbz`;
    return currentCache.has(path);
  }

  /**
   * Get Drive file metadata by path (parent/filename)
   */
  getDriveFile(seriesTitle: string, volumeTitle: string): DriveFileMetadata | undefined {
    let currentCache: Map<string, DriveFileMetadata> = new Map();
    this.cache.subscribe((value) => {
      currentCache = value;
    })();

    const path = `${seriesTitle}/${volumeTitle}.cbz`;
    return currentCache.get(path);
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
      const path = `${seriesTitle}/${volumeTitle}.cbz`;
      const newCache = new Map(cache);
      newCache.set(path, metadata);
      return newCache;
    });
  }

  /**
   * Remove from cache after deletion from Drive
   */
  removeDriveFile(seriesTitle: string, volumeTitle: string): void {
    this.cache.update((cache) => {
      const path = `${seriesTitle}/${volumeTitle}.cbz`;
      const newCache = new Map(cache);
      newCache.delete(path);
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
