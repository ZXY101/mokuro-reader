import Dexie from 'dexie';
import type { Page, VolumeMetadata } from '$lib/types';
import { CatalogDexieV3 } from '../db-v3';
import { countChars } from '$lib/util/count-chars';
import { deleteOldDatabase } from './detection';
import type { MigrationProgressCallback } from './types';

const DEBUG_LOG_KEY = 'mokuro_migration_debug_log';

function debugLog(message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${message}${data ? ': ' + JSON.stringify(data) : ''}`;
  console.log('[Migration]', entry);

  // Persist to localStorage (keep last 50 entries)
  try {
    const existing = JSON.parse(localStorage.getItem(DEBUG_LOG_KEY) || '[]') as string[];
    existing.push(entry);
    if (existing.length > 50) existing.shift();
    localStorage.setItem(DEBUG_LOG_KEY, JSON.stringify(existing));
  } catch {
    // Ignore localStorage errors
  }
}

export function getMigrationDebugLog(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DEBUG_LOG_KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearMigrationDebugLog() {
  localStorage.removeItem(DEBUG_LOG_KEY);
}

/**
 * Calculate cumulative character counts for each page.
 * Returns an array where index i contains total chars through page i.
 */
export function calculateCumulativeCharCounts(pages: Page[]): number[] {
  let cumulative = 0;
  return pages.map((page) => {
    for (const block of page.blocks || []) {
      for (const line of block.lines || []) {
        cumulative += countChars(line);
      }
    }
    return cumulative;
  });
}

/**
 * Legacy v1 Dexie class for reading old data
 */
class LegacyDexieV1 extends Dexie {
  catalog!: Dexie.Table<{ id: string; manga: any[] }>;

  constructor() {
    super('mokuro');
    this.version(1).stores({
      catalog: 'id, manga'
    });
  }
}

/**
 * Legacy v2 Dexie class for reading old data
 */
class LegacyDexieV2 extends Dexie {
  volumes!: Dexie.Table<VolumeMetadata & { thumbnail?: File }>;
  volumes_data!: Dexie.Table<{ volume_uuid: string; pages: Page[]; files?: Record<string, File> }>;

  constructor() {
    super('mokuro');
    this.version(2).stores({
      volumes_data: 'volume_uuid',
      volumes: 'volume_uuid',
      catalog: null
    });
  }
}

interface VolumeDataForMigration {
  metadata: Omit<VolumeMetadata, 'page_char_counts'>;
  thumbnail?: File;
  pages: Page[];
  files?: Record<string, File>;
}

/**
 * Write a single volume to the new v3 database.
 */
async function writeVolumeToV3(
  newDb: CatalogDexieV3,
  volumeData: VolumeDataForMigration
): Promise<void> {
  const uuid = volumeData.metadata.volume_uuid;
  const pageCharCounts = calculateCumulativeCharCounts(volumeData.pages);

  await newDb.transaction(
    'rw',
    [newDb.volumes, newDb.volume_thumbnails, newDb.volume_ocr, newDb.volume_files],
    async () => {
      await newDb.volumes.add({
        ...volumeData.metadata,
        page_char_counts: pageCharCounts
      });

      if (volumeData.thumbnail) {
        await newDb.volume_thumbnails.add({
          volume_uuid: uuid,
          thumbnail: volumeData.thumbnail
        });
      }

      await newDb.volume_ocr.add({
        volume_uuid: uuid,
        pages: volumeData.pages
      });

      if (volumeData.files && Object.keys(volumeData.files).length > 0) {
        await newDb.volume_files.add({
          volume_uuid: uuid,
          files: volumeData.files
        });
      }
    }
  );
}

/**
 * Migrate from v1 database - processes one series at a time to minimize memory usage.
 * Deletes each series after migration to free space and track progress.
 */
async function migrateFromV1(
  newDb: CatalogDexieV3,
  migratedSet: Set<string>,
  onProgress: MigrationProgressCallback
): Promise<number> {
  let totalVolumes = 0;
  let migratedCount = 0;
  let seriesIds: string[] = [];
  let totalSeries = 0;

  // First pass: count total volumes and get series IDs
  onProgress({
    phase: 'counting',
    volumesCurrent: 0,
    volumesTotal: 0
  });

  {
    const db = new LegacyDexieV1();
    try {
      await db.catalog.each((entry) => {
        totalVolumes += entry.manga?.length || 0;
      });
      seriesIds = (await db.catalog.toCollection().primaryKeys()) as string[];
      totalSeries = seriesIds.length;
    } finally {
      db.close();
    }
  }

  onProgress({
    phase: 'counting',
    volumesCurrent: migratedCount,
    volumesTotal: totalVolumes,
    seriesCurrent: 0,
    seriesTotal: totalSeries
  });

  // Process each series with fresh connections
  for (let seriesIndex = 0; seriesIndex < seriesIds.length; seriesIndex++) {
    const seriesId = seriesIds[seriesIndex];
    let seriesTitle = 'Unknown Series';

    // Report loading series
    onProgress({
      phase: 'loading_series',
      volumesCurrent: migratedCount,
      volumesTotal: totalVolumes,
      seriesCurrent: seriesIndex + 1,
      seriesTotal: totalSeries
    });

    // Load series with fresh connection, then close immediately
    let manga: any[] = [];
    {
      const db = new LegacyDexieV1();
      try {
        const entry = await db.catalog.get(seriesId);
        if (entry?.manga) {
          manga = entry.manga;
          seriesTitle = manga[0]?.mokuroData?.title || 'Unknown Series';
        }
      } finally {
        db.close();
      }
    }

    if (manga.length === 0) continue;

    const volumeCount = manga.length;

    // Migrate all volumes from this series one at a time
    for (let volIndex = 0; volIndex < volumeCount; volIndex++) {
      const volume = manga[volIndex];
      if (!volume) continue;

      const uuid = volume.mokuroData?.volume_uuid;
      if (!uuid) continue;

      // Skip if already in v3 (from a previous partial run)
      if (migratedSet.has(uuid)) {
        migratedCount++;
        manga[volIndex] = null;
        continue;
      }

      const volumeData: VolumeDataForMigration = {
        metadata: {
          mokuro_version: volume.mokuroData.version,
          series_title: volume.mokuroData.title,
          series_uuid: volume.mokuroData.title_uuid,
          volume_title: volume.mokuroData.volume,
          volume_uuid: uuid,
          page_count: volume.mokuroData.pages?.length || 0,
          character_count: volume.mokuroData.chars || 0
        },
        thumbnail: volume.thumbnail,
        pages: volume.mokuroData.pages || [],
        files: volume.files
      };

      // Report writing volume
      onProgress({
        phase: 'writing_volume',
        volumesCurrent: migratedCount,
        volumesTotal: totalVolumes,
        volumeTitle: volumeData.metadata.volume_title,
        seriesTitle,
        seriesCurrent: seriesIndex + 1,
        seriesTotal: totalSeries
      });

      await writeVolumeToV3(newDb, volumeData);
      migratedSet.add(uuid);
      migratedCount++;

      // Clear this volume from memory to allow GC
      manga[volIndex] = null;

      // Yield to event loop between volumes for GC
      await new Promise((r) => setTimeout(r, 0));
    }

    // Clear manga array reference
    manga = null as any;

    // Give GC time to collect the series data before loading next series
    await new Promise((r) => setTimeout(r, 100));

    // Note: We skip incremental deletes from the old database due to browser bugs
    // with deleting large IndexedDB records. The old database will be deleted
    // entirely after migration completes (scheduled via scheduleOldDbDeletion).
    debugLog('Series migrated, skipping incremental delete', { seriesId, seriesTitle });
  }

  return totalVolumes;
}

/**
 * Migrate from v2 database - processes one volume at a time.
 * Deletes each volume after migration to free space and track progress.
 */
async function migrateFromV2(
  newDb: CatalogDexieV3,
  migratedSet: Set<string>,
  onProgress: MigrationProgressCallback
): Promise<number> {
  const oldDb = new LegacyDexieV2();
  let migratedCount = 0;

  try {
    onProgress({
      phase: 'counting',
      volumesCurrent: 0,
      volumesTotal: 0
    });

    // Get all volume UUIDs efficiently
    const allUuids = (await oldDb.volumes.toCollection().primaryKeys()) as string[];
    const totalVolumes = allUuids.length;

    onProgress({
      phase: 'counting',
      volumesCurrent: migratedCount,
      volumesTotal: totalVolumes
    });

    // Process each volume
    for (let i = 0; i < allUuids.length; i++) {
      const uuid = allUuids[i];

      // Skip if already in v3 (from a previous partial run)
      if (migratedSet.has(uuid)) {
        migratedCount++;
        continue;
      }

      const metadata = await oldDb.volumes.get(uuid);
      if (!metadata) {
        migratedCount++;
        continue;
      }

      const data = await oldDb.volumes_data.get(uuid);
      const { thumbnail, ...metadataWithoutThumbnail } = metadata;

      const volumeData: VolumeDataForMigration = {
        metadata: metadataWithoutThumbnail,
        thumbnail,
        pages: data?.pages || [],
        files: data?.files
      };

      // Report writing volume
      onProgress({
        phase: 'writing_volume',
        volumesCurrent: migratedCount,
        volumesTotal: totalVolumes,
        volumeTitle: volumeData.metadata.volume_title,
        seriesTitle: volumeData.metadata.series_title
      });

      await writeVolumeToV3(newDb, volumeData);
      migratedSet.add(uuid);
      migratedCount++;

      // Report deleting source
      onProgress({
        phase: 'deleting_source',
        volumesCurrent: migratedCount,
        volumesTotal: totalVolumes,
        volumeTitle: volumeData.metadata.volume_title
      });

      // Delete from old database to free space and mark progress
      await oldDb.volumes.delete(uuid);
      await oldDb.volumes_data.delete(uuid);

      // Yield to event loop for GC
      await new Promise((r) => setTimeout(r, 0));
    }

    return totalVolumes;
  } finally {
    oldDb.close();
  }
}

/**
 * Run the migration from old database to v3.
 * This is a blocking operation with progress callbacks.
 *
 * Resumability: If migration is interrupted, volumes already written to v3
 * will be skipped on retry (checked via migratedSet).
 */
export async function runMigration(
  sourceVersion: 1 | 2,
  onProgress: MigrationProgressCallback
): Promise<void> {
  debugLog('Starting migration', { sourceVersion });

  // Build set of already-migrated volumes from v3 database for skip logic
  const newDb = new CatalogDexieV3();
  const existingUuids = await newDb.volumes.toCollection().primaryKeys();
  const migratedSet = new Set(existingUuids as string[]);

  debugLog('Found existing volumes in v3', { count: migratedSet.size });

  try {
    if (sourceVersion === 1) {
      await migrateFromV1(newDb, migratedSet, onProgress);
    } else {
      await migrateFromV2(newDb, migratedSet, onProgress);
    }

    // Delete old database immediately after successful migration
    debugLog('Migration complete, deleting old database');
    await deleteOldDatabase();
    debugLog('Old database deleted');
  } finally {
    newDb.close();
  }
}

/**
 * Rollback a failed migration by deleting the new database.
 */
export async function rollbackMigration(): Promise<void> {
  await Dexie.delete('mokuro_v3');
}
