import { writable, derived, type Readable } from 'svelte/store';
import type { SyncProvider, CloudVolumeMetadata, ProviderType } from './provider-interface';
import { googleDriveProvider } from './providers/google-drive/google-drive-provider';
import { megaProvider } from './providers/mega/mega-provider';
import { webdavProvider } from './providers/webdav/webdav-provider';
import { unifiedSyncService, type SyncOptions, type SyncResult } from './unified-sync-service';

/**
 * Unified Cloud Manager
 *
 * Aggregates cloud storage across all providers (Google Drive, MEGA, WebDAV).
 * Provides a single interface for listing, uploading, downloading, and deleting
 * cloud volumes regardless of which provider they're stored on.
 *
 * This is the abstraction layer that makes the rest of the app provider-agnostic.
 */

export interface CloudVolumeWithProvider extends CloudVolumeMetadata {
	provider: ProviderType;
}

class UnifiedCloudManager {
	private providers: SyncProvider[] = [
		googleDriveProvider,
		megaProvider,
		webdavProvider
	];

	private cloudFilesStore = writable<CloudVolumeWithProvider[]>([]);
	private isFetchingStore = writable<boolean>(false);
	private lastFetchTime: number | null = null;

	/**
	 * Store containing all cloud volumes from all providers
	 */
	get cloudFiles(): Readable<CloudVolumeWithProvider[]> {
		return this.cloudFilesStore;
	}

	/**
	 * Store indicating whether a fetch is in progress
	 */
	get isFetching(): Readable<boolean> {
		return this.isFetchingStore;
	}

	/**
	 * Derived store: list of authenticated providers
	 */
	get authenticatedProviders(): Readable<SyncProvider[]> {
		return derived([], () => {
			return this.providers.filter(p => p.isAuthenticated());
		});
	}

	/**
	 * Get all registered providers (authenticated or not)
	 */
	getAllProviders(): SyncProvider[] {
		return [...this.providers];
	}

	/**
	 * Get a specific provider by type
	 */
	getProvider(type: ProviderType): SyncProvider | undefined {
		return this.providers.find(p => p.type === type);
	}

	/**
	 * Fetch all cloud volumes from all authenticated providers
	 * and merge them into a unified list
	 */
	async fetchAllCloudVolumes(): Promise<void> {
		this.isFetchingStore.set(true);

		try {
			const authenticatedProviders = this.providers.filter(p => p.isAuthenticated());

			if (authenticatedProviders.length === 0) {
				console.log('No authenticated cloud providers');
				this.cloudFilesStore.set([]);
				return;
			}

			console.log(`Fetching cloud volumes from ${authenticatedProviders.length} provider(s)...`);

			// Fetch from all providers in parallel
			const results = await Promise.allSettled(
				authenticatedProviders.map(async (provider) => {
					try {
						const volumes = await provider.listCloudVolumes();
						console.log(`✅ ${provider.name}: Found ${volumes.length} volume(s)`);
						return volumes.map(v => ({
							...v,
							provider: provider.type
						}));
					} catch (error) {
						console.error(`❌ ${provider.name}: Failed to list volumes:`, error);
						return [];
					}
				})
			);

			// Merge all results
			const allVolumes: CloudVolumeWithProvider[] = [];
			for (const result of results) {
				if (result.status === 'fulfilled') {
					allVolumes.push(...result.value);
				}
			}

			// Sort by path for consistent ordering
			allVolumes.sort((a, b) => a.path.localeCompare(b.path));

			console.log(`✅ Total cloud volumes across all providers: ${allVolumes.length}`);
			this.cloudFilesStore.set(allVolumes);
			this.lastFetchTime = Date.now();

		} catch (error) {
			console.error('Failed to fetch cloud volumes:', error);
			// Don't clear existing data on error
		} finally {
			this.isFetchingStore.set(false);
		}
	}

