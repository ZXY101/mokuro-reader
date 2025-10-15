/**
 * Multi-Provider Sync Module
 *
 * Exports all sync providers and the provider manager for unified sync operations.
 */

export * from './provider-interface';
export * from './provider-manager';
export * from './cloud-cache-interface';
export { cacheManager } from './cache-manager';
export type { GenericCloudFile } from './cache-manager';
export { unifiedProviderState } from './unified-provider-state';
export type { UnifiedProviderState } from './unified-provider-state';

// Export provider instances
export { googleDriveProvider } from './providers/google-drive/google-drive-provider';
export { megaProvider } from './providers/mega/mega-provider';
export { webdavProvider } from './providers/webdav/webdav-provider';
