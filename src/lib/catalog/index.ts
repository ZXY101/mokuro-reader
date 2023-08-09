import type { Volume } from "$lib/upload";
import { writable } from "svelte/store";

export const currentManga = writable<Volume[] | undefined>(undefined);
export const currentVolume = writable<Volume | undefined>(undefined);
