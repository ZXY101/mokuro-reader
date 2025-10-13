import { writable, derived } from 'svelte/store';
import type { CloudCache } from '../../cloud-cache-interface';
import type { CloudVolumeMetadata } from '../../provider-interface';
import { megaProvider } from './mega-provider';

/**
 * MEGA Cache Wrapper
 *
 * MEGA caches files internally via storage.files, so this is just a thin wrapper
 * that implements CloudCache interface by delegating to megaProvider.listCloudVolumes()
 *
 * This allows cacheManager to work with MEGA without duplicating its internal cache.
 */
class MegaCacheManager implements CloudCache<CloudVolumeMetadata> {
	private cache = writable<Map<string, CloudVolumeMetadata[]>>(new Map());
	private isFetchingStore = writable<boolean>(false);
	private fetchingFlag = false;
	private loadedFlag = false;

	get store() {
		// Convert Map store to Array store for CloudCache interface compatibility
		return derived(this.cache, ($cache) => {
			const result: CloudVolumeMetadata[] = [];
			for (const files of $cache.values()) {
				result.push(...files);
			}
			return result;
		});
	}

	get isFetchingState() {
		return this.isFetchingStore;
	}

	/**
	 * Fetch cloud volumes from MEGA provider
	 * This queries MEGA's internal cache (storage.files)
	 */
	async fetch(): Promise<void> {
		if (this.fetchingFlag) {
			console.log('MEGA cache fetch already in progress');
			return;
		}

		if (!megaProvider.isAuthenticated()) {
			console.log('MEGA not authenticated, skipping cache fetch');
			return;
		}

		this.fetchingFlag = true;
		this.isFetchingStore.set(true);
		try {
			// Query MEGA provider (which reads from its internal storage.files cache)
			const volumes = await megaProvider.listCloudVolumes();

			// Group by path (to match Drive's structure which supports duplicates)
			const cacheMap = new Map<string, CloudVolumeMetadata[]>();
			for (const volume of volumes) {
				const existing = cacheMap.get(volume.path);
				if (existing) {
					existing.push(volume);
				} else {
					cacheMap.set(volume.path, [volume]);
				}
			}

			this.cache.set(cacheMap);
			this.loadedFlag = true;
			console.log(`✅ MEGA cache populated with ${volumes.length} files`);
		} catch (error) {
			console.error('Failed to fetch MEGA cache:', error);
		} finally {
			this.fetchingFlag = false;
			this.isFetchingStore.set(false);
		}
	}

	has(path: string): boolean {
		let currentCache: Map<string, CloudVolumeMetadata[]> = new Map();
		this.cache.subscribe((value) => {
			currentCache = value;
		})();

		const files = currentCache.get(path);
		return files !== undefined && files.length > 0;
	}

	get(path: string): CloudVolumeMetadata | null {
		let currentCache: Map<string, CloudVolumeMetadata[]> = new Map();
		this.cache.subscribe((value) => {
			currentCache = value;
		})();

		const files = currentCache.get(path);
		return files && files.length > 0 ? files[0] : null;
	}

	getAll(path: string): CloudVolumeMetadata[] {
		let currentCache: Map<string, CloudVolumeMetadata[]> = new Map();
		this.cache.subscribe((value) => {
			currentCache = value;
		})();

		return currentCache.get(path) || [];
	}

	getBySeries(seriesTitle: string): CloudVolumeMetadata[] {
		let currentCache: Map<string, CloudVolumeMetadata[]> = new Map();
		this.cache.subscribe((value) => {
			currentCache = value;
		})();

		const result: CloudVolumeMetadata[] = [];
		for (const files of currentCache.values()) {
			result.push(...files.filter((file) => file.path.startsWith(`${seriesTitle}/`)));
		}
		return result;
	}

	getAllFiles(): CloudVolumeMetadata[] {
		let currentCache: Map<string, CloudVolumeMetadata[]> = new Map();
		this.cache.subscribe((value) => {
			currentCache = value;
		})();

		const result: CloudVolumeMetadata[] = [];
		for (const files of currentCache.values()) {
			result.push(...files);
		}
		return result;
	}

	clear(): void {
		this.cache.set(new Map());
		this.loadedFlag = false;
	}

	isFetching(): boolean {
		return this.fetchingFlag;
	}

	isLoaded(): boolean {
		return this.loadedFlag;
	}

	// Optional methods for cache updates
	add(path: string, metadata: CloudVolumeMetadata): void {
		this.cache.update((cache) => {
			const newCache = new Map(cache);
			const existing = newCache.get(path);

			if (existing) {
				// Check if this file ID already exists, replace it
				const index = existing.findIndex(f => f.fileId === metadata.fileId);
				if (index >= 0) {
					existing[index] = metadata;
				} else {
					existing.push(metadata);
				}
			} else {
				newCache.set(path, [metadata]);
			}

			return newCache;
		});
	}

	removeById(fileId: string): void {
		this.cache.update((cache) => {
			const newCache = new Map(cache);

			for (const [path, files] of newCache.entries()) {
				const filtered = files.filter(f => f.fileId !== fileId);
				if (filtered.length === 0) {
					newCache.delete(path);
				} else if (filtered.length !== files.length) {
					newCache.set(path, filtered);
				}
			}

			return newCache;
		});
	}

	update(fileId: string, updates: Partial<CloudVolumeMetadata>): void {
		this.cache.update((cache) => {
			const newCache = new Map(cache);

			for (const [path, files] of newCache.entries()) {
				const updated = files.map(file =>
					file.fileId === fileId
						? { ...file, ...updates }
						: file
				);
				newCache.set(path, updated);
			}

			return newCache;
		});
	}
}

export const megaCache = new MegaCacheManager();
