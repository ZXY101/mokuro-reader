import { browser } from '$app/environment';
import { providerManager } from './provider-manager';
import { googleDriveProvider } from './providers/google-drive/google-drive-provider';
import { megaProvider } from './providers/mega/mega-provider';
import { webdavProvider } from './providers/webdav/webdav-provider';
import { unifiedCloudManager } from './unified-cloud-manager';
import { driveApiClient } from '$lib/util/google-drive/api-client';
import { GOOGLE_DRIVE_CONFIG } from '$lib/util/google-drive/constants';

/**
 * Check which provider (if any) has stored credentials
 * Since providers are mutually exclusive, returns the active provider type or null
 */
function getActiveProviderType(): 'google-drive' | 'mega' | 'webdav' | null {
	if (!browser) return null;

	// Check Google Drive token (and ensure it's not expired)
	const gdriveToken = localStorage.getItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.TOKEN);
	const gdriveExpiry = localStorage.getItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.TOKEN_EXPIRES);
	if (gdriveToken && gdriveExpiry) {
		const expiryTime = parseInt(gdriveExpiry, 10);
		if (expiryTime > Date.now()) {
			return 'google-drive';
		}
	}

	// Check MEGA credentials
	const megaEmail = localStorage.getItem('mega_email');
	const megaPassword = localStorage.getItem('mega_password');
	if (megaEmail && megaPassword) {
		return 'mega';
	}

	// Check WebDAV credentials
	const webdavUrl = localStorage.getItem('webdav_server_url');
	const webdavUsername = localStorage.getItem('webdav_username');
	const webdavPassword = localStorage.getItem('webdav_password');
	if (webdavUrl && webdavUsername && webdavPassword) {
		return 'webdav';
	}

	return null; // No provider has credentials
}

/**
 * Initialize all sync providers and register them with the provider manager.
 * This should be called once on app startup.
 *
 * Strategy:
 * - Always register providers (needed for login buttons to work)
 * - Only initialize API for the active provider (since providers are mutually exclusive)
 * - Inactive providers will lazy-initialize when user clicks login
 */
export async function initializeProviders(): Promise<void> {
	// Always register all providers (so login buttons work, even if not logged in)
	providerManager.registerProvider(googleDriveProvider);
	providerManager.registerProvider(megaProvider);
	providerManager.registerProvider(webdavProvider);

	console.log('✅ Sync providers registered');

	// Check which provider (if any) is active
	// Providers are mutually exclusive - only one can be logged in at a time
	const activeProvider = getActiveProviderType();

	// If no provider is active, we're done - providers will lazy-init when user clicks login
	if (!activeProvider) {
		console.log('ℹ️ No active provider. Providers will initialize on login.');
		return;
	}

	// Only initialize Google Drive API if it's the active provider (for auto-restore)
	// MEGA and WebDAV handle their own initialization in whenReady()
	if (activeProvider === 'google-drive') {
		console.log('🔧 Initializing Google Drive API client for auto-restore...');
		try {
			await driveApiClient.initialize();
			console.log('✅ Google Drive API client initialized');
		} catch (error) {
			console.warn('⚠️ Failed to initialize Google Drive API client:', error);
		}
	}

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
