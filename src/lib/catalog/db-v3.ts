import type { VolumeMetadata, VolumeThumbnail, VolumeOCR, VolumeFiles } from '$lib/types';
import Dexie, { type Table } from 'dexie';
import { generateThumbnail } from '$lib/catalog/thumbnails';
import { browser } from '$app/environment';

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export class CatalogDexieV3 extends Dexie {
  volumes!: Table<VolumeMetadata>;
  volume_thumbnails!: Table<VolumeThumbnail>;
  volume_ocr!: Table<VolumeOCR>;
  volume_files!: Table<VolumeFiles>;

  constructor(dbName: string = 'mokuro_v3') {
    super(dbName);

    // v3 schema: 4 separate tables
    this.version(1).stores({
      volumes: 'volume_uuid, series_uuid, series_title',
      volume_thumbnails: 'volume_uuid',
      volume_ocr: 'volume_uuid',
      volume_files: 'volume_uuid'
    });
  }

  async processThumbnails(batchSize: number = 5): Promise<void> {
    // Get volume UUIDs that don't have thumbnails yet
    const allVolumeUuids = await this.volumes.toCollection().primaryKeys();
    const existingThumbnailUuids = new Set(
      await this.volume_thumbnails.toCollection().primaryKeys()
    );

    const volumesNeedingThumbnails = allVolumeUuids.filter(
      (uuid) => !existingThumbnailUuids.has(uuid as string)
    );

    if (volumesNeedingThumbnails.length === 0) return;

    // Process in batches
    const batch = volumesNeedingThumbnails.slice(0, batchSize);

    await Promise.all(
      batch.map(async (volumeUuid) => {
        try {
          const files = await this.volume_files.get(volumeUuid as string);
          if (files && files.files) {
            // Get the first image file when sorted naturally
            const fileNames = Object.keys(files.files).sort(naturalSort);
            const firstImageFile = fileNames.length > 0 ? files.files[fileNames[0]] : null;

            if (firstImageFile) {
              const thumbnail = await generateThumbnail(firstImageFile);
              await this.volume_thumbnails.add({
                volume_uuid: volumeUuid as string,
                thumbnail
              });
            }
          }
        } catch (error) {
          console.error('Failed to generate thumbnail for volume:', volumeUuid, error);
        }
      })
    );

    // Continue processing remaining volumes
    if (volumesNeedingThumbnails.length > batchSize) {
      await this.processThumbnails(batchSize);
    }
  }
}

// Singleton instance - will be initialized after migration check
let dbInstance: CatalogDexieV3 | null = null;

export function getV3Database(): CatalogDexieV3 {
  if (!dbInstance) {
    dbInstance = new CatalogDexieV3();
  }
  return dbInstance;
}

// Start thumbnail processing in the background
export function startThumbnailProcessing(): void {
  if (!browser) return;

  const db = getV3Database();
  setTimeout(() => {
    db.processThumbnails().catch((error) => {
      console.error('Error in thumbnail processing:', error);
    });
  }, 1000);
}
