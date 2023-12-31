import { page } from "$app/stores";
import { get } from "svelte/store";

export function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}

export function isReader() {
  return get(page).route.id === '/[manga]/[volume]'
}

let timer: any;

export function debounce(func: () => void, timeout = 50) {
  if (!timer) {
    timer = setTimeout(() => {
      func();
      clearTimeout(timer);
      timer = undefined;
    }, timeout);
  } else {
    clearTimeout(timer);
    timer = undefined;
  }
}