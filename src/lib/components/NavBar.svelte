<script lang="ts">
  import { Navbar, NavBrand, Tooltip, Spinner } from 'flowbite-svelte';
  import { CloudArrowUpOutline, UploadSolid, UserSettingsSolid, RefreshOutline } from 'flowbite-svelte-icons';
  import { afterNavigate, goto } from '$app/navigation';
  import { page } from '$app/stores';
  import Settings from './Settings/Settings.svelte';
  import UploadModal from './UploadModal.svelte';
  import Icon from '$lib/assets/icon.webp';
  import { onMount } from 'svelte';
  import { showSnackbar } from '$lib/util';
  import { tokenManager } from '$lib/util/google-drive';
  import { unifiedCloudManager } from '$lib/util/sync/unified-cloud-manager';
  import { unifiedProviderState } from '$lib/util/sync/unified-provider-state';
  import type { UnifiedProviderState } from '$lib/util/sync/unified-provider-state';

  // Use $state to make these reactive
  let settingsHidden = $state(true);
  let uploadModalOpen = $state(false);
  let isReader = $state(false);

  let state = $state<UnifiedProviderState>({
    isAuthenticated: false,
    isCacheLoading: false,
    isCacheLoaded: false,
    isFullyConnected: false,
    needsAttention: false,
    statusMessage: 'No provider connected'
  });

  // Google Drive specific: Track token expiry for debug display
  let tokenMinutesLeft = $state<number | null>(null);
  let isGoogleDrive = $state<boolean>(false);

  // Track if any cloud providers are authenticated
  let hasAuthenticatedProviders = $state<boolean>(false);

  // Get active provider's display name
  let providerDisplayName = $derived.by(() => {
    const provider = unifiedCloudManager.getActiveProvider();
    return provider?.name || 'cloud';
  });

  // Subscribe to unified provider state
  $effect(() => {
    const unsubscribe = unifiedProviderState.subscribe(value => {
      state = value;
    });
    return unsubscribe;
  });

  // Check for authenticated providers and determine provider type
  $effect(() => {
    const checkProviders = () => {
      const activeProvider = unifiedCloudManager.getActiveProvider();
      hasAuthenticatedProviders = activeProvider !== null;
      isGoogleDrive = activeProvider?.type === 'google-drive';
    };

    checkProviders(); // Initial check
    const interval = setInterval(checkProviders, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  });

  // Google Drive specific: Update token minutes every 10 seconds when authenticated
  $effect(() => {
    if (!isGoogleDrive || !state.isAuthenticated) {
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
    // Sync with all authenticated providers
    unifiedCloudManager.syncProgress().catch(error => {
      console.error('Manual sync failed:', error);
      showSnackbar('Sync failed');
    });
  }

  // Google Drive specific: Manual token refresh handler
  function handleTokenRefresh() {
    if (isGoogleDrive && state.isAuthenticated) {
      tokenManager.reAuthenticate();
      showSnackbar(`Refreshing ${providerDisplayName} session...`);
    }
  }

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
        title={state.needsAttention ? `${providerDisplayName} - Action Required (click to sign in)` : state.isFullyConnected ? `${providerDisplayName} - Connected` : state.isAuthenticated ? `${providerDisplayName} - Loading...` : `${providerDisplayName} - Not connected`}
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
      {#if isGoogleDrive && state.isAuthenticated && tokenMinutesLeft !== null}
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
      {#if hasAuthenticatedProviders}
        <button
          onclick={handleSync}
          class="flex items-center justify-center w-6 h-6"
          title={`Sync read progress with ${providerDisplayName}`}
        >
          <RefreshOutline class="w-6 h-6 hover:text-primary-700 cursor-pointer" />
        </button>
      {/if}
    </div>
  </Navbar>
</div>

<Settings bind:hidden={settingsHidden} />
<UploadModal bind:open={uploadModalOpen} />
