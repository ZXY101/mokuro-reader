import { providerManager } from './provider-manager';
import { megaProvider } from './providers/mega/mega-provider';
import { webdavProvider } from './providers/webdav/webdav-provider';

/**
 * Initialize all sync providers and register them with the provider manager.
 * This should be called once on app startup.
 */
export function initializeProviders(): void {
	// Register all providers
	providerManager.registerProvider(megaProvider);
	providerManager.registerProvider(webdavProvider);

	console.log('✅ Sync providers initialized');

	// Update status after registration
	providerManager.updateStatus();
}
