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
	/** Whether a provider is authenticated */
	isAuthenticated: boolean;
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
	// Track cache loaded state per session
	const cacheLoadedStore = writable(false);

	// Reset cache loaded state when cache starts fetching
	cacheManager.isFetchingState.subscribe((isFetching) => {
		if (isFetching) {
			// Cache is loading
		} else {
			// Cache finished loading
			cacheLoadedStore.set(true);
		}
	});

	return derived(
		[cacheManager.isFetchingState, cacheLoadedStore],
		([$isCacheLoading, $cacheLoaded]) => {
			const provider = providerManager.getActiveProvider();

			if (!provider) {
				return {
					isAuthenticated: false,
					isCacheLoading: false,
					isCacheLoaded: false,
					isFullyConnected: false,
					needsAttention: false,
					statusMessage: 'No provider connected'
				};
			}

			const status = provider.getStatus();
			const isFullyConnected = status.isAuthenticated && $cacheLoaded && !$isCacheLoading;

			return {
				isAuthenticated: status.isAuthenticated,
				isCacheLoading: $isCacheLoading,
				isCacheLoaded: $cacheLoaded,
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
