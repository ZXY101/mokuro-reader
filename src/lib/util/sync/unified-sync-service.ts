import { writable, get } from 'svelte/store';
import { progressTrackerStore } from '../progress-tracker';
import { volumesWithTrash, profiles, parseVolumesFromJson } from '$lib/settings';
import { showSnackbar } from '../snackbar';
import type { SyncProvider, ProviderType, CloudFileMetadata } from './provider-interface';
import { cacheManager } from './cache-manager';

export interface SyncOptions {
	/** If true, suppress snackbar notifications */
	silent?: boolean;
	/** If true, sync profiles in addition to volume data */
	syncProfiles?: boolean;
}

export interface ProviderSyncResult {
	provider: ProviderType;
	success: boolean;
	error?: string;
}

export interface SyncResult {
	totalProviders: number;
	succeeded: number;
	failed: number;
	results: ProviderSyncResult[];
}

/**
 * Unified Sync Service
 *
 * Syncs read progress and profiles across all authenticated cloud providers.
 * Works with the SyncProvider interface, making it provider-agnostic.
 */
class UnifiedSyncService {
	private isSyncingStore = writable<boolean>(false);
	private syncLock = false;

	get isSyncing() {
		return this.isSyncingStore;
	}

	/**
	 * Sync with all authenticated providers
	 */
	async syncAllProviders(
		providers: SyncProvider[],
		options: SyncOptions = {}
	): Promise<SyncResult> {
		// Prevent concurrent syncs
		if (this.syncLock) {
			console.log('⏭️ Sync already in progress, skipping');
			if (!options.silent) {
				showSnackbar('Sync already in progress');
			}
			return {
				totalProviders: 0,
				succeeded: 0,
				failed: 0,
				results: []
			};
		}

		this.syncLock = true;
		this.isSyncingStore.set(true);

		// Filter to only authenticated providers
		const authenticatedProviders = providers.filter(p => p.isAuthenticated());

		if (authenticatedProviders.length === 0) {
			console.log('ℹ️ No authenticated providers to sync');
			if (!options.silent) {
				showSnackbar('No cloud providers connected');
			}
			this.syncLock = false;
			this.isSyncingStore.set(false);
			return {
				totalProviders: 0,
				succeeded: 0,
				failed: 0,
				results: []
			};
		}

		const processId = 'unified-sync';

		try {
			if (!options.silent) {
				progressTrackerStore.addProcess({
					id: processId,
					description: 'Syncing with cloud providers',
					progress: 0,
					status: `Syncing with ${authenticatedProviders.length} provider(s)...`
				});
			}

			// Sync with all providers in parallel
			const results = await Promise.allSettled(
				authenticatedProviders.map(provider => this.syncProvider(provider, options))
			);

			// Count successes and failures
			let succeeded = 0;
			let failed = 0;
			const providerResults: ProviderSyncResult[] = [];

			results.forEach((result, index) => {
				const provider = authenticatedProviders[index];
				if (result.status === 'fulfilled' && result.value.success) {
					succeeded++;
					providerResults.push(result.value);
				} else {
					failed++;
					providerResults.push({
						provider: provider.type,
						success: false,
						error: result.status === 'rejected'
							? result.reason?.message || 'Unknown error'
							: result.value.error
					});
				}
			});

			// Show completion message
			if (!options.silent) {
				progressTrackerStore.updateProcess(processId, {
					progress: 100,
					status: 'Sync complete'
				});

				if (failed === 0) {
					showSnackbar(`Synced with ${succeeded} provider(s) successfully`);
				} else {
					showSnackbar(`Synced with ${succeeded} provider(s), ${failed} failed`);
				}
			}

			return {
				totalProviders: authenticatedProviders.length,
				succeeded,
				failed,
				results: providerResults
			};

		} catch (error) {
			console.error('Unified sync error:', error);
			if (!options.silent) {
				progressTrackerStore.updateProcess(processId, {
					progress: 0,
					status: 'Sync failed'
				});
				showSnackbar('Sync failed');
			}
			return {
				totalProviders: authenticatedProviders.length,
				succeeded: 0,
				failed: authenticatedProviders.length,
				results: authenticatedProviders.map(p => ({
					provider: p.type,
					success: false,
					error: 'Sync failed'
				}))
			};
		} finally {
			if (!options.silent) {
				setTimeout(() => progressTrackerStore.removeProcess(processId), 3000);
			}
			this.syncLock = false;
			this.isSyncingStore.set(false);
		}
	}