	/**
	 * Get all cloud volumes (current cached value)
	 */
	getAllCloudVolumes(): CloudVolumeWithProvider[] {
		let volumes: CloudVolumeWithProvider[] = [];
		this.cloudFilesStore.subscribe(v => { volumes = v; })();
		return volumes;
	}

	/**
	 * Get cloud volume by file ID (searches all providers)
	 */
	getCloudVolume(fileId: string): CloudVolumeWithProvider | undefined {
		const volumes = this.getAllCloudVolumes();
		return volumes.find(v => v.fileId === fileId);
	}

	/**
	 * Get cloud volumes for a specific series
	 */
	getCloudVolumesBySeries(seriesTitle: string): CloudVolumeWithProvider[] {
		const volumes = this.getAllCloudVolumes();
		return volumes.filter(v => v.path.startsWith(`${seriesTitle}/`));
	}

	/**
	 * Determine which provider owns a file by its ID
	 */
	getProviderForFile(fileId: string): SyncProvider | null {
		const volume = this.getCloudVolume(fileId);
		if (!volume) return null;

		return this.getProvider(volume.provider) || null;
	}

	/**
	 * Upload a volume CBZ to a specific provider
	 */
	async uploadVolumeCbz(
		provider: ProviderType,
		path: string,
		blob: Blob,
		description?: string
	): Promise<string> {
		const providerInstance = this.getProvider(provider);
		if (!providerInstance) {
			throw new Error(`Provider ${provider} not found`);
		}

		if (!providerInstance.isAuthenticated()) {
			throw new Error(`Provider ${provider} is not authenticated`);
		}

		const fileId = await providerInstance.uploadVolumeCbz(path, blob, description);

		// Add to cache immediately
		this.addToCache({
			fileId,
			path,
			modifiedTime: new Date().toISOString(),
			size: blob.size,
			description,
			provider
		});

		return fileId;
	}

	/**
	 * Download a volume CBZ (auto-routes to correct provider)
	 */
	async downloadVolumeCbz(
		fileId: string,
		onProgress?: (loaded: number, total: number) => void
	): Promise<Blob> {
		const provider = this.getProviderForFile(fileId);
		if (!provider) {
			throw new Error(`No provider found for file ID: ${fileId}`);
		}

		return await provider.downloadVolumeCbz(fileId, onProgress);
	}

	/**
	 * Delete a volume CBZ (auto-routes to correct provider)
	 */
	async deleteVolumeCbz(fileId: string): Promise<void> {
		const provider = this.getProviderForFile(fileId);
		if (!provider) {
			throw new Error(`No provider found for file ID: ${fileId}`);
		}

		await provider.deleteVolumeCbz(fileId);

		// Remove from cache
		this.removeFromCache(fileId);
	}

	/**
	 * Delete an entire series folder (all volumes in the series)
	 * This will delete the series folder itself, not individual files
	 */
	async deleteSeriesFolder(seriesTitle: string): Promise<{ succeeded: number; failed: number }> {
		// Get all volumes for this series
		const seriesVolumes = this.getCloudVolumesBySeries(seriesTitle);

		if (seriesVolumes.length === 0) {
			return { succeeded: 0, failed: 0 };
		}

		// Group by provider
		const volumesByProvider = new Map<ProviderType, CloudVolumeWithProvider[]>();
		for (const volume of seriesVolumes) {
			const existing = volumesByProvider.get(volume.provider);
			if (existing) {
				existing.push(volume);
			} else {
				volumesByProvider.set(volume.provider, [volume]);
			}
		}

		let successCount = 0;
		let failCount = 0;

		// For each provider, delete the series folder
		for (const [providerType, volumes] of volumesByProvider.entries()) {
			const provider = this.getProvider(providerType);
			if (!provider) {
				failCount += volumes.length;
				continue;
			}

			// Check if provider has a deleteSeriesFolder method
			if ('deleteSeriesFolder' in provider && typeof provider.deleteSeriesFolder === 'function') {
				try {
					await (provider as any).deleteSeriesFolder(seriesTitle);
					successCount += volumes.length;

					// Remove all volumes from cache
					for (const volume of volumes) {
						this.removeFromCache(volume.fileId);
					}
				} catch (error) {
					console.error(`Failed to delete series folder from ${providerType}:`, error);
					failCount += volumes.length;
				}
			} else {
				// Fallback: delete individual files if provider doesn't support folder deletion
				for (const volume of volumes) {
					try {
						await this.deleteVolumeCbz(volume.fileId);
						successCount++;
					} catch (error) {
						console.error(`Failed to delete ${volume.path}:`, error);
						failCount++;
					}
				}
			}
		}

		return { succeeded: successCount, failed: failCount };
	}

