import { providerManager } from './provider-manager';
import { googleDriveProvider } from './providers/google-drive/google-drive-provider';
import { megaProvider } from './providers/mega/mega-provider';
import { webdavProvider } from './providers/webdav/webdav-provider';
import { unifiedCloudManager } from './unified-cloud-manager';
import { driveApiClient } from '$lib/util/google-drive/api-client';

/**
 * Initialize all sync providers and register them with the provider manager.
 * This should be called once on app startup.
 */
export async function initializeProviders(): Promise<void> {
	// Initialize Google Drive API client first (needed before checking authentication)
	console.log('🔧 Initializing Google Drive API client...');
	try {
		await driveApiClient.initialize();
		console.log('✅ Google Drive API client initialized');
	} catch (error) {
		console.warn('⚠️ Failed to initialize Google Drive API client:', error);
	}

	// Register all providers
	providerManager.registerProvider(googleDriveProvider);
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

	// Initialize the current provider (detects which one is authenticated)
	providerManager.initializeCurrentProvider();

	// Fetch cloud volumes cache if a provider is authenticated
	const currentProvider = providerManager.getActiveProvider();
	if (currentProvider) {
		console.log(`📦 Populating cloud cache from ${currentProvider.type}...`);
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
		console.log('ℹ️ No provider authenticated, skipping cache population and sync');
	}
}
