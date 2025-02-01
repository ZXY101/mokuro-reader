import { page } from '$app/stores';
import { db } from '$lib/catalog/db';
import type { VolumeMetadata } from '$lib/types';
import { liveQuery } from 'dexie';
import { readable } from 'svelte/store';
import { derived } from 'svelte/store';
import { deriveSeriesFromVolumes, type Series } from '$lib/catalog/catalog';

function sortVolumes(a: VolumeMetadata, b: VolumeMetadata) {
  if (a.volume_title < b.volume_title) {
    return -1;
  }
  if (a.volume_title > b.volume_title) {
    return 1;
  }
  return 0;
}

export const volumes = readable<VolumeMetadata[]>([], (set) => {
  const subscription = liveQuery(async () =>(await db.volumes.toArray()).sort(sortVolumes)).subscribe({
    next: (value) => set(value),
    error: (err) => console.error(err),
  });
  return () => subscription.unsubscribe();
});

export const catalog = readable<Series[]>([], (set) => {
  const subscription = liveQuery(async () => deriveSeriesFromVolumes(await db.volumes.toArray())).subscribe({
    next: (value) => set(value.series),
    error: (err) => console.error(err),
  });
  return () => subscription.unsubscribe();
});

export const titleVolumes = derived([page, volumes], ([$page, $volumes]) => {
  if ($page && $volumes) {
    return $volumes
      .filter(item => item.series_uuid === $page.params.manga)
      .sort(sortVolumes);
  }
});

export const currentVolume = derived([page, volumes], ([$page, $volumes]) => {
  if ($page && $volumes) {
    return $volumes.find(item => item.volume_uuid === $page.params.volume);
  }
});