<script lang="ts">
  import { Navbar, NavBrand, Tooltip, Spinner } from 'flowbite-svelte';
  import { CloudArrowUpOutline, UploadSolid, UserSettingsSolid, RefreshOutline } from 'flowbite-svelte-icons';
  import { afterNavigate, goto } from '$app/navigation';
  import { page } from '$app/stores';
  import Settings from './Settings/Settings.svelte';
  import UploadModal from './UploadModal.svelte';
  import Icon from '$lib/assets/icon.webp';
  import { onMount } from 'svelte';
  import { showSnackbar, syncReadProgress } from '$lib/util';
  import { driveState, tokenManager } from '$lib/util/google-drive';
  import type { DriveState } from '$lib/util/google-drive';

  // Use $state to make these reactive
  let settingsHidden = $state(true);
  let uploadModalOpen = $state(false);
  let isReader = $state(false);

  let state = $state<DriveState>({
    isAuthenticated: false,
    isCacheLoading: false,
    isCacheLoaded: false,
    isFullyConnected: false,
    needsAttention: false
  });

  // Layer 1: Track token expiry for debug display
  let tokenMinutesLeft = $state<number | null>(null);

  // Subscribe to drive state
  $effect(() => {
    const unsubscribe = driveState.subscribe(value => {
      state = value;
    });
    return unsubscribe;
  });

  // Update token minutes every 10 seconds when authenticated
  $effect(() => {
    if (!state.isAuthenticated) {
      tokenMinutesLeft = null;
      return;
    }

    const updateTokenTime = () => {
      tokenMinutesLeft = tokenManager.getExpiryMinutes();
    };

    updateTokenTime(); // Initial update
    const interval = setInterval(updateTokenTime, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  });

  // Define event handlers
  function openSettings() {
    settingsHidden = false;
  }

  function openUploadModal() {
    uploadModalOpen = true;
  }

  function navigateToCloud() {
    goto('/cloud');
  }
  
  function handleSync() {
    // syncReadProgress handles login if not authenticated or in error state
    syncReadProgress();
  }

  // Layer 1: Manual token refresh handler
  function handleTokenRefresh() {
    if (state.isAuthenticated) {
      tokenManager.reAuthenticate();
      showSnackbar('Refreshing Google Drive session...');
    }
  }

  // Token changes are handled automatically by tokenManager
  // No need to manually listen to localStorage changes

  afterNavigate(() => {
    isReader = $page.route.id === '/[manga]/[volume]';

    if (isReader) {
      window.document.body.classList.add('reader');
    } else {
      window.document.body.classList.remove('reader');
    }
  });
</script>

<div class="relative z-10">
  <Navbar hidden={isReader}>
    <NavBrand href="/">
      <div class="flex flex-row gap-2 items-center">
        <img src={Icon} alt="icon" class="w-[32px] h-[32px]" />
        <span class="text-xl font-semibold dark:text-white">Mokuro</span>
      </div>
    </NavBrand>
    <div class="flex md:order-2 gap-5">
      <button onclick={openSettings} class="flex items-center justify-center w-6 h-6">
        <UserSettingsSolid class="w-6 h-6 hover:text-primary-700 cursor-pointer" />
      </button>
      <button onclick={openUploadModal} class="flex items-center justify-center w-6 h-6">
        <UploadSolid class="w-6 h-6 hover:text-primary-700 cursor-pointer" />
      </button>
      <button
        onclick={navigateToCloud}
        class="flex items-center justify-center w-6 h-6"
        title={state.needsAttention ? "Google Drive - Action Required (click to sign in)" : state.isFullyConnected ? "Google Drive - Connected" : state.isAuthenticated ? "Google Drive - Loading..." : "Google Drive - Not connected"}
      >
        {#if state.needsAttention}
          <CloudArrowUpOutline class="w-6 h-6 text-red-600 hover:text-red-700 cursor-pointer" />
        {:else if state.isCacheLoading && !state.isCacheLoaded}
          <Spinner size="4" />
        {:else if state.isFullyConnected}
          <CloudArrowUpOutline class="w-6 h-6 text-green-600 hover:text-green-700 cursor-pointer" />
        {:else if state.isAuthenticated}
          <CloudArrowUpOutline class="w-6 h-6 text-yellow-600 hover:text-yellow-700 cursor-pointer" />
        {:else}
          <CloudArrowUpOutline class="w-6 h-6 hover:text-primary-700 cursor-pointer" />
        {/if}
      </button>
      {#if state.isAuthenticated && tokenMinutesLeft !== null}
        <button
          onclick={handleTokenRefresh}
          class="flex items-center justify-center px-2 py-1 rounded text-xs font-mono cursor-pointer transition-colors
            {tokenMinutesLeft > 30 ? 'text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20' :
             tokenMinutesLeft > 10 ? 'text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/20' :
             'text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20'}"
          title="Token expires in {tokenMinutesLeft} minutes. Click to refresh now."
        >
          {tokenMinutesLeft}m
        </button>
      {/if}
      <button
        onclick={handleSync}
        class="flex items-center justify-center w-6 h-6"
        title={state.isAuthenticated ? "Sync read progress with Google Drive" : "Sign in to sync"}
      >
        <RefreshOutline class="w-6 h-6 hover:text-primary-700 cursor-pointer" />
      </button>
    </div>
  </Navbar>
</div>

<Settings bind:hidden={settingsHidden} />
<UploadModal bind:open={uploadModalOpen} />
