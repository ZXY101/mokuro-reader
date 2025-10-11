import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { GOOGLE_DRIVE_CONFIG, type TokenInfo } from './constants';
import { showSnackbar } from '../snackbar';
import { syncService } from './sync-service';
import { driveFilesCache } from './drive-files-cache';

class TokenManager {
  private tokenStore = writable<string>('');
  private tokenClientStore = writable<any>(null);
  private needsAttentionStore = writable<boolean>(false);
  private refreshIntervalId: number | null = null;
  private isRefreshing = false;

  // Layer 1: Smart refresh tracking
  private refreshAttemptCount = 0;
  private ssoHealthy = true;
  private currentScheduleIndex = -1;
  private pendingRetryTimeout: number | null = null;

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

  get needsAttention() {
    return this.needsAttentionStore;
  }

  private loadPersistedToken(): void {
    const token = localStorage.getItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.TOKEN);
    const expiresAt = localStorage.getItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.TOKEN_EXPIRES);

    if (token && expiresAt) {
      const now = Date.now();
      const expiry = parseInt(expiresAt, 10);

      // Check if token is still valid (with some buffer time)
      if (expiry > now) {
        // Just update the store, don't modify localStorage
        this.tokenStore.set(token);

        // Only set gapi token if gapi is loaded
        if (typeof gapi !== 'undefined' && gapi.client) {
          gapi.client.setToken({ access_token: token });
        }
        console.log('Loaded persisted token, expires in', Math.round((expiry - now) / 60000), 'minutes');
      } else {
        console.log('Token expired, will need re-authentication');
        this.clearToken();
      }
    }
  }

  private setupTokenRefreshInterval(): void {
    // Clear any existing interval
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
    }

    // Layer 1: Smart multi-attempt refresh checker
    this.refreshIntervalId = window.setInterval(() => {
      const expiresAt = localStorage.getItem(GOOGLE_DRIVE_CONFIG.STORAGE_KEYS.TOKEN_EXPIRES);
      if (!expiresAt || !this.isAuthenticated()) return;

      const now = Date.now();
      const expiry = parseInt(expiresAt, 10);
      const timeUntilExpiry = expiry - now;

      // Token expired, clear it
      if (timeUntilExpiry <= 0) {
        console.log('❌ Token expired, clearing...');
        this.clearToken();
        this.needsAttentionStore.set(true);
        showSnackbar('Google Drive session expired. Please sign in again.');
        return;
      }

      // Check if we've entered a new refresh schedule window
      const schedulePoint = this.getActiveSchedulePoint(timeUntilExpiry);

      if (schedulePoint !== null && schedulePoint !== this.currentScheduleIndex) {
        // New schedule point reached
        console.log(`📅 Entered refresh schedule point ${schedulePoint} (${Math.round(timeUntilExpiry / 60000)} min left)`);
        this.currentScheduleIndex = schedulePoint;
        this.refreshAttemptCount = 0; // Reset attempt counter for this schedule point
        this.attemptSmartRefresh();
      }
      // Show warning if refresh attempts are failing and we're getting close to expiry
      else if (timeUntilExpiry <= GOOGLE_DRIVE_CONFIG.TOKEN_WARNING_BUFFER_MS && !this.ssoHealthy) {
        const minutesLeft = Math.round(timeUntilExpiry / 60000);
        if (minutesLeft > 0 && minutesLeft <= 10 && minutesLeft % 5 === 0) {
          console.warn(`⚠️ Token expires in ${minutesLeft} minutes, refresh attempts failing`);
        }
      }
    }, GOOGLE_DRIVE_CONFIG.TOKEN_REFRESH_CHECK_INTERVAL_MS);
  }

  // Determine which schedule point is active based on time until expiry
  private getActiveSchedulePoint(timeUntilExpiry: number): number | null {
    for (let i = 0; i < GOOGLE_DRIVE_CONFIG.REFRESH_SCHEDULE.length; i++) {
      const schedule = GOOGLE_DRIVE_CONFIG.REFRESH_SCHEDULE[i];
      // Check if we're within the window (with 30 second buffer to avoid missing)
      if (timeUntilExpiry <= schedule.at && timeUntilExpiry > schedule.at - 30000) {
        return i;
      }
    }
    return null;
  }

  setToken(token: string, expiresIn?: number): void {
    this.tokenStore.set(token);
    this.isRefreshing = false;
    this.needsAttentionStore.set(false); // Clear attention flag when token is set

    // Layer 1: Mark SSO as healthy and reset refresh state on successful token acquisition
    this.ssoHealthy = true;
    this.currentScheduleIndex = -1; // Reset schedule to allow new refresh cycle
    this.refreshAttemptCount = 0;
    if (this.pendingRetryTimeout) {
      clearTimeout(this.pendingRetryTimeout);
      this.pendingRetryTimeout = null;
    }

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
          console.log('✅ Token set successfully, expires in', Math.round(expiresIn / 60), 'minutes');
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
            this.clearToken(false);
            this.needsAttentionStore.set(true);
            showSnackbar('Google Drive access was denied. Please sign in again to grant permissions.');
          } else if (response.error === 'popup_closed') {
            // User closed the popup - don't clear anything, they might retry
            // Preserve all state so they can try again immediately
            showSnackbar('Sign-in cancelled. Please try again when ready.');
          } else if (response.error === 'popup_failed_to_open' || response.error === 'popup_blocked') {
            // Silent refresh failed (no popup shown) - this is expected during background refresh
            // Layer 1: Handle this gracefully with retry logic
            console.log('Silent refresh attempt failed (SSO may be expired)');
            this.handleRefreshFailure();
          } else {
            // Other errors (network issues, etc.) - keep auth history but clear token
            // Next sign-in will use minimal prompt since permissions weren't explicitly denied
            this.clearToken(true);
            this.needsAttentionStore.set(true);
            showSnackbar('Authentication failed. Please try signing in again.');
          }

          this.isRefreshing = false;
          return;
        }

        const { access_token, expires_in } = response;
        if (access_token) {
          this.setToken(access_token, expires_in);
          gapi.client.setToken({ access_token });

          // Fetch Drive cache after successful login
          // The cache will automatically trigger sync when loaded if SYNC_AFTER_LOGIN flag is set
          driveFilesCache.fetchAllFiles().catch(err =>
            console.error('Failed to fetch Drive files cache after login:', err)
          );
        }
      }
    });

    this.tokenClientStore.set(tokenClient);

    // If we have a persisted token in the store, set it in gapi.client now that gapi is loaded
    const currentToken = this.getCurrentToken();
    if (currentToken && typeof gapi !== 'undefined' && gapi.client) {
      gapi.client.setToken({ access_token: currentToken });
      console.log('Restored persisted token to gapi.client');
    }
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

  // Layer 1: Smart multi-attempt refresh with retry logic
  private attemptSmartRefresh(): void {
    if (this.isRefreshing) {
      console.log('🔄 Token refresh already in progress, skipping...');
      return;
    }

    const schedule = GOOGLE_DRIVE_CONFIG.REFRESH_SCHEDULE[this.currentScheduleIndex];
    if (!schedule) return;

    // Check if we've exceeded max retries for this schedule point
    if (this.refreshAttemptCount >= schedule.maxRetries) {
      console.log(`⏭️ Max retries (${schedule.maxRetries}) reached for schedule point ${this.currentScheduleIndex}`);
      return;
    }

    this.refreshAttemptCount++;
    this.isRefreshing = true;

    console.log(`🔄 Refresh attempt #${this.refreshAttemptCount} at schedule point ${this.currentScheduleIndex}`);

    try {
      // Try silent refresh leveraging SSO
      this.requestNewToken(true); // silent = true

      // Success/failure will be handled in the callback
      // If it fails, we'll schedule a retry with exponential backoff

    } catch (error) {
      console.error('❌ Silent token refresh failed:', error);
      this.isRefreshing = false;
      this.handleRefreshFailure();
    }
  }

  // Handle refresh failure and schedule retry if appropriate
  private handleRefreshFailure(): void {
    this.ssoHealthy = false;

    const schedule = GOOGLE_DRIVE_CONFIG.REFRESH_SCHEDULE[this.currentScheduleIndex];
    if (!schedule) return;

    // Schedule retry with exponential backoff if we haven't hit max retries
    if (this.refreshAttemptCount < schedule.maxRetries) {
      // Exponential backoff: 10s, 20s, 40s, etc.
      const retryDelay = Math.min(10000 * Math.pow(2, this.refreshAttemptCount - 1), 60000);
      console.log(`⏰ Scheduling retry in ${retryDelay / 1000}s (attempt ${this.refreshAttemptCount}/${schedule.maxRetries})`);

      if (this.pendingRetryTimeout) {
        clearTimeout(this.pendingRetryTimeout);
      }

      this.pendingRetryTimeout = window.setTimeout(() => {
        this.attemptSmartRefresh();
      }, retryDelay);
    } else {
      // All retries exhausted for this schedule point
      const timeLeft = this.getTimeUntilExpiry();
      const minutesLeft = timeLeft ? Math.round(timeLeft / 60000) : 0;

      if (minutesLeft > 0 && minutesLeft <= 5) {
        showSnackbar(`Google Drive session expires in ${minutesLeft} minutes. Please re-authenticate to continue.`);
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