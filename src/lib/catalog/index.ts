import type { Manga, Volume } from "$lib/types/catalog";
import { writable } from "svelte/store";

export const currentManga = writable<Manga | undefined>(undefined);
export const currentVolume = writable<Volume | undefined>(undefined);
