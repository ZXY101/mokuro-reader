import { writable } from 'svelte/store';
import { tokenManager } from './token-manager';
import { driveApiClient, DriveApiError } from './api-client';
import { syncService } from './sync-service';
import { GOOGLE_DRIVE_CONFIG } from './constants';

// Re-export the main modules
export { tokenManager, driveApiClient, DriveApiError, syncService, GOOGLE_DRIVE_CONFIG };
export type { TokenInfo, DriveFile, SyncProgress } from './types';

// Backward compatibility exports for old API
export const accessTokenStore = tokenManager.token;
export const tokenClientStore = tokenManager.tokenClient;
export const readerFolderIdStore = syncService.readerFolderId;
export const volumeDataIdStore = writable<string>('');
export const profilesIdStore = writable<string>('');

// Constants compatibility
export const CLIENT_ID = GOOGLE_DRIVE_CONFIG.CLIENT_ID;
export const API_KEY = GOOGLE_DRIVE_CONFIG.API_KEY;
export const READER_FOLDER = GOOGLE_DRIVE_CONFIG.FOLDER_NAMES.READER;

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
    // Will auto-detect if first-time (consent) or re-auth (minimal)
    tokenManager.requestNewToken(false, false);
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

// Backward compatibility aliases
export const signIn = signInToGoogleDrive;
export const logout = signOutFromGoogleDrive;