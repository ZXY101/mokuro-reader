import { browser } from "$app/environment";
import { writable } from "svelte/store";

type Progress = Record<string, number> | undefined

const stored = browser ? window.localStorage.getItem('progress') : undefined
const initial: Progress = stored && browser ? JSON.parse(stored) : undefined

export const progress = writable<Progress>(initial);

export function updateProgress(volume: string, value: number) {
  progress.update((prev) => {
    return {
      ...prev,
      [volume]: value
    };
  });
}

progress.subscribe((progress) => {
  if (browser) {
    window.localStorage.setItem('progress', progress ? JSON.stringify(progress) : '')
  }
})

