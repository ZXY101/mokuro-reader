import { browser } from '$app/environment';
import { zoomDefault } from '$lib/panzoom';
import { writable } from 'svelte/store';

export type FontSize =
  | 'auto'
  | '9'
  | '10'
  | '11'
  | '12'
  | '14'
  | '16'
  | '18'
  | '20'
  | '24'
  | '32'
  | '40'
  | '48'
  | '60';

export type ZoomModes =
  | 'zoomFitToScreen'
  | 'zoomFitToWidth'
  | 'zoomOriginal'
  | 'keepZoom'
  | 'keepZoomStart';

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
  ankiConnectSettings: AnkiConnectSettings;
};

export type SettingsKey = keyof Settings;

export type AnkiConnectSettings = {
  enabled: boolean;
  pictureField: string;
  sentenceField: string;
  cropImage: boolean;
  overwriteImage: boolean;
  grabSentence: boolean;
}

export type AnkiSettingsKey = keyof AnkiConnectSettings;


const defaultSettings: Settings = {
  rightToLeft: true,
  singlePageView: false,
  hasCover: false,
  displayOCR: true,
  textEditable: false,
  textBoxBorders: false,
  boldFont: false,
  pageNum: true,
  backgroundColor: '#0d0d0f',
  fontSize: 'auto',
  zoomDefault: 'zoomFitToScreen',
  ankiConnectSettings: {
    enabled: false,
    cropImage: false,
    grabSentence: false,
    overwriteImage: true,
    pictureField: 'Picture',
    sentenceField: 'Sentence'
  }
};

const stored = browser ? window.localStorage.getItem('settings') : undefined;
const initialSettings: Settings = stored && browser ? JSON.parse(stored) : defaultSettings;

export * from './progress';

export const settings = writable<Settings>(initialSettings);

export function updateSetting(key: SettingsKey, value: any) {
  settings.update((settings) => {
    return {
      ...settings,
      [key]: value
    };
  });
  zoomDefault();
}

export function updateAnkiSetting(key: AnkiSettingsKey, value: any) {
  settings.update((settings) => {
    return {
      ...settings,
      ankiConnectSettings: {
        ...settings.ankiConnectSettings,
        [key]: value
      }
    };
  });
}

export function resetSettings() {
  settings.set(defaultSettings);
}

settings.subscribe((settings) => {
  if (browser) {
    window.localStorage.setItem('settings', JSON.stringify(settings));
  }
});
