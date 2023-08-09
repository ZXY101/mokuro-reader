import { writable } from "svelte/store";
import { db } from "$lib/catalog/db";
import type { Volume } from "$lib/upload";
import { liveQuery } from "dexie";




export const catalog = liveQuery(() => db.catalog.toArray());
