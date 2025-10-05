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
  import { driveState } from '$lib/util/google-drive';
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

  // Subscribe to drive state
  $effect(() => {
    const unsubscribe = driveState.subscribe(value => {
      state = value;
    });
    return unsubscribe;
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
    if (!state.isAuthenticated) {
      showSnackbar('Please sign in to Google Drive first', 'error');
      return;
    }
    // Use the syncReadProgress function from the google-drive utility
    syncReadProgress();
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
