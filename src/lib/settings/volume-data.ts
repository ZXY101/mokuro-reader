import { browser } from '$app/environment';
import { derived, get, writable } from 'svelte/store';
import { settings } from './settings';
import { zoomDefault } from '$lib/panzoom';

export type VolumeSettings = {
  rightToLeft: boolean;
  singlePageView: boolean;
  hasCover: boolean;
}

export type VolumeSettingsKey = keyof VolumeSettings;

type Progress = Record<string, number> | undefined;

type VolumeData = {
  progress: number;
  chars: number;
  settings: VolumeSettings;
  completed: boolean;
}

type Volumes = Record<string, VolumeData>;


const stored = browser ? window.localStorage.getItem('volumes') : undefined;
const initial: Volumes = stored && browser ? JSON.parse(stored) : undefined;

export const volumes = writable<Volumes>(initial);

export function initializeVolume(volume: string) {
  const { hasCover, rightToLeft, singlePageView } = get(settings).volumeDefaults
  volumes.update((prev) => {
    return {
      ...prev,
      [volume]: {
        chars: 0,
        completed: false,
        progress: 0,
        settings: {
          hasCover,
          rightToLeft,
          singlePageView
        }
      }
    };
  });
}

export function deleteVolume(volume: string) {
  volumes.update((prev) => {
    delete prev[volume]
    return prev
  })
}

export function clearVolumes() {
  volumes.set({});
}

export function updateProgress(volume: string, progress: number, chars: number, completed = false) {
  volumes.update((prev) => {
    return {
      ...prev,
      [volume]: {
        ...prev?.[volume],
        progress,
        chars,
        completed
      }
    };
  });
}

volumes.subscribe((volumes) => {
  if (browser) {
    window.localStorage.setItem('volumes', volumes ? JSON.stringify(volumes) : '');
  }
});

export const progress = derived(volumes, ($volumes) => {
  const progress: Progress = {}

  if ($volumes) {
    Object.keys($volumes).forEach((key) => {
      progress[key] = $volumes[key].progress
    });
  }

  return progress
})

export const volumeSettings = derived(volumes, ($volumes) => {
  const settings: Record<string, VolumeSettings> = {}

  if ($volumes) {
    Object.keys($volumes).forEach((key) => {
      settings[key] = $volumes[key].settings
    });
  }

  return settings
})

export function updateVolumeSetting(volume: string, key: VolumeSettingsKey, value: any) {
  volumes.update((prev) => {
    return {
      ...prev,
      [volume]: {
        ...prev[volume],
        settings: {
          ...prev[volume].settings,
          [key]: value
        }
      }
    };
  });
  zoomDefault();
}