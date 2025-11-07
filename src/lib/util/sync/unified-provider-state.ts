import { derived, writable, type Readable } from 'svelte/store';
import type { ProviderStatus } from './provider-interface';
import { cacheManager } from './cache-manager';
import { providerManager } from './provider-manager';

/**
 * Unified provider state that combines:
 * - Provider authentication status
 * - Cache loading/loaded state
 * - Provider availability
 */
export interface UnifiedProviderState {
	/** Whether a provider is authenticated and connected */
	isAuthenticated: boolean;
	/** Whether credentials are configured (even if not currently connected) */
	hasStoredCredentials: boolean;
	/** Whether the cache is currently loading */
	isCacheLoading: boolean;
	/** Whether the cache has been loaded at least once */
	isCacheLoaded: boolean;
	/** Whether provider is fully connected (authenticated + cache loaded) */
	isFullyConnected: boolean;
	/** Whether provider needs user attention (e.g., re-authentication) */
	needsAttention: boolean;
	/** Status message from provider */
	statusMessage: string;
}

/**
 * Create a reactive store that combines provider status and cache state
 */
function createUnifiedProviderState(): Readable<UnifiedProviderState> {
	// Track whether cache has ever finished loading (stays true once set)
	let hasLoadedOnce = false;

	return derived(
		[cacheManager.isFetchingState],
		([$isCacheLoading]) => {
			const provider = providerManager.getActiveProvider();

			// Track if cache has loaded at least once
			if (!$isCacheLoading && !hasLoadedOnce) {
				hasLoadedOnce = true;
			}

			if (!provider) {
				return {
					isAuthenticated: false,
					hasStoredCredentials: false,
					isCacheLoading: false,
					isCacheLoaded: hasLoadedOnce,
					isFullyConnected: false,
					needsAttention: false,
					statusMessage: 'No provider connected'
				};
			}

			const status = provider.getStatus();
			const isFullyConnected = status.isAuthenticated && hasLoadedOnce && !$isCacheLoading;

			return {
				isAuthenticated: status.isAuthenticated,
				hasStoredCredentials: status.hasStoredCredentials,
				isCacheLoading: $isCacheLoading,
				isCacheLoaded: hasLoadedOnce,
				isFullyConnected,
				needsAttention: status.needsAttention,
				statusMessage: status.statusMessage
			};
		}
	);
}

/**
 * Unified provider state store
 * Automatically updates when active provider or cache state changes
 */
export const unifiedProviderState = createUnifiedProviderState();
