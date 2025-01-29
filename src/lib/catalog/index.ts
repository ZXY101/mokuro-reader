import { page } from '$app/stores';
import { db } from '$lib/catalog/db';
import type { VolumeEntry } from '$lib/types';
import { liveQuery } from 'dexie';
import { derived } from 'svelte/store';

function sortVolumes(a: VolumeEntry, b: VolumeEntry) {
  if (a.volume < b.volume) {
    return -1;
  }
  if (a.volume > b.volume) {
    return 1;
  }
  return 0;
}

export const volumes = liveQuery(() => db.volumes.toArray());

export const titleVolumes = derived([page, volumes], ([$page, $volumes]) => {
  if ($page && $volumes) {
    return $volumes
      .filter(item => item.title_uuid === $page.params.manga)
      .sort(sortVolumes);
  }
});

export const currentVolume = derived([page, volumes], ([$page, $volumes]) => {
  if ($page && $volumes) {
    return $volumes.find(item => item.volume_uuid === $page.params.volume);
  }
});