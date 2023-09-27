import { db } from '$lib/catalog/db';
import { liveQuery } from 'dexie';

export const catalog = liveQuery(() => db.catalog.toArray());
