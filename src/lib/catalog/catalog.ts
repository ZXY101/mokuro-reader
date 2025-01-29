import { db } from './db';
import type { Volume } from '$lib/types';
import { volumeEntryToVolume } from '$lib/types';

export interface CatalogTitle {
  title: string;
  title_uuid: string;
  volumes: Volume[];
}

export interface Catalog {
  titles: CatalogTitle[];
}

function sortVolumes(a: Volume, b: Volume) {
  return a.mokuroData.volume.localeCompare(b.mokuroData.volume, undefined, { numeric: true, sensitivity: 'base' });
}

function sortTitles(a: CatalogTitle, b: CatalogTitle) {
  return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
}

export async function getCatalog(): Promise<Catalog> {
  // Get all volumes from the database
  const volumeEntries = await db.volumes.toArray();

  // Group volumes by title_uuid
  const titleMap = new Map<string, CatalogTitle>();

  for (const entry of volumeEntries) {
    const volume = volumeEntryToVolume(entry);
    
    if (!titleMap.has(entry.title_uuid)) {
      titleMap.set(entry.title_uuid, {
        title: entry.title,
        title_uuid: entry.title_uuid,
        volumes: []
      });
    }

    titleMap.get(entry.title_uuid)!.volumes.push(volume);
  }

  // Convert map to array and sort everything
  const titles = Array.from(titleMap.values());
  
  // Sort volumes within each title
  for (const title of titles) {
    title.volumes.sort(sortVolumes);
  }

  // Sort titles
  titles.sort(sortTitles);

  return { titles };
}

// Create a store that updates when the database changes
import { derived } from 'svelte/store';
import { liveQuery } from 'dexie';

// Create a store for all volumes
const volumesStore = liveQuery(() => db.volumes.toArray());

// Derive the catalog from the volumes store
export const catalogStore = derived(volumesStore, ($volumes, set) => {
  if ($volumes) {
    const titleMap = new Map<string, CatalogTitle>();

    for (const entry of $volumes) {
      const volume = volumeEntryToVolume(entry);
      
      if (!titleMap.has(entry.title_uuid)) {
        titleMap.set(entry.title_uuid, {
          title: entry.title,
          title_uuid: entry.title_uuid,
          volumes: []
        });
      }

      titleMap.get(entry.title_uuid)!.volumes.push(volume);
    }

    const titles = Array.from(titleMap.values());
    
    // Sort volumes within each title
    for (const title of titles) {
      title.volumes.sort(sortVolumes);
    }

    // Sort titles
    titles.sort(sortTitles);

    set({ titles });
  }
});