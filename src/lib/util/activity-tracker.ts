import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { syncReadProgress } from './google-drive';
import { tokenManager } from './google-drive/token-manager';

type ActivityCallback = {
  onActive: () => void;
  onInactive: () => void;
};

class ActivityTracker {
  private timeoutId: number | null = null;
  private isActive = writable(false);
  private callbacks: ActivityCallback | null = null;
  private timeoutDuration = 5 * 60 * 1000; // 5 minutes in milliseconds

  constructor() {
    if (browser) {
      // Subscribe to activity state changes
      this.isActive.subscribe(active => {
        if (active) {
          this.callbacks?.onActive();
        } else {
          this.callbacks?.onInactive();
        }
      });
    }
  }

  /**
   * Set the inactivity timeout duration
   */
  setTimeoutDuration(minutes: number) {
    this.timeoutDuration = minutes * 60 * 1000;
    // Restart the timer with new duration if currently active
    if (this.timeoutId !== null) {
      this.recordActivity();
    }
  }

  /**
   * Initialize the activity tracker with callbacks
   */
  initialize(callbacks: ActivityCallback) {
    this.callbacks = callbacks;
  }

  /**
   * Record user activity (page turn)
   */
  recordActivity() {
    // Clear existing timeout
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
    }

    // Set active state
    this.isActive.set(true);

    // Set new timeout
    this.timeoutId = window.setTimeout(() => {
      this.handleInactivity();
    }, this.timeoutDuration);
  }

  /**
   * Handle inactivity timeout
   */
  private async handleInactivity() {
    console.log('User inactive for', this.timeoutDuration / 60000, 'minutes');

    // Set inactive state (will trigger timer stop via callback)
    this.isActive.set(false);

    // Trigger sync if authenticated
    if (tokenManager.isAuthenticated()) {
      console.log('Auto-syncing due to inactivity...');
      try {
        await syncReadProgress();
      } catch (error) {
        console.error('Auto-sync failed:', error);
      }
    }

    // Clear timeout
    this.timeoutId = null;
  }

  /**
   * Stop tracking and clear timeout
   */
  stop() {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.isActive.set(false);
  }

  /**
   * Get current active state
   */
  get active() {
    return this.isActive;
  }
}

export const activityTracker = new ActivityTracker();
