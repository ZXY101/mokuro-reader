export { tokenManager } from './token-manager';
export { driveApiClient, DriveApiError } from './api-client';
export { syncService } from './sync-service';
export { GOOGLE_DRIVE_CONFIG } from './constants';
export type { TokenInfo, DriveFile, SyncProgress } from './types';

// Initialize the Google Drive API
export async function initGoogleDriveApi(): Promise<void> {
  try {
    await driveApiClient.initialize();
    
    // Check if we need to sync after login
    const shouldSync = localStorage.getItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.SYNC_AFTER_LOGIN);
    if (shouldSync === 'true' && tokenManager.isAuthenticated()) {
      localStorage.removeItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.SYNC_AFTER_LOGIN);
      setTimeout(() => syncService.syncReadProgress(), 500);
    }
  } catch (error) {
    console.error('Failed to initialize Google Drive API:', error);
    throw error;
  }
}

// Convenience functions for external use
export function signInToGoogleDrive(): void {
  if (!tokenManager.isAuthenticated()) {
    // First-time sign in: show full consent screen
    tokenManager.requestNewToken(false, true);
  }
}

export async function signOutFromGoogleDrive(): Promise<void> {
  await tokenManager.logout();
}

export function isSignedIn(): boolean {
  return tokenManager.isAuthenticated();
}

export async function syncReadProgress(): Promise<void> {
  await syncService.syncReadProgress();
}