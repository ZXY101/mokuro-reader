import type { Volume } from '$lib/upload';
import Dexie, { type Table } from 'dexie';

export interface Catalog {
  id?: number;
  manga: Volume[];
}

export class CatalogDexie extends Dexie {
  catalog!: Table<Catalog>;

  constructor() {
    super('mokuro');
    this.version(1).stores({
      catalog: '++id, manga'
    });
  }
}

export const db = new CatalogDexie();
