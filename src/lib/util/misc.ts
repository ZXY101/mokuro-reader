import { page } from "$app/stores";
import { get } from "svelte/store";

export function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}

export function isReader() {
  return get(page).route.id === '/[manga]/[volume]'
}