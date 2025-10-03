import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { GOOGLE_DRIVE_CONFIG, type TokenInfo } from './constants';
import { showSnackbar } from '../snackbar';

class TokenManager {
  private tokenStore = writable<string>('');
  private tokenClientStore = writable<any>(null);
  private refreshIntervalId: number | null = null;
  private isRefreshing = false;

  constructor() {
    if (browser) {
      this.loadPersistedToken();
      this.setupTokenRefreshInterval();
    }
  }

  get token() {
    return this.tokenStore;
  }

  get tokenClient() {
    return this.tokenClientStore;
  }

  private loadPersistedToken(): void {
    const token = localStorage.getItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.TOKEN);
    const expiresAt = localStorage.getItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.TOKEN_EXPIRES);

    if (token && expiresAt) {
      const now = Date.now();
      const expiry = parseInt(expiresAt, 10);

      // Check if token is still valid with buffer
      if (expiry > now + GOOGLE_DRIVE_CONFIG.TOKEN_REFRESH_BUFFER_MS) {
        this.setToken(token);
        // Only set gapi token if gapi is loaded
        if (typeof gapi !== 'undefined' && gapi.client) {
          gapi.client.setToken({ access_token: token });
        }
        console.log('Loaded persisted token, expires in', Math.round((expiry - now) / 60000), 'minutes');
      } else {
        console.log('Token expired or expiring soon, will need re-authentication');
        this.clearToken();
      }
    }
  }

  private setupTokenRefreshInterval(): void {
    // Clear any existing interval
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
    }

    // Check token validity periodically
    this.refreshIntervalId = window.setInterval(() => {
      const expiresAt = localStorage.getItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.TOKEN_EXPIRES);
      if (!expiresAt || !this.isAuthenticated()) return;

      const now = Date.now();
      const expiry = parseInt(expiresAt, 10);
      const timeUntilExpiry = expiry - now;

      // Try to silently refresh if expiring within buffer time
      if (timeUntilExpiry <= GOOGLE_DRIVE_CONFIG.TOKEN_REFRESH_BUFFER_MS && timeUntilExpiry > 0) {
        console.log('Token expiring in', Math.round(timeUntilExpiry / 60000), 'minutes, attempting silent refresh...');
        this.attemptSilentRefresh();
      }
      // Show warning if getting close to expiry
      else if (timeUntilExpiry <= GOOGLE_DRIVE_CONFIG.TOKEN_WARNING_BUFFER_MS && timeUntilExpiry > GOOGLE_DRIVE_CONFIG.TOKEN_REFRESH_BUFFER_MS) {
        const minutesLeft = Math.round(timeUntilExpiry / 60000);
        console.log(`Token expires in ${minutesLeft} minutes`);
      }
      // Token expired, clear it
      else if (timeUntilExpiry <= 0) {
        console.log('Token expired, clearing...');
        this.clearToken();
        showSnackbar('Google Drive session expired. Please sign in again.');
      }
    }, GOOGLE_DRIVE_CONFIG.TOKEN_REFRESH_CHECK_INTERVAL_MS);
  }

  setToken(token: string, expiresIn?: number): void {
    this.tokenStore.set(token);
    this.isRefreshing = false;

    if (browser) {
      localStorage.setItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.TOKEN, token);
      localStorage.setItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.LAST_AUTH_TIME, Date.now().toString());
      localStorage.setItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.HAS_AUTHENTICATED, 'true');

      if (expiresIn) {
        // Debug mode: Override expiry to 30 seconds for testing
        const actualExpiresIn = GOOGLE_DRIVE_CONFIG.DEBUG_SHORT_TOKEN_EXPIRY ? 30 : expiresIn;
        const expiresAt = Date.now() + (actualExpiresIn * 1000);
        localStorage.setItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.TOKEN_EXPIRES, expiresAt.toString());

        if (GOOGLE_DRIVE_CONFIG.DEBUG_SHORT_TOKEN_EXPIRY) {
          console.warn('🔧 DEBUG MODE: Token will expire in 30 seconds');
        } else {
          console.log('Token set, expires in', Math.round(expiresIn / 60), 'minutes');
        }
      }
    }
  }

  clearToken(keepAuthHistory = true): void {
    this.tokenStore.set('');
    this.isRefreshing = false;

    if (browser) {
      localStorage.removeItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.TOKEN);
      localStorage.removeItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.TOKEN_EXPIRES);
      localStorage.removeItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.LAST_AUTH_TIME);

      // Only clear auth history on explicit logout
      if (!keepAuthHistory) {
        localStorage.removeItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.HAS_AUTHENTICATED);
      }
    }

    // Clear from gapi client
    if (typeof gapi !== 'undefined' && gapi.client) {
      gapi.client.setToken(null);
    }
  }

  async revokeToken(token: string): Promise<void> {
    try {
      await fetch(`${GOOGLE_DRIVE_CONFIG.OAUTH_ENDPOINT}?token=${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
    } catch (error) {
      console.error('Error revoking token:', error);
    }
  }

  initTokenClient(): void {
    if (typeof google === 'undefined') {
      throw new Error('Google API not loaded');
    }

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_DRIVE_CONFIG.CLIENT_ID,
      scope: GOOGLE_DRIVE_CONFIG.SCOPES,
      callback: (response: any) => {
        if (response?.error) {
          console.error('Token client error:', response.error, response.error_description);

          // Handle specific error cases
          if (response.error === 'access_denied') {
            // User denied access OR permissions were revoked server-side by user/Google
            // Clear auth history to force full consent screen on next attempt
            // This ensures we re-request all permissions properly
            this.clearToken(false);
            showSnackbar('Google Drive access was denied. Please sign in again to grant permissions.');
          } else if (response.error === 'popup_closed') {
            // User closed the popup - don't clear anything, they might retry
            // Preserve all state so they can try again immediately
            showSnackbar('Sign-in cancelled. Please try again when ready.');
          } else {
            // Other errors (network issues, etc.) - keep auth history but clear token
            // Next sign-in will use minimal prompt since permissions weren't explicitly denied
            this.clearToken(true);
            showSnackbar('Authentication failed. Please try signing in again.');
          }

          this.isRefreshing = false;
          return;
        }

        const { access_token, expires_in } = response;
        if (access_token) {
          this.setToken(access_token, expires_in);
          gapi.client.setToken({ access_token });
        }
      }
    });

    this.tokenClientStore.set(tokenClient);
  }

  requestNewToken(silent = false, forceConsent = false): void {
    const tokenClient = this.tokenClientStore;
    let client: any;

    tokenClient.subscribe(value => { client = value; })();

    if (client) {
      // Determine if user has authenticated before
      const hasAuthenticated = browser && localStorage.getItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.HAS_AUTHENTICATED) === 'true';

      // Debug logging
      console.log('🔍 requestNewToken called:', {
        silent,
        forceConsent,
        hasAuthenticated,
        willUseConsent: forceConsent || !hasAuthenticated
      });

      if (silent) {
        // Attempt silent refresh (no UI shown)
        console.log('→ Using silent refresh (prompt: "none")');
        client.requestAccessToken({ prompt: 'none' });
      } else if (forceConsent || !hasAuthenticated) {
        // Force full consent screen (for initial auth or when explicitly requested)
        console.log('→ Using full consent screen (prompt: "consent")');
        client.requestAccessToken({ prompt: 'consent' });
      } else {
        // Re-authentication: minimal UI, just account selection, reuse existing permissions
        console.log('→ Using minimal re-auth (no prompt parameter = default select_account)');
        client.requestAccessToken({});
      }
    } else {
      throw new Error('Token client not initialized');
    }
  }

  private attemptSilentRefresh(): void {
    if (this.isRefreshing) {
      console.log('Token refresh already in progress, skipping...');
      return;
    }

    this.isRefreshing = true;

    try {
      // Try silent refresh first
      this.requestNewToken(true);

      // If silent refresh fails (callback gets error), it will be handled in the callback
      // and we'll fall back to requiring user interaction
    } catch (error) {
      console.error('Silent token refresh failed:', error);
      this.isRefreshing = false;

      // Show notification to user
      const expiresAt = localStorage.getItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.TOKEN_EXPIRES);
      if (expiresAt) {
        const timeLeft = parseInt(expiresAt, 10) - Date.now();
        const minutesLeft = Math.round(timeLeft / 60000);
        if (minutesLeft > 0 && minutesLeft <= 10) {
          showSnackbar(`Google Drive session expires in ${minutesLeft} minutes. Please re-authenticate to continue.`);
        }
      }
    }
  }

  async logout(): Promise<void> {
    // Clear the refresh interval
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
    }

    const currentToken = this.getCurrentToken();

    if (currentToken) {
      await this.revokeToken(currentToken);
    }

    // Clear token AND auth history on explicit logout
    this.clearToken(false);
  }

  private getCurrentToken(): string {
    let token = '';
    this.tokenStore.subscribe(value => { token = value; })();
    return token;
  }

  isAuthenticated(): boolean {
    return this.getCurrentToken() !== '';
  }

  getTimeUntilExpiry(): number | null {
    const expiresAt = localStorage.getItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.TOKEN_EXPIRES);
    if (!expiresAt) return null;

    const expiry = parseInt(expiresAt, 10);
    return expiry - Date.now();
  }

  getExpiryMinutes(): number | null {
    const timeLeft = this.getTimeUntilExpiry();
    return timeLeft ? Math.round(timeLeft / 60000) : null;
  }

  // Manual re-authentication (minimal UI, reuses existing permissions)
  reAuthenticate(): void {
    this.requestNewToken(false, false);
  }
}

export const tokenManager = new TokenManager();