import { writable } from 'svelte/store';
import { driveApiClient } from './api-client';
import { GOOGLE_DRIVE_CONFIG } from './constants';
import { syncService } from './sync-service';

export interface DriveFileMetadata {
  fileId: string;
  name: string;
  modifiedTime: string;
  size?: number;
  path: string; // Relative path like "series/volume.cbz"
  description?: string; // Verified series title for sideloaded files
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
  private cache = writable<Map<string, DriveFileMetadata[]>>(new Map());
  private isFetchingStore = writable<boolean>(false);
  private cacheLoadedStore = writable<boolean>(false);
  private isFetching = false;
  private lastFetchTime: number | null = null;

  get store() {
    return this.cache;
  }

  get isFetchingState() {
    return this.isFetchingStore;
  }

  get cacheLoaded() {
    return this.cacheLoadedStore;
  }

  getVolumeDataFileId(): string | null {
    const files = this.getVolumeDataFiles();
    return files.length > 0 ? files[0].fileId : null;
  }

  getVolumeDataFiles(): DriveFileMetadata[] {
    let currentCache: Map<string, DriveFileMetadata[]> = new Map();
    this.cache.subscribe((value) => {
      currentCache = value;
    })();

    return currentCache.get(GOOGLE_DRIVE_CONFIG.FILE_NAMES.VOLUME_DATA) || [];
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
    this.isFetchingStore.set(true);
    try {
      console.log('Fetching all Drive file metadata...');

      // Get only files owned by the user (guarantees edit permissions)
      // This filters out viewer-only shared files while keeping shared files with edit access that user owns
      const allItems = await driveApiClient.listFiles(
        `'me' in owners and trashed=false`,
        'files(id,name,mimeType,modifiedTime,size,parents,description)'
      );
      console.log('Found items:', allItems);

      // Count by file type
      const typeCounts: Record<string, number> = {};
      const cbzFiles: any[] = [];
      const volumeDataFiles: any[] = [];
      const folderNames = new Map<string, string>();
      const foundFolderNames: string[] = [];

      for (const item of allItems) {
        const ext = item.name && item.name.includes('.') ? item.name.split('.').pop() || 'no-extension' : 'no-extension';
        typeCounts[ext] = (typeCounts[ext] || 0) + 1;

        if (item.mimeType === GOOGLE_DRIVE_CONFIG.MIME_TYPES.FOLDER) {
          folderNames.set(item.id, item.name);
          foundFolderNames.push(item.name);
        } else if (item.name.endsWith('.cbz')) {
          cbzFiles.push(item);
        } else if (item.name === GOOGLE_DRIVE_CONFIG.FILE_NAMES.VOLUME_DATA) {
          volumeDataFiles.push(item);
        }
      }

      // Log warning if duplicates found
      if (volumeDataFiles.length > 1) {
        console.warn(`Found ${volumeDataFiles.length} volume-data.json files - duplicates will be merged and cleaned up during sync`);
      }

      console.log('File type counts:', typeCounts);
      console.log(`Found ${cbzFiles.length} .cbz files and ${folderNames.size} folders`);
      console.log('Folder names:', foundFolderNames);

      // Build cache from files using the folder map
      // All entries are arrays to support Drive's duplicate file names
      const cacheMap = new Map<string, DriveFileMetadata[]>();

      // Add .cbz files (group by path in case of duplicates)
      for (const file of cbzFiles) {
        const parentId = file.parents?.[0];
        const parentName = parentId ? folderNames.get(parentId) : null;

        if (parentName) {
          const path = `${parentName}/${file.name}`;
          const metadata: DriveFileMetadata = {
            fileId: file.id,
            name: file.name,
            modifiedTime: file.modifiedTime || new Date().toISOString(),
            size: file.size ? parseInt(file.size) : undefined,
            path: path,
            description: file.description
          };

          const existing = cacheMap.get(path);
          if (existing) {
            existing.push(metadata);
          } else {
            cacheMap.set(path, [metadata]);
          }
        }
      }

      // Add volume-data.json files as an array
      if (volumeDataFiles.length > 0) {
        const volumeDataMetadata = volumeDataFiles.map(file => {
          console.log('Volume data file from API:', file);
          return {
            fileId: file.id,
            name: file.name,
            modifiedTime: file.modifiedTime || new Date().toISOString(),
            size: file.size ? parseInt(file.size) : undefined,
            path: file.name
          };
        });

        console.log('Cached volume data metadata:', volumeDataMetadata);
        cacheMap.set(GOOGLE_DRIVE_CONFIG.FILE_NAMES.VOLUME_DATA, volumeDataMetadata);
      }

      console.log(`Cached ${cbzFiles.length} .cbz files and ${volumeDataFiles.length} volume-data.json file(s)`);
      this.cache.set(cacheMap);
      this.lastFetchTime = Date.now();
      this.cacheLoadedStore.set(true);

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
      this.isFetchingStore.set(false);

      // Check if sync was requested after login (do this in finally to ensure fetch is complete)
      const shouldSync = typeof window !== 'undefined' &&
        localStorage.getItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.SYNC_AFTER_LOGIN) === 'true';

      if (shouldSync) {
        console.log('Cache loaded, triggering requested sync...');
        localStorage.removeItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.SYNC_AFTER_LOGIN);

        syncService.syncReadProgress().catch(err =>
          console.error('Sync after login failed:', err)
        );
      }
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
    let currentCache: Map<string, DriveFileMetadata[]> = new Map();
    this.cache.subscribe((value) => {
      currentCache = value;
    })();

