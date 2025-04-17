<script lang="ts">
  import { Navbar, NavBrand, Tooltip } from 'flowbite-svelte';
  import { CloudArrowUpOutline, UploadSolid, UserSettingsSolid, RefreshOutline } from 'flowbite-svelte-icons';
  import { afterNavigate, goto } from '$app/navigation';
  import { page } from '$app/stores';
  import Settings from './Settings/Settings.svelte';
  import UploadModal from './UploadModal.svelte';
  import Icon from '$lib/assets/icon.webp';
  import { onMount } from 'svelte';

  // Use $state to make these reactive
  let settingsHidden = $state(true);
  let uploadModalOpen = $state(false);
  let isReader = $state(false);
  let accessToken = $state('');
  let syncVolumeData: () => Promise<void>;

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
    if (typeof syncVolumeData === 'function') {
      syncVolumeData();
    } else {
      goto('/cloud');
    }
  }
  
  // Check if user is logged in to Google Drive
  onMount(() => {
    // Check for saved token
    const savedToken = localStorage.getItem('gdrive_token');
    if (savedToken) {
      accessToken = savedToken;
    }
    
    // Import the syncVolumeData function from the cloud page
    import('../../routes/cloud/+page.svelte').then(module => {
      syncVolumeData = module.syncVolumeData;
    }).catch(error => {
      console.error('Failed to import syncVolumeData:', error);
    });
    
    // Listen for changes to the token
    window.addEventListener('storage', (event) => {
      if (event.key === 'gdrive_token') {
        accessToken = event.newValue || '';
      }
    });
  });

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
      <button onclick={navigateToCloud} class="flex items-center justify-center w-6 h-6">
        <CloudArrowUpOutline class="w-6 h-6 hover:text-primary-700 cursor-pointer" />
      </button>
      <div class="relative">
        <Tooltip content={accessToken ? "Sync volume data with cloud" : "Sign in to sync"}>
          <button 
            onclick={handleSync} 
            class="flex items-center justify-center w-6 h-6" 
            disabled={!accessToken}
          >
            <RefreshOutline class={`w-6 h-6 ${accessToken ? 'hover:text-primary-700 cursor-pointer' : 'text-gray-400 cursor-not-allowed'}`} />
          </button>
        </Tooltip>
      </div>
    </div>
  </Navbar>
</div>

<Settings bind:hidden={settingsHidden} />
<UploadModal bind:open={uploadModalOpen} />
