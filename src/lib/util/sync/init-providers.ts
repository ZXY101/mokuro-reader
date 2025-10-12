import { providerManager } from './provider-manager';
import { megaProvider } from './providers/mega/mega-provider';
import { webdavProvider } from './providers/webdav/webdav-provider';
import { unifiedCloudManager } from './unified-cloud-manager';

/**
 * Initialize all sync providers and register them with the provider manager.
 * This should be called once on app startup.
 */
export async function initializeProviders(): Promise<void> {
	// Register all providers
	providerManager.registerProvider(megaProvider);
	providerManager.registerProvider(webdavProvider);

	console.log('✅ Sync providers initialized');

	// Update status after registration
	providerManager.updateStatus();

	// Wait for providers to be ready (MEGA/WebDAV restore credentials on init)
	console.log('⏳ Waiting for providers to be ready...');
	await Promise.all([
		megaProvider.whenReady(),
		webdavProvider.whenReady()
	]);
	console.log('✅ Providers are ready');

	// Update status again after providers finish authentication
	providerManager.updateStatus();

	// Fetch cloud volumes cache if any provider is authenticated
	const authenticatedProviders = unifiedCloudManager.getAllProviders().filter(p => p.isAuthenticated());
	if (authenticatedProviders.length > 0) {
		console.log(`📦 Populating cloud cache from ${authenticatedProviders.length} provider(s)...`);
		try {
			await unifiedCloudManager.fetchAllCloudVolumes();
			console.log('✅ Cloud cache populated on app startup');

			// Sync progress after cache is populated
			console.log('🔄 Syncing progress on app startup...');
			await unifiedCloudManager.syncProgress({ silent: true });
			console.log('✅ Initial sync completed');
		} catch (error) {
			console.warn('⚠️ Failed to populate cloud cache or sync on startup:', error);
		}
	} else {
		console.log('ℹ️ No providers authenticated, skipping cache population and sync');
	}
}
