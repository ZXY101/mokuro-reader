import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type MiscSettings = {
  galleryLayout: 'grid' | 'list';
  gallerySorting: 'ASC' | 'DESC' | 'SMART';
  deviceRamGB: 4 | 8 | 16 | 32;
  turboMode: boolean;
  gdriveAutoReAuth: boolean;
  // Catalog layout settings
  catalogHorizontalStep: number; // Horizontal offset percentage (default 11)
  catalogVerticalStep: number; // Vertical offset percentage (default 11)
  catalogStackCount: number; // Number of volumes to show (1-50, default 3)
  catalogHideReadVolumes: boolean; // Hide read volumes from in-progress series stack
};

export type MiscSettingsKey = keyof MiscSettings;

// Detect device memory and set default RAM config
function getDefaultRamSetting(): 4 | 8 | 16 | 32 {
  if (browser) {
    const deviceMemory = (navigator as any).deviceMemory;
    if (deviceMemory !== undefined) {
      // deviceMemory is capped at 8GB, but if it reports 8, assume 16GB+ is likely
      if (deviceMemory >= 8) return 16;
      if (deviceMemory >= 4) return 8;
      if (deviceMemory >= 2) return 4;
    }
  }
  return 4; // Conservative default
}

const defaultSettings: MiscSettings = {
  galleryLayout: 'grid',
  gallerySorting: 'SMART',
  deviceRamGB: getDefaultRamSetting(),
  turboMode: false, // Default to single-operation mode (patient users)
  gdriveAutoReAuth: true, // Keep users synced during long reading sessions
  // Catalog layout defaults
  catalogHorizontalStep: 11,
  catalogVerticalStep: 11,
  catalogStackCount: 3,
  catalogHideReadVolumes: true
};

const stored = browser ? window.localStorage.getItem('miscSettings') : undefined;

export const miscSettings = writable<MiscSettings>(stored ? JSON.parse(stored) : defaultSettings);

miscSettings.subscribe((miscSettings) => {
  if (browser) {
    window.localStorage.setItem('miscSettings', JSON.stringify(miscSettings));
  }
});

export function updateMiscSetting(key: MiscSettingsKey, value: any) {
  miscSettings.update((miscSettings) => {
    return {
      ...miscSettings,
      [key]: value
    };
  });
}