	/**
	 * Check if a volume exists in any provider by path
	 */
	existsInCloud(seriesTitle: string, volumeTitle: string): boolean {
		const path = `${seriesTitle}/${volumeTitle}.cbz`;
		const volumes = this.getAllCloudVolumes();
		return volumes.some(v => v.path === path);
	}

	/**
	 * Get cloud file metadata by path
	 */
	getCloudFile(seriesTitle: string, volumeTitle: string): CloudVolumeWithProvider | undefined {
		const path = `${seriesTitle}/${volumeTitle}.cbz`;
		const volumes = this.getAllCloudVolumes();
		return volumes.find(v => v.path === path);
	}

	/**
	 * Get the default provider for uploads (first authenticated provider)
	 */
	getDefaultProvider(): SyncProvider | null {
		const authenticated = this.providers.filter(p => p.isAuthenticated());
		return authenticated.length > 0 ? authenticated[0] : null;
	}

	/**
	 * Clear all cached data
	 */
	clearCache(): void {
		this.cloudFilesStore.set([]);
		this.lastFetchTime = null;
	}

	/**
	 * Get time since last fetch (for debugging/UI)
	 */
	getLastFetchTime(): number | null {
		return this.lastFetchTime;
	}

	/**
	 * Add a file to the cache (after upload)
	 */
	private addToCache(volume: CloudVolumeWithProvider): void {
		this.cloudFilesStore.update(volumes => {
			// Remove existing entry with same fileId (replace)
			const filtered = volumes.filter(v => v.fileId !== volume.fileId);

			// Add new entry and sort
			const updated = [...filtered, volume];
			updated.sort((a, b) => a.path.localeCompare(b.path));

			return updated;
		});
	}

	/**
	 * Remove a file from the cache (after deletion)
	 */
	private removeFromCache(fileId: string): void {
		this.cloudFilesStore.update(volumes => {
			return volumes.filter(v => v.fileId !== fileId);
		});
	}

	/**
	 * Update cache entry (e.g., after modifying description)
	 */
	updateCacheEntry(fileId: string, updates: Partial<CloudVolumeWithProvider>): void {
		this.cloudFilesStore.update(volumes => {
			return volumes.map(v =>
				v.fileId === fileId ? { ...v, ...updates } : v
			);
		});
	}

	/**
	 * Sync progress (volume data and optionally profiles) with all authenticated providers
	 */
	async syncProgress(options?: SyncOptions): Promise<SyncResult> {
		return await unifiedSyncService.syncAllProviders(this.providers, options);
	}

	/**
	 * Sync with a specific provider
	 */
	async syncWithProvider(providerType: ProviderType, options?: SyncOptions): Promise<SyncResult> {
		const provider = this.getProvider(providerType);
		if (!provider) {
			return {
				totalProviders: 0,
				succeeded: 0,
				failed: 1,
				results: [{
					provider: providerType,
					success: false,
					error: 'Provider not found'
				}]
			};
		}

		const result = await unifiedSyncService.syncProvider(provider, options);
		return {
			totalProviders: 1,
			succeeded: result.success ? 1 : 0,
			failed: result.success ? 0 : 1,
			results: [result]
		};
	}

	/**
	 * Check if sync is currently in progress
	 */
	get isSyncing(): Readable<boolean> {
		return unifiedSyncService.isSyncing;
	}
}

export const unifiedCloudManager = new UnifiedCloudManager();