    const path = `${seriesTitle}/${volumeTitle}.cbz`;
    const files = currentCache.get(path);
    return files !== undefined && files.length > 0;
  }

  /**
   * Get Drive file metadata by path (parent/filename)
   * Returns first file if there are duplicates
   */
  getDriveFile(seriesTitle: string, volumeTitle: string): DriveFileMetadata | undefined {
    let currentCache: Map<string, DriveFileMetadata[]> = new Map();
    this.cache.subscribe((value) => {
      currentCache = value;
    })();

    const path = `${seriesTitle}/${volumeTitle}.cbz`;
    const files = currentCache.get(path);
    return files && files.length > 0 ? files[0] : undefined;
  }

  /**
   * Get ALL Drive file metadata by path (parent/filename)
   * Returns array of all files with this path (handles duplicates)
   */
  getDriveFiles(seriesTitle: string, volumeTitle: string): DriveFileMetadata[] {
    let currentCache: Map<string, DriveFileMetadata[]> = new Map();
    this.cache.subscribe((value) => {
      currentCache = value;
    })();

    const path = `${seriesTitle}/${volumeTitle}.cbz`;
    return currentCache.get(path) || [];
  }

  /**
   * Get all files that exist in Drive
   * Future use: Discover remote-only volumes for download placeholders
   */
  getAllDriveFiles(): DriveFileMetadata[] {
    let currentCache: Map<string, DriveFileMetadata[]> = new Map();
    this.cache.subscribe((value) => {
      currentCache = value;
    })();

    const result: DriveFileMetadata[] = [];
    for (const files of currentCache.values()) {
      result.push(...files);
    }
    return result;
  }

  /**
   * Get all Drive files for a specific series
   * Future use: Show remote-only volumes in series view
   */
  getDriveFilesBySeries(seriesTitle: string): DriveFileMetadata[] {
    let currentCache: Map<string, DriveFileMetadata[]> = new Map();
    this.cache.subscribe((value) => {
      currentCache = value;
    })();

    const result: DriveFileMetadata[] = [];
    for (const files of currentCache.values()) {
      result.push(...files.filter((file) => file.path.startsWith(`${seriesTitle}/`)));
    }
    return result;
  }

  /**
   * Add or update the Drive state after successful upload
   */
  addDriveFile(seriesTitle: string, volumeTitle: string, metadata: DriveFileMetadata): void {
    this.cache.update((cache) => {
      const path = `${seriesTitle}/${volumeTitle}.cbz`;
      const newCache = new Map(cache);
      const existing = newCache.get(path);

      if (existing) {
        // Check if this file ID already exists, replace it
        const index = existing.findIndex(f => f.fileId === metadata.fileId);
        if (index >= 0) {
          existing[index] = metadata;
        } else {
          existing.push(metadata);
        }
      } else {
        newCache.set(path, [metadata]);
      }

      return newCache;
    });
  }

  /**
   * Remove specific file from cache by file ID
   */
  removeDriveFileById(fileId: string): void {
    this.cache.update((cache) => {
      const newCache = new Map(cache);

      for (const [path, files] of newCache.entries()) {
        const filtered = files.filter(f => f.fileId !== fileId);
        if (filtered.length === 0) {
          newCache.delete(path);
        } else if (filtered.length !== files.length) {
          newCache.set(path, filtered);
        }
      }

      return newCache;
    });
  }

  /**
   * Remove from cache after deletion from Drive (removes all files with this path)
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
   * Update file description in cache
   */
  updateFileDescription(fileId: string, description: string): void {
    this.cache.update((cache) => {
      const newCache = new Map(cache);

      for (const [path, files] of newCache.entries()) {
        const updated = files.map(file =>
          file.fileId === fileId
            ? { ...file, description }
            : file
        );
        newCache.set(path, updated);
      }

      return newCache;
    });
  }

  /**
   * Clear the entire cache (useful for sign out)
   */
  clearCache(): void {
    this.cache.set(new Map());
    this.cacheLoadedStore.set(false);
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
