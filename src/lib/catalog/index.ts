import type { Manga } from "$lib/types/catalog";
import { writable } from "svelte/store";

export const currentManga = writable<Manga | undefined>(undefined);
