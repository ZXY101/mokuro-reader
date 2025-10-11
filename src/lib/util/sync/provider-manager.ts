import { writable, derived, type Readable } from 'svelte/store';
import type { SyncProvider, ProviderType, ProviderStatus } from './provider-interface';

export interface MultiProviderStatus {
	providers: Record<ProviderType, ProviderStatus | null>;
	hasAnyAuthenticated: boolean;
	needsAttention: boolean;
}

class ProviderManager {
	private providers: Map<ProviderType, SyncProvider> = new Map();
	private statusStore = writable<MultiProviderStatus>({
		providers: {
			'google-drive': null,
			mega: null,
			webdav: null
		},
		hasAnyAuthenticated: false,
		needsAttention: false
	});

	/** Observable store for multi-provider status */
	get status(): Readable<MultiProviderStatus> {
		return this.statusStore;
	}

	/**
	 * Register a sync provider
	 * @param provider The provider instance to register
	 */
	registerProvider(provider: SyncProvider): void {
		this.providers.set(provider.type, provider);
		this.updateStatus();
	}

	/**
	 * Get a specific provider by type
	 * @param type Provider type
	 * @returns Provider instance or undefined
	 */
	getProvider(type: ProviderType): SyncProvider | undefined {
		return this.providers.get(type);
	}

	/**
	 * Get all registered providers
	 * @returns Array of all provider instances
	 */
	getAllProviders(): SyncProvider[] {
		return Array.from(this.providers.values());
	}

	/**
	 * Get all authenticated providers
	 * @returns Array of authenticated provider instances
	 */
	getAuthenticatedProviders(): SyncProvider[] {
		return this.getAllProviders().filter((p) => p.isAuthenticated());
	}

	/**
	 * Check if any provider is authenticated
	 */
	hasAnyAuthenticated(): boolean {
		return this.getAuthenticatedProviders().length > 0;
	}

	/**
	 * Upload volume data to all authenticated providers
	 * @param data Volume data to upload
	 * @returns Object with results for each provider
	 */
	async uploadVolumeDataToAll(data: any): Promise<Record<string, { success: boolean; error?: string }>> {
		const authenticatedProviders = this.getAuthenticatedProviders();
		const results: Record<string, { success: boolean; error?: string }> = {};

		await Promise.allSettled(
			authenticatedProviders.map(async (provider) => {
				try {
					await provider.uploadVolumeData(data);
					results[provider.type] = { success: true };
				} catch (error) {
					results[provider.type] = {
						success: false,
						error: error instanceof Error ? error.message : 'Unknown error'
					};
				}
			})
		);

		return results;
	}

	/**
	 * Download and merge volume data from all authenticated providers
	 * Newest data wins (based on lastProgressUpdate timestamp)
	 * @returns Merged volume data
	 */
	async downloadAndMergeVolumeData(): Promise<any> {
		const authenticatedProviders = this.getAuthenticatedProviders();
		const allData: any[] = [];

		// Download from all providers
		await Promise.allSettled(
			authenticatedProviders.map(async (provider) => {
				try {
					const data = await provider.downloadVolumeData();
					if (data) {
						allData.push(data);
					}
				} catch (error) {
					console.error(`Failed to download from ${provider.type}:`, error);
				}
			})
		);

		// Merge all data (newest wins)
		return this.mergeVolumeData(allData);
	}

	/**
	 * Upload profile data to all authenticated providers
	 * @param data Profile data to upload
	 * @returns Object with results for each provider
	 */
	async uploadProfilesToAll(data: any): Promise<Record<string, { success: boolean; error?: string }>> {
		const authenticatedProviders = this.getAuthenticatedProviders();
		const results: Record<string, { success: boolean; error?: string }> = {};

		await Promise.allSettled(
			authenticatedProviders.map(async (provider) => {
				try {
					await provider.uploadProfiles(data);
					results[provider.type] = { success: true };
				} catch (error) {
					results[provider.type] = {
						success: false,
						error: error instanceof Error ? error.message : 'Unknown error'
					};
				}
			})
		);

		return results;
	}

	/**
	 * Download and merge profile data from all authenticated providers
	 * @returns Merged profile data
	 */
	async downloadAndMergeProfiles(): Promise<any> {
		const authenticatedProviders = this.getAuthenticatedProviders();
		const allData: any[] = [];

		await Promise.allSettled(
			authenticatedProviders.map(async (provider) => {
				try {
					const data = await provider.downloadProfiles();
					if (data) {
						allData.push(data);
					}
				} catch (error) {
					console.error(`Failed to download profiles from ${provider.type}:`, error);
				}
			})
		);

		// For profiles, we can just use the first valid one or merge them
		// Simple strategy: return the first one found
		return allData.length > 0 ? allData[0] : null;
	}

	/**
	 * Update the status store with current provider states
	 */
	updateStatus(): void {
		const status: MultiProviderStatus = {
			providers: {
				'google-drive': null,
				mega: null,
				webdav: null
			},
			hasAnyAuthenticated: false,
			needsAttention: false
		};

		for (const provider of this.providers.values()) {
			status.providers[provider.type] = provider.getStatus();
		}

		status.hasAnyAuthenticated = this.hasAnyAuthenticated();
		status.needsAttention = Object.values(status.providers).some(
			(p) => p && p.needsAttention
		);

		this.statusStore.set(status);
	}

	/**
	 * Merge volume data from multiple sources
	 * Newest data wins (based on lastProgressUpdate timestamp)
	 */
	private mergeVolumeData(dataSources: any[]): any {
		if (dataSources.length === 0) return {};
		if (dataSources.length === 1) return dataSources[0];

		const merged: any = {};
		const allVolumeIds = new Set<string>();

		// Collect all volume IDs
		for (const data of dataSources) {
			if (data && typeof data === 'object') {
				Object.keys(data).forEach((id) => allVolumeIds.add(id));
			}
		}

		// Merge each volume (newest wins)
		for (const volumeId of allVolumeIds) {
			let newestVolume: any = null;
			let newestDate = 0;

			for (const data of dataSources) {
				const volume = data?.[volumeId];
				if (volume && volume.lastProgressUpdate) {
					const date = new Date(volume.lastProgressUpdate).getTime();
					if (date > newestDate) {
						newestDate = date;
						newestVolume = volume;
					}
				}
			}

			if (newestVolume) {
				merged[volumeId] = newestVolume;
			}
		}

		return merged;
	}
}

export const providerManager = new ProviderManager();