	/**
	 * Sync with a single provider
	 */
	async syncProvider(
		provider: SyncProvider,
		options: SyncOptions = {}
	): Promise<ProviderSyncResult> {
		// Set syncing state
		this.isSyncingStore.set(true);

		try {
			console.log(`🔄 Syncing with ${provider.name}...`);

			// Check authentication - if provider needs to re-authenticate, let it handle that
			if (!provider.isAuthenticated()) {
				// For Google Drive specifically, trigger the auth flow if needed
				if (provider.type === 'google-drive') {
					console.log('Google Drive not authenticated, triggering login...');
					await provider.login();
				} else {
					throw new Error(`${provider.name} is not authenticated`);
				}
			}

			// Sync volume data (read progress)
			await this.syncVolumeData(provider);

			// Optionally sync profiles
			if (options.syncProfiles) {
				await this.syncProfiles(provider);
			}

			console.log(`✅ ${provider.name} sync complete`);
			return {
				provider: provider.type,
				success: true
			};

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error(`❌ ${provider.name} sync failed:`, error);

			// If it's an authentication error for Google Drive, that's expected behavior
			if (provider.type === 'google-drive' && errorMessage.includes('not authenticated')) {
				console.log('Google Drive re-authentication in progress...');
			}

			return {
				provider: provider.type,
				success: false,
				error: errorMessage
			};
		} finally {
			// Clear syncing state
			this.isSyncingStore.set(false);
		}
	}

	/**
	 * Convert Blob to JSON object
	 */
	private async blobToJson(blob: Blob): Promise<any> {
		const text = await blob.text();
		return JSON.parse(text);
	}

	/**
	 * Convert JSON object to Blob
	 */
	private jsonToBlob(data: any): Blob {
		const json = JSON.stringify(data);
		return new Blob([json], { type: 'application/json' });
	}

	/**
	 * Find volume-data.json files from provider using generic cache
	 * Returns array of CloudFileMetadata for all volume-data.json files found
	 */
	private findVolumeDataFiles(provider: SyncProvider): CloudFileMetadata[] {
		const cache = cacheManager.getCache(provider.type);
		if (!cache) {
			return [];
		}

		// Query cache for volume-data.json files
		const files = cache.getAll('volume-data.json');
		return files || [];
	}

	/**
	 * Find profiles.json file from provider using generic cache
	 * Returns CloudFileMetadata if file exists, null otherwise
	 */
	private findProfilesFile(provider: SyncProvider): CloudFileMetadata | null {
		const cache = cacheManager.getCache(provider.type);
		if (!cache) {
			return null;
		}

		// Query cache for profiles.json file
		return cache.get('profiles.json');
	}

	/**
	 * Download volume-data.json file from provider using generic file operations
	 * Handles duplicate files by merging them (Google Drive specific)
	 */
	private async downloadVolumeDataFile(provider: SyncProvider): Promise<any | null> {
		try {
			const volumeDataFiles = await this.findVolumeDataFiles(provider);

			if (volumeDataFiles.length === 0) {
				return null;
			}

			// Handle duplicates: download all, merge, and clean up
			if (volumeDataFiles.length > 1) {
				console.log(`📦 Found ${volumeDataFiles.length} volume-data.json files - merging and deduplicating...`);

				// Download all files in parallel
				const allVolumesData = await Promise.all(
					volumeDataFiles.map(async (file) => {
						const blob = await provider.downloadFile(file);
						const data = await this.blobToJson(blob);
						return parseVolumesFromJson(JSON.stringify(data));
					})
				);

				// Merge all volumes (newest lastProgressUpdate wins per volume)
				const merged: any = {};
				for (const volumesData of allVolumesData) {
					for (const [volumeId, volumeData] of Object.entries(volumesData)) {
						const existing = merged[volumeId];
						if (!existing) {
							merged[volumeId] = volumeData;
						} else {
							// Keep the volume with the most recent progress update
							const existingTime = new Date(existing.lastProgressUpdate || 0).getTime();
							const newTime = new Date((volumeData as any).lastProgressUpdate || 0).getTime();
							if (newTime > existingTime) {
								merged[volumeId] = volumeData;
							}
						}
					}
				}

				// Delete duplicate files (keep the first one)
				if (provider.type === 'google-drive') {
					const { driveApiClient } = await import('$lib/util/google-drive/api-client');
					const { driveFilesCache } = await import('$lib/util/google-drive/drive-files-cache');

					for (let i = 1; i < volumeDataFiles.length; i++) {
						console.log(`🗑️ Deleting duplicate volume-data.json (${volumeDataFiles[i].fileId})`);
						await provider.deleteFile(volumeDataFiles[i]);
						driveFilesCache.removeById(volumeDataFiles[i].fileId);
					}
				}

				console.log(`✅ Merged ${volumeDataFiles.length} files into 1`);
				return merged;
			}

			// Single file - download normally
			const blob = await provider.downloadFile(volumeDataFiles[0]);
			const data = await this.blobToJson(blob);
			return parseVolumesFromJson(JSON.stringify(data));
		} catch (error) {
			// File not found is not an error
			if (error instanceof Error && (
				error.message.includes('not found') ||
				error.message.includes('404') ||
				error.message.includes('ENOENT')
			)) {
				return null;
			}
			throw error;
		}
	}

	/**
	 * Upload volume-data.json file to provider using generic file operations
	 */
	private async uploadVolumeDataFile(provider: SyncProvider, data: any): Promise<void> {
		const blob = this.jsonToBlob(data);
		const path = 'volume-data.json';

		// For Google Drive, we need to handle folder structure
		if (provider.type === 'google-drive') {
			// Upload using Google Drive API directly (it handles folder creation)
			const { driveApiClient } = await import('$lib/util/google-drive/api-client');
			const { GOOGLE_DRIVE_CONFIG } = await import('$lib/util/google-drive/constants');

			// Get folder ID from cache
			const { driveFilesCache } = await import('$lib/util/google-drive/drive-files-cache');
			const folderId = await driveFilesCache.getReaderFolderId();

			if (!folderId) {
				throw new Error('Reader folder ID not found');
			}

			// Find existing volume-data.json file
			const existingFiles = driveFilesCache.getVolumeDataFiles();
			const existingFileId = existingFiles.length > 0 ? existingFiles[0].fileId : null;

			// Upload (create or update)
			const metadata = {
				name: GOOGLE_DRIVE_CONFIG.FILE_NAMES.VOLUME_DATA,
				mimeType: GOOGLE_DRIVE_CONFIG.MIME_TYPES.JSON,
				...(existingFileId ? {} : { parents: [folderId] })
			};

			await driveApiClient.uploadFile(blob, metadata, existingFileId || undefined);
			console.log('✅ Volume data uploaded to Google Drive');
		} else {
			// For MEGA and WebDAV, use generic uploadFile
			// They handle folder structure internally
			await provider.uploadFile(path, blob);
		}
	}

	/**
	 * Sync volume data (read progress) with a provider
	 */
	private async syncVolumeData(provider: SyncProvider): Promise<void> {
		// Step 1: Download cloud data
		const cloudVolumes = await this.downloadVolumeDataFile(provider);

		// Step 2: Get local data (including tombstones for deletion sync)
		const localVolumes = get(volumesWithTrash);

		// Step 3: Merge data (handles deletedOn/addedOn timestamps)
		const mergedVolumes = this.mergeVolumeData(localVolumes, cloudVolumes || {});

		// Step 4: Purge tombstones older than 30 days
		const purgedVolumes = this.purgeTombstones(mergedVolumes);

		// Step 5: Update local storage (including tombstones)
		volumesWithTrash.set(purgedVolumes);

		// Step 6: Upload purged data if changed
		const purgedJson = JSON.stringify(purgedVolumes);
		const cloudJson = JSON.stringify(cloudVolumes || {});

		if (purgedJson !== cloudJson) {
			await this.uploadVolumeDataFile(provider, purgedVolumes);
		}
	}

	/**
	 * Download profiles.json file from provider using generic file operations
	 */
	private async downloadProfilesFile(provider: SyncProvider): Promise<any | null> {
		try {
			const profilesFile = await this.findProfilesFile(provider);

			if (!profilesFile) {
				return null;
			}

			const blob = await provider.downloadFile(profilesFile);
			return await this.blobToJson(blob);
		} catch (error) {
			// File not found is not an error
			if (error instanceof Error && (
				error.message.includes('not found') ||
				error.message.includes('404') ||
				error.message.includes('ENOENT')
			)) {
				return null;
			}
			throw error;
		}
	}

	/**
	 * Upload profiles.json file to provider using generic file operations
	 */
	private async uploadProfilesFile(provider: SyncProvider, data: any): Promise<void> {
		const blob = this.jsonToBlob(data);
		const path = 'profiles.json';

		// For Google Drive, we need to handle folder structure
		if (provider.type === 'google-drive') {
			// Upload using Google Drive API directly (it handles folder creation)
			const { driveApiClient } = await import('$lib/util/google-drive/api-client');
			const { GOOGLE_DRIVE_CONFIG } = await import('$lib/util/google-drive/constants');

			// Get folder ID from cache
			const { driveFilesCache } = await import('$lib/util/google-drive/drive-files-cache');
			const folderId = await driveFilesCache.getReaderFolderId();

			if (!folderId) {
				throw new Error('Reader folder ID not found');
			}

			// Find existing profiles.json file
			const files = await driveApiClient.listFiles(
				`'${folderId}' in parents and name='${GOOGLE_DRIVE_CONFIG.FILE_NAMES.PROFILES}'`,
				'files(id)'
			);
			const existingFileId = files.length > 0 ? files[0].id : null;

			// Upload (create or update)
			const metadata = {
				name: GOOGLE_DRIVE_CONFIG.FILE_NAMES.PROFILES,
				mimeType: GOOGLE_DRIVE_CONFIG.MIME_TYPES.JSON,
				...(existingFileId ? {} : { parents: [folderId] })
			};

			await driveApiClient.uploadFile(blob, metadata, existingFileId || undefined);
			console.log('✅ Profiles uploaded to Google Drive');
		} else {
			// For MEGA and WebDAV, use generic uploadFile
			// They handle folder structure internally
			await provider.uploadFile(path, blob);
		}
	}

	/**
	 * Sync profiles with a provider
	 */
	private async syncProfiles(provider: SyncProvider): Promise<void> {
		// Step 1: Download cloud profiles
		const cloudProfiles = await this.downloadProfilesFile(provider);

		// Step 2: Get local profiles
		const localProfiles = get(profiles);

		// Step 3: Merge profiles (newest wins based on profile name)
		const mergedProfiles = this.mergeProfiles(localProfiles, cloudProfiles || {});

		// Step 4: Update local storage
		profiles.set(mergedProfiles);

		// Step 5: Upload merged profiles if changed
		const mergedJson = JSON.stringify(mergedProfiles);
		const cloudJson = JSON.stringify(cloudProfiles || {});

		if (mergedJson !== cloudJson) {
			await this.uploadProfilesFile(provider, mergedProfiles);
		}
	}

	/**
	 * Merge volume data using newest-wins strategy with deletion tracking support
	 * Handles addedOn/deletedOn timestamps to properly sync deletions across devices
	 * IMPORTANT: Always returns VolumeData class instances to ensure toJSON() is available
	 */
	private mergeVolumeData(local: any, cloud: any): any {
		const merged: any = {};
		const allVolumeIds = new Set([
			...Object.keys(local),
			...Object.keys(cloud)
		]);

		allVolumeIds.forEach(volumeId => {
			const localVol = local[volumeId];
			const cloudVol = cloud[volumeId];

			if (!localVol) {
				// Only in cloud - parse plain object to VolumeData instance
				const parsed = parseVolumesFromJson(JSON.stringify({ [volumeId]: cloudVol }));
				merged[volumeId] = parsed[volumeId];
			} else if (!cloudVol) {
				// Only in local - already a VolumeData instance
				merged[volumeId] = localVol;
			} else {
				// In both - determine which has the most recent user action
				// Consider all timestamps: lastProgressUpdate (reading), addedOn (import), deletedOn (deletion)
				// Treat undefined timestamps as epoch (0) for legacy volumes
				const localMostRecent = Math.max(
					new Date(localVol.lastProgressUpdate || 0).getTime(),
					new Date(localVol.addedOn || 0).getTime(),
					new Date(localVol.deletedOn || 0).getTime()
				);

				const cloudMostRecent = Math.max(
					new Date(cloudVol.lastProgressUpdate || 0).getTime(),
					new Date(cloudVol.addedOn || 0).getTime(),
					new Date(cloudVol.deletedOn || 0).getTime()
				);

				let winner;
				if (cloudMostRecent > localMostRecent) {
					// Cloud has more recent user action
					const parsed = parseVolumesFromJson(JSON.stringify({ [volumeId]: cloudVol }));
					winner = parsed[volumeId];
				} else if (localMostRecent > cloudMostRecent) {
					// Local has more recent user action
					winner = localVol;
				} else {
					// Timestamps equal (including both at epoch)
					// Prefer active over deleted to prevent accidental data loss
					if (cloudVol.deletedOn && !localVol.deletedOn) {
						winner = localVol; // Local is active, keep it
					} else if (localVol.deletedOn && !cloudVol.deletedOn) {
						const parsed = parseVolumesFromJson(JSON.stringify({ [volumeId]: cloudVol }));
						winner = parsed[volumeId]; // Cloud is active, keep it
					} else {
						// Both same state (both active or both deleted) - arbitrary choice: local
						winner = localVol;
					}
				}

				// Preserve metadata from both records - fill in missing fields
				// (only if the winner is not deleted - tombstones keep minimal data)
				if (!winner.deletedOn) {
					merged[volumeId] = parseVolumesFromJson(JSON.stringify({
						[volumeId]: {
							...winner,
							series_uuid: winner.series_uuid || localVol.series_uuid || cloudVol.series_uuid,
							series_title: winner.series_title || localVol.series_title || cloudVol.series_title,
							volume_title: winner.volume_title || localVol.volume_title || cloudVol.volume_title
						}
					}))[volumeId];
				} else {
					// Winner is a tombstone - keep it as-is (minimal data)
					merged[volumeId] = winner;
				}
			}
		});

		return merged;
	}

	/**
	 * Purge tombstones (deleted volumes) older than 30 days
	 * This prevents the sync data from accumulating deleted entries indefinitely
	 */
	private purgeTombstones(volumes: any): any {
		const now = Date.now();
		const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

		return Object.fromEntries(
			Object.entries(volumes).filter(([volumeId, vol]: [string, any]) => {
				// Keep active volumes (no deletedOn timestamp)
				if (!vol.deletedOn) return true;

				// Purge tombstones older than 30 days
				const deletedTimestamp = new Date(vol.deletedOn).getTime();
				const age = now - deletedTimestamp;
				return age < THIRTY_DAYS_MS;
			})
		);
	}

	/**
	 * Merge profiles (Record<string, Settings>) keeping all unique profile names
	 */
	private mergeProfiles(local: any, cloud: any): any {
		// For profiles, we'll combine them with cloud profiles taking precedence
		// Profiles are Record<string, Settings> where key is profile name
		return {
			...local,
			...cloud
		};
	}
}

export const unifiedSyncService = new UnifiedSyncService();
