import { browser } from '$app/environment';
import { initGoogleDriveApi } from '$lib/util';

// Disable SSR - this app requires IndexedDB and other browser APIs
export const ssr = false;

// Initialize services that should be available app-wide
export function load() {
  if (browser) {
    // Initialize Google Drive API
    initGoogleDriveApi().catch(error => {
      console.error('Failed to initialize Google Drive API:', error);
    });
    
    // Start thumbnail processing
    import('$lib/catalog/thumbnails');
  }
  
  return {};
}