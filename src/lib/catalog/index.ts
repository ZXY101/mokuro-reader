import type { Volume } from "$lib/types";
import { writable } from "svelte/store";
import { db } from "$lib/catalog/db";
import { liveQuery } from "dexie";
export const currentManga = writable<Volume[] | undefined>(undefined);
export const currentVolume = writable<Volume | undefined>(undefined);
export const catalog = liveQuery(() => db.catalog.toArray());