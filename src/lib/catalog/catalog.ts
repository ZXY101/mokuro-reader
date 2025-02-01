import { db } from './db';
import type { VolumeMetadata } from '$lib/types';

export interface Series {
  title: string;
  series_uuid: string;
  volumes: VolumeMetadata[];
}

export interface Catalog {
  series: Series[];
}

function sortVolumes(a: VolumeMetadata, b: VolumeMetadata) {
  return a.volume_title.localeCompare(b.volume_title, undefined, { sensitivity: 'base' });
}

function sortTitles(a: Series, b: Series) {
  return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
}

export function deriveSeriesFromVolumes(volumeEntries: Array<VolumeMetadata>) {
  // Group volumes by series_uuid
  const titleMap = new Map<string, Series>();

  for (const entry of volumeEntries) {
    let volumes = titleMap.get(entry.series_uuid);
    if (volumes === undefined) {
      volumes = {
        title: entry.series_title,
        series_uuid: entry.series_uuid,
        volumes: []
      };
      titleMap.set(entry.series_uuid, volumes);
    }
    volumes.volumes.push(entry);
  }

  // Convert map to array and sort everything
  const titles = Array.from(titleMap.values());

  // Sort volumes within each title
  for (const title of titles) {
    const test = title.volumes.sort(sortVolumes);
    title.volumes
  }

  // Sort titles
  titles.sort(sortTitles);

  return { series: titles };
}

export async function getCatalog(): Promise<Catalog> {
  // Get all volumes from the database
  const volumeEntries = await db.volumes.toArray();
  return deriveSeriesFromVolumes(volumeEntries);
}
