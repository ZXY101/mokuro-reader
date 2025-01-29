import type { Page } from '$lib/types';
import Dexie, { type Table } from 'dexie';

export interface VolumeEntry {
  version: string;
  title: string;
  title_uuid: string;
  volume: string;
  volume_uuid: string;
  pages: Page[];
  files: Record<string, File>;
}

export class CatalogDexie extends Dexie {
  volumes!: Table<VolumeEntry>;
  catalog!: Table<{ id: string; manga: any[] }>;

  constructor() {
    super('mokuro');
    this.version(1).stores({
      catalog: 'id, manga'
    });

    // Add volumes table with all fields from MokuroData and Volume types
    this.version(2).stores({
      volumes: 'volume_uuid, title_uuid, title, volume',
      catalog: null // Remove old catalog table
    }).upgrade(async tx => {
      const oldCatalog = await tx.table('catalog').toArray();
      const volumes: VolumeEntry[] = [];
      
      for (const entry of oldCatalog) {
        for (const volume of entry.manga) {
          volumes.push({
            version: volume.mokuroData.version,
            title: volume.mokuroData.title,
            title_uuid: volume.mokuroData.title_uuid,
            volume: volume.mokuroData.volume,
            volume_uuid: volume.mokuroData.volume_uuid,
            pages: volume.mokuroData.pages,
            files: volume.files
          });
        }
      }

      await tx.table('volumes').bulkAdd(volumes);
    });
  }
}

export const db = new CatalogDexie();
