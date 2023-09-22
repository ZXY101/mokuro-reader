import { browser } from "$app/environment";
import { zoomDefault } from "$lib/panzoom";
import { writable } from "svelte/store";

export type FontSize = 'auto' |
  '9' |
  '10' |
  '11' |
  '12' |
  '14' |
  '16' |
  '18' |
  '20' |
  '24' |
  '32' |
  '40' |
  '48' |
  '60'

export type ZoomModes = 'zoomFitToScreen' |
  'zoomFitToWidth' |
  'zoomOriginal' |
  'keepZoom' |
  'keepZoomStart'

export type Settings = {
  rightToLeft: boolean;
  singlePageView: boolean;
  textEditable: boolean;
  textBoxBorders: boolean;
  displayOCR: boolean;
  boldFont: boolean;
  pageNum: boolean;
  hasCover: boolean;
  backgroundColor: string;
  fontSize: FontSize;
  zoomDefault: ZoomModes;
};

export type SettingsKey = keyof Settings

const defaultSettings: Settings = {
  rightToLeft: true,
  singlePageView: true,
  hasCover: false,
  displayOCR: true,
  textEditable: false,
  textBoxBorders: false,
  boldFont: false,
  pageNum: true,
  backgroundColor: '#0d0d0f',
  fontSize: 'auto',
  zoomDefault: 'zoomFitToScreen'
}

const stored = browser ? window.localStorage.getItem('settings') : undefined
const initialSettings: Settings = stored && browser ? JSON.parse(stored) : defaultSettings

export * from './progress'

export const settings = writable<Settings>(initialSettings);

export function updateSetting(key: SettingsKey, value: any) {
  settings.update((settings) => {
    return {
      ...settings,
      [key]: value
    };
  });
}

export function resetSettings() {
  settings.set(defaultSettings);
}

settings.subscribe((settings) => {
  if (browser) {
    window.localStorage.setItem('settings', JSON.stringify(settings))
  }
})

