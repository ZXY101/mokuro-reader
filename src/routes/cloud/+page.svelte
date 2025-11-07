<script lang="ts">
  import { run } from 'svelte/legacy';

  import { profiles } from '$lib/settings';
  import { miscSettings, updateMiscSetting } from '$lib/settings/misc';

  import {
    promptConfirmation,
    showSnackbar,
    uploadFile,
    accessTokenStore,
    volumeDataIdStore,
    profilesIdStore,
    tokenClientStore,
    signIn,
    logout,
    syncReadProgress,
    READER_FOLDER,
    CLIENT_ID,
    API_KEY
  } from '$lib/util';
  import { unifiedCloudManager } from '$lib/util/sync/unified-cloud-manager';
  import { backupQueue } from '$lib/util/backup-queue';
  import { driveState } from '$lib/util/google-drive';
  import type { DriveState } from '$lib/util/google-drive';
  import { progressTrackerStore } from '$lib/util/progress-tracker';
  import { get } from 'svelte/store';
  import { Badge, Button, Radio, Toggle, Spinner } from 'flowbite-svelte';
  import { onMount } from 'svelte';
  import { GoogleSolid } from 'flowbite-svelte-icons';
  import { catalog } from '$lib/catalog';
  import type { VolumeMetadata } from '$lib/types';

  // Import multi-provider sync
  import { providerManager, megaProvider, webdavProvider, googleDriveProvider } from '$lib/util/sync';
  import { queueVolumesFromCloudFiles } from '$lib/util/download-queue';

  // Get store references for auto-subscription
  const providerStatusStore = providerManager.status;

  // Use Svelte's derived runes for automatic store subscriptions
  let accessToken = $derived($accessTokenStore);
  // Note: readerFolderId removed - was part of legacy sync-service (now deleted)
  let volumeDataId = $derived($volumeDataIdStore);
  let profilesId = $derived($profilesIdStore);
  let tokenClient = $derived($tokenClientStore);
  let state = $derived($driveState);

  // Reactive provider authentication checks - now using provider manager for all providers
  // Use derived to reactively compute auth states from the status store
  let googleDriveAuth = $derived($providerStatusStore.providers['google-drive']?.isAuthenticated || false);
  let megaAuth = $derived($providerStatusStore.providers['mega']?.isAuthenticated || false);
  let webdavAuth = $derived($providerStatusStore.providers['webdav']?.isAuthenticated || false);
  let hasAnyProvider = $derived($providerStatusStore.hasAnyAuthenticated);

  // Check if providers are configured (even if not currently connected)
  let googleDriveConfigured = $derived($providerStatusStore.providers['google-drive']?.hasStoredCredentials || false);
  let megaConfigured = $derived($providerStatusStore.providers['mega']?.hasStoredCredentials || false);
  let webdavConfigured = $derived($providerStatusStore.providers['webdav']?.hasStoredCredentials || false);

  // Google Drive login state
  let googleDriveLoading = $state(false);

  // MEGA login state
  let megaEmail = $state('');
  let megaPassword = $state('');
  let megaLoading = $state(false);

  // WebDAV login state
  let webdavUrl = $state('');
  let webdavUsername = $state('');
  let webdavPassword = $state('');
  let webdavLoading = $state(false);

  // Use constants from the google-drive utility
  const type = 'application/json';

  // Error handler for Google Drive operations
  function handleDriveError(error: unknown, context: string): void {
    console.error(`Google Drive error (${context}):`, error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    showSnackbar(`Failed ${context}: ${message}`);
  }

  // Function to clear service worker cache for Google Drive downloads
  async function clearServiceWorkerCache() {
    if ('caches' in window) {
      try {
        console.log('Clearing service worker cache for Google Drive downloads...');
        
        // Get all cache keys
        const cacheKeys = await caches.keys();
        console.log('Found caches:', cacheKeys);
        
        for (const cacheName of cacheKeys) {
          const cache = await caches.open(cacheName);
          
          // Get all cache entries
          const requests = await cache.keys();
          console.log(`Cache ${cacheName} has ${requests.length} entries`);
          
          // Filter for Google Drive API requests
          const driveRequests = requests.filter(request => 
            request.url.includes('googleapis.com/drive') || 
            request.url.includes('alt=media')
          );
          
          console.log(`Found ${driveRequests.length} Google Drive API requests in cache ${cacheName}`);
          
          // Delete each Google Drive API request from the cache
          for (const request of driveRequests) {
            console.log(`Deleting cached request: ${request.url}`);
            await cache.delete(request);
          }
        }
        
        console.log('Service worker cache cleared for Google Drive downloads');
      } catch (error) {
        console.error('Error clearing service worker cache:', error);
      }
    }
  }

  async function createPicker() {
    try {
      // Use provider's file picker - it handles all the Drive-specific logic
      const pickedFiles = await googleDriveProvider.showFilePicker();

      if (pickedFiles.length === 0) {
        return; // User cancelled or no files selected
      }

      // Fetch full metadata from Drive API
      const cloudFiles = await googleDriveProvider.getCloudFileMetadata(pickedFiles);

      // Queue volumes for download via the unified queue system
      queueVolumesFromCloudFiles(cloudFiles);

      showSnackbar(`Queued ${cloudFiles.length} file${cloudFiles.length === 1 ? '' : 's'} for download`);
    } catch (error) {
      handleDriveError(error, 'selecting files');
    }
  }


  async function onUploadProfiles() {
    const metadata = {
      mimeType: type,
      name: 'profiles.json',
      parents: profilesId ? [] : undefined // Only set parents if creating new file
    };

    const processId = 'upload-profiles';
    progressTrackerStore.addProcess({
      id: processId,
      description: 'Uploading profiles',
      progress: 0,
      status: 'Starting upload...'
    });

    try {
      // Update progress to show it's in progress
      progressTrackerStore.updateProcess(processId, {
        progress: 50,
        status: 'Uploading...'
      });

      const res = await uploadFile({
        accessToken,
        fileId: profilesId,
        metadata,
        localStorageId: 'profiles',
        type
      });

      profilesId = res.id;

      progressTrackerStore.updateProcess(processId, {
        progress: 100,
        status: 'Upload complete'
      });
      setTimeout(() => progressTrackerStore.removeProcess(processId), 3000);

      if (profilesId) {
        showSnackbar('Profiles uploaded');
      }
    } catch (error) {
      progressTrackerStore.updateProcess(processId, {
        progress: 0,
        status: 'Upload failed'
      });
      setTimeout(() => progressTrackerStore.removeProcess(processId), 3000);
      handleDriveError(error, 'uploading profiles');
    }
  }
  
  // For backward compatibility with the button in the cloud page
  async function performSync() {
    await syncReadProgress();
  }

  /**
   * Common post-login handler for all providers
   * Automatically syncs progress after successful login
   */
  async function handlePostLogin() {
    try {
      await performSync();
    } catch (error) {
      // Silently catch sync errors - don't block successful login
      console.error('Post-login sync failed:', error);
    }
  }

  onMount(() => {
    // Clear service worker cache for Google Drive downloads
    // This is cloud-page-specific and not part of global init
    clearServiceWorkerCache();
  });

  async function onDownloadProfiles() {
    const processId = 'download-profiles';
    progressTrackerStore.addProcess({
      id: processId,
      description: 'Downloading profiles',
      progress: 0,
      status: 'Starting download...'
    });

    try {
      // Update progress to show it's in progress
      progressTrackerStore.updateProcess(processId, {
        progress: 50,
        status: 'Downloading...'
      });

      const { body } = await gapi.client.drive.files.get({
        fileId: profilesId,
        alt: 'media'
      });

      const downloaded = JSON.parse(body);

      profiles.update((prev) => {
        return {
          ...prev,
          ...downloaded
        };
      });

      progressTrackerStore.updateProcess(processId, {
        progress: 100,
        status: 'Download complete'
      });
      setTimeout(() => progressTrackerStore.removeProcess(processId), 3000);

      showSnackbar('Profiles downloaded');
    } catch (error) {
      progressTrackerStore.updateProcess(processId, {
        progress: 0,
        status: 'Download failed'
      });
      setTimeout(() => progressTrackerStore.removeProcess(processId), 3000);
      handleDriveError(error, 'downloading profiles');
    }
  }

  // Google Drive handlers
  async function handleGoogleDriveLogin() {
    googleDriveLoading = true;
    try {
      // Trigger OAuth flow (initialize and show OAuth popup)
      await signIn();

      // Hide spinner once popup appears - user is now interacting with Google's dialog
      googleDriveLoading = false;

      // Wait for authentication to complete by watching the accessToken store
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Login timeout'));
        }, 90000); // 90 second timeout for OAuth popup

        const unsubscribe = accessTokenStore.subscribe(token => {
          if (token) {
            clearTimeout(timeout);
            unsubscribe();
            resolve();
          }
        });
      });

      // Set as current provider (auto-logs out any other provider)
      const provider = providerManager.getProviderInstance('google-drive');
      if (provider) {
        await providerManager.setCurrentProvider(provider);
      }

      // After successful login, populate unified cache for placeholders
      showSnackbar('Connected to Google Drive - loading cloud data...');
      await unifiedCloudManager.fetchAllCloudVolumes();
      showSnackbar('Google Drive connected');

      // Automatically sync after login
      await handlePostLogin();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      showSnackbar(message);
    } finally {
      googleDriveLoading = false;
    }
  }

  // MEGA handlers
  async function handleMegaLogin() {
    megaLoading = true;
    try {
      await megaProvider.login({ email: megaEmail, password: megaPassword });

      // Set as current provider (auto-logs out any other provider)
      await providerManager.setCurrentProvider(megaProvider);

      // Populate unified cache for rest of app to use
      showSnackbar('Connected to MEGA - loading cloud data...');
      await unifiedCloudManager.fetchAllCloudVolumes();
      showSnackbar('MEGA connected');

      // Clear form and trigger reactivity
      megaEmail = '';
      megaPassword = '';

      // Automatically sync after login
      await handlePostLogin();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      showSnackbar(message);
    } finally {
      megaLoading = false;
    }
  }

  async function handleMegaLogout() {
    await megaProvider.logout();
    megaEmail = '';
    megaPassword = '';
    unifiedCloudManager.clearCache();
    providerManager.updateStatus();
    showSnackbar('Logged out of MEGA');
  }

  async function handleProviderSync() {
    try {
      // Use unified sync service - handles merge logic, deletion tracking, and tombstone purging
      await unifiedCloudManager.syncProgress();
      showSnackbar('Synced read progress');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      showSnackbar(`Sync failed: ${message}`);
    }
  }

  // WebDAV handlers
  async function handleWebDAVLogin() {
    webdavLoading = true;
    try {
      await webdavProvider.login({
        serverUrl: webdavUrl,
        username: webdavUsername,
        password: webdavPassword
      });

      // Set as current provider (auto-logs out any other provider)
      await providerManager.setCurrentProvider(webdavProvider);

      // Populate unified cache for rest of app to use
      showSnackbar('Connected to WebDAV - loading cloud data...');
      await unifiedCloudManager.fetchAllCloudVolumes();
      showSnackbar('WebDAV connected');

      // Clear form and trigger reactivity
      webdavUrl = '';
      webdavUsername = '';
      webdavPassword = '';

      // Automatically sync after login
      await handlePostLogin();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      showSnackbar(message);
    } finally {
      webdavLoading = false;
    }
  }

  async function handleWebDAVLogout() {
    await webdavProvider.logout();
    webdavUrl = '';
    webdavUsername = '';
    webdavPassword = '';
    unifiedCloudManager.clearCache();
    providerManager.updateStatus();
    showSnackbar('Logged out of WebDAV');
  }


  async function backupAllSeries() {
    // Get default provider
    const provider = unifiedCloudManager.getDefaultProvider();
    if (!provider) {
      showSnackbar('Please connect to a cloud storage provider first');
      return;
    }

    // Get all volumes from catalog
    const allVolumes: VolumeMetadata[] = [];
    for (const series of $catalog) {
      allVolumes.push(...series.volumes);
    }

    if (allVolumes.length === 0) {
      showSnackbar('No volumes to backup');
      return;
    }

    // Filter out already backed up volumes
    const volumesToBackup = allVolumes.filter(vol =>
      !unifiedCloudManager.existsInCloud(vol.series_title, vol.volume_title)
    );

    const skippedCount = allVolumes.length - volumesToBackup.length;

    if (volumesToBackup.length === 0) {
      showSnackbar('All volumes already backed up');
      return;
    }

    // Add all volumes to the backup queue
    backupQueue.queueSeriesVolumesForBackup(volumesToBackup, provider);

    // Show notification
    const message = skippedCount > 0
      ? `Added ${volumesToBackup.length} volumes to backup queue (${skippedCount} already backed up)`
      : `Added ${volumesToBackup.length} volumes to backup queue`;
    showSnackbar(message);
  }
</script>

<svelte:head>
  <title>Cloud</title>
</svelte:head>

<div class="p-2 h-[90svh]">
  {#if !hasAnyProvider}
    <!-- Provider Selection Screen (like sign-in options) -->
    <div class="flex justify-center pt-0 sm:pt-20">
      <div class="w-full max-w-md">
        <h2 class="text-2xl font-semibold text-center mb-8">Choose a Cloud Storage Provider</h2>

        <div class="flex flex-col gap-3">
          <!-- Google Drive Option -->
          <button
            class="w-full border rounded-lg border-slate-600 p-6 border-opacity-50 hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onclick={handleGoogleDriveLogin}
            disabled={googleDriveLoading}
          >
            <div class="flex items-center gap-4">
              {#if googleDriveLoading}
                <Spinner size="8" />
              {:else}
                <GoogleSolid size="xl" />
              {/if}
              <div class="text-left flex-1">
                <div class="font-semibold text-lg">Google Drive</div>
                <div class="text-sm text-gray-400">15GB free • Requires re-auth every hour</div>
              </div>
            </div>
          </button>

          <!-- MEGA Option -->
          <button
            class="w-full border rounded-lg border-slate-600 p-6 border-opacity-50 hover:bg-slate-800 transition-colors"
            onclick={() => {
              // Show MEGA login form
              const megaForm = document.getElementById('mega-login-form');
              if (megaForm) megaForm.classList.toggle('hidden');
            }}
          >
            <div class="flex items-center gap-4">
              <div class="w-8 h-8 flex items-center justify-center text-2xl">M</div>
              <div class="text-left flex-1">
                <div class="font-semibold text-lg">MEGA</div>
                <div class="text-sm text-gray-400">20GB free • Persistent login</div>
              </div>
            </div>
          </button>

          <div id="mega-login-form" class="hidden pl-12 pr-4 pb-4">
            <form
              onsubmit={(e) => {
                e.preventDefault();
                handleMegaLogin();
              }}
              class="flex flex-col gap-3"
            >
              <input
                type="email"
                bind:value={megaEmail}
                placeholder="Email"
                required
                class="bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 text-sm"
              />
              <input
                type="password"
                bind:value={megaPassword}
                placeholder="Password"
                required
                class="bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 text-sm"
              />
              <Button type="submit" disabled={megaLoading} color="blue" size="sm">
                {megaLoading ? 'Connecting...' : 'Connect to MEGA'}
              </Button>
            </form>
          </div>

          <!-- WebDAV Option -->
          <button
            class="w-full border rounded-lg border-slate-600 p-6 border-opacity-50 opacity-50 cursor-not-allowed"
            disabled
          >
            <div class="flex items-center gap-4">
              <div class="w-8 h-8 flex items-center justify-center text-2xl">W</div>
              <div class="text-left flex-1">
                <div class="flex items-center gap-2">
                  <div class="font-semibold text-lg">WebDAV</div>
                  <Badge color="yellow">Under Development</Badge>
                </div>
                <div class="text-sm text-gray-400">Nextcloud, ownCloud, NAS • Persistent login</div>
              </div>
            </div>
          </button>

          <div id="webdav-login-form" class="hidden pl-12 pr-4 pb-4">
            <form
              onsubmit={(e) => {
                e.preventDefault();
                handleWebDAVLogin();
              }}
              class="flex flex-col gap-3"
            >
              <input
                type="url"
                bind:value={webdavUrl}
                placeholder="Server URL (e.g., https://cloud.example.com/remote.php/dav)"
                required
                class="bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 text-sm"
              />
              <input
                type="text"
                bind:value={webdavUsername}
                placeholder="Username"
                required
                class="bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 text-sm"
              />
              <input
                type="password"
                bind:value={webdavPassword}
                placeholder="Password or App Token"
                required
                class="bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 text-sm"
              />
              <Button type="submit" disabled={webdavLoading} color="blue" size="sm">
                {webdavLoading ? 'Connecting...' : 'Connect to WebDAV'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <!-- Connected Provider Interface -->
    {#if googleDriveAuth}
      <!-- Google Drive Connected -->
      <div class="flex justify-between items-center gap-6 flex-col">
        <div class="flex justify-between items-center w-full max-w-3xl">
          <div class="flex items-center gap-3">
            <h2 class="text-3xl font-semibold text-center pt-2">Google Drive:</h2>
            {#if state.isCacheLoading && !state.isCacheLoaded}
              <Badge color="yellow">Loading Drive data...</Badge>
            {:else if state.isCacheLoaded}
              <Badge color="green">Connected</Badge>
            {/if}
          </div>
          <Button color="red" on:click={logout}>Log out</Button>
        </div>
      <p class="text-center">
        Add your zipped manga files (ZIP or CBZ) to the <span class="text-primary-700"
          >{READER_FOLDER}</span
        > folder in your Google Drive.
      </p>
      <p class="text-center text-sm text-gray-500">
        You can select multiple ZIP/CBZ files or entire folders at once.
      </p>
      <div class="flex flex-col gap-4 w-full max-w-3xl">
        <Button color="blue" on:click={createPicker}>Download Manga</Button>

        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-3">
            <Toggle bind:checked={$miscSettings.turboMode} on:change={() => updateMiscSetting('turboMode', $miscSettings.turboMode)}>
              Turbo Mode
            </Toggle>
          </div>
          <p class="text-xs text-gray-500">
            For users with fast internet and a lack of patience. Enables parallel downloads/uploads.
          </p>

          {#if $miscSettings.turboMode}
            <div class="flex flex-col gap-2 mt-2">
              <div class="text-sm font-medium">Device RAM Configuration</div>
              <div class="flex gap-4">
                <Radio name="ram-config" value={4} bind:group={$miscSettings.deviceRamGB} on:change={() => updateMiscSetting('deviceRamGB', 4)}>4GB</Radio>
                <Radio name="ram-config" value={8} bind:group={$miscSettings.deviceRamGB} on:change={() => updateMiscSetting('deviceRamGB', 8)}>8GB</Radio>
                <Radio name="ram-config" value={16} bind:group={$miscSettings.deviceRamGB} on:change={() => updateMiscSetting('deviceRamGB', 16)}>16GB</Radio>
                <Radio name="ram-config" value={32} bind:group={$miscSettings.deviceRamGB} on:change={() => updateMiscSetting('deviceRamGB', 32)}>32GB+</Radio>
              </div>
              <p class="text-xs text-gray-500">
                Configure your device's RAM to optimize parallel download performance and prevent memory issues.
              </p>
            </div>
          {/if}
        </div>

        <div class="flex-col gap-2 flex">
          <Button
            color="dark"
            on:click={performSync}
          >
            Sync read progress
          </Button>
        </div>

        <div class="flex-col gap-2 flex">
          <Button
            color="purple"
            on:click={() => promptConfirmation('Backup all series to cloud storage?', backupAllSeries)}
          >
            Backup all series to cloud
          </Button>
        </div>
        <div class="flex-col gap-2 flex">
          <Button
            color="dark"
            on:click={() => promptConfirmation('Upload profiles?', onUploadProfiles)}
          >
            Upload profiles
          </Button>
          {#if profilesId}
            <Button
              color="alternative"
              on:click={() =>
                promptConfirmation('Download and overwrite profiles?', onDownloadProfiles)}
            >
              Download profiles
            </Button>
          {/if}
        </div>
      </div>
    </div>
    {:else if megaAuth}
      <!-- MEGA Connected -->
      <div class="flex justify-center items-center flex-col gap-6">
        <div class="w-full max-w-3xl">
          <div class="flex justify-between items-center mb-6">
            <div class="flex items-center gap-3">
              <h2 class="text-3xl font-semibold">MEGA Cloud Storage</h2>
              <Badge color="green">Connected</Badge>
            </div>
            <Button color="red" on:click={handleMegaLogout}>Log out</Button>
          </div>

          <div class="flex flex-col gap-4">
            <p class="text-center text-gray-300 mb-2">
              Your read progress is synced with MEGA cloud storage.
            </p>

            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-3">
                <Toggle bind:checked={$miscSettings.turboMode} on:change={() => updateMiscSetting('turboMode', $miscSettings.turboMode)}>
                  Turbo Mode
                </Toggle>
              </div>
              <p class="text-xs text-gray-500">
                For users with fast internet and a lack of patience. Enables parallel downloads/uploads.
              </p>

              {#if $miscSettings.turboMode}
                <div class="flex flex-col gap-2 mt-2">
                  <div class="text-sm font-medium">Device RAM Configuration</div>
                  <div class="flex gap-4">
                    <Radio name="ram-config-mega" value={4} bind:group={$miscSettings.deviceRamGB} on:change={() => updateMiscSetting('deviceRamGB', 4)}>4GB</Radio>
                    <Radio name="ram-config-mega" value={8} bind:group={$miscSettings.deviceRamGB} on:change={() => updateMiscSetting('deviceRamGB', 8)}>8GB</Radio>
                    <Radio name="ram-config-mega" value={16} bind:group={$miscSettings.deviceRamGB} on:change={() => updateMiscSetting('deviceRamGB', 16)}>16GB</Radio>
                    <Radio name="ram-config-mega" value={32} bind:group={$miscSettings.deviceRamGB} on:change={() => updateMiscSetting('deviceRamGB', 32)}>32GB+</Radio>
                  </div>
                  <p class="text-xs text-gray-500">
                    Configure your device's RAM to optimize parallel download performance and prevent memory issues.
                  </p>
                </div>
              {/if}
            </div>

            <Button color="blue" on:click={handleProviderSync}>
              Sync read progress
            </Button>

            <Button
              color="purple"
              on:click={() => promptConfirmation('Backup all series to cloud storage?', backupAllSeries)}
            >
              Backup all series to cloud
            </Button>

            <div class="mt-4 p-4 bg-gray-800 rounded-lg">
              <h3 class="font-semibold mb-2">About MEGA</h3>
              <ul class="text-sm text-gray-300 space-y-1">
                <li>20GB free storage</li>
                <li>End-to-end encryption</li>
                <li>Persistent login (no re-authentication needed)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    {:else if webdavAuth}
      <!-- WebDAV Connected -->
      <div class="flex justify-center items-center flex-col gap-6">
        <div class="w-full max-w-3xl">
          <div class="flex justify-between items-center mb-6">
            <div class="flex items-center gap-3">
              <h2 class="text-3xl font-semibold">WebDAV Server</h2>
              <Badge color="green">Connected</Badge>
            </div>
            <Button color="red" on:click={handleWebDAVLogout}>Log out</Button>
          </div>

          <div class="flex flex-col gap-4">
            <p class="text-center text-gray-300 mb-2">
              Your read progress is synced with your WebDAV server.
            </p>

            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-3">
                <Toggle bind:checked={$miscSettings.turboMode} on:change={() => updateMiscSetting('turboMode', $miscSettings.turboMode)}>
                  Turbo Mode
                </Toggle>
              </div>
              <p class="text-xs text-gray-500">
                For users with fast internet and a lack of patience. Enables parallel downloads/uploads.
              </p>

              {#if $miscSettings.turboMode}
                <div class="flex flex-col gap-2 mt-2">
                  <div class="text-sm font-medium">Device RAM Configuration</div>
                  <div class="flex gap-4">
                    <Radio name="ram-config-webdav" value={4} bind:group={$miscSettings.deviceRamGB} on:change={() => updateMiscSetting('deviceRamGB', 4)}>4GB</Radio>
                    <Radio name="ram-config-webdav" value={8} bind:group={$miscSettings.deviceRamGB} on:change={() => updateMiscSetting('deviceRamGB', 8)}>8GB</Radio>
                    <Radio name="ram-config-webdav" value={16} bind:group={$miscSettings.deviceRamGB} on:change={() => updateMiscSetting('deviceRamGB', 16)}>16GB</Radio>
                    <Radio name="ram-config-webdav" value={32} bind:group={$miscSettings.deviceRamGB} on:change={() => updateMiscSetting('deviceRamGB', 32)}>32GB+</Radio>
                  </div>
                  <p class="text-xs text-gray-500">
                    Configure your device's RAM to optimize parallel download performance and prevent memory issues.
                  </p>
                </div>
              {/if}
            </div>

            <Button color="blue" on:click={handleProviderSync}>
              Sync read progress
            </Button>

            <Button
              color="purple"
              on:click={() => promptConfirmation('Backup all series to cloud storage?', backupAllSeries)}
            >
              Backup all series to cloud
            </Button>

            <div class="mt-4 p-4 bg-gray-800 rounded-lg">
              <h3 class="font-semibold mb-2">WebDAV Server</h3>
              <ul class="text-sm text-gray-300 space-y-1">
                <li>Compatible with Nextcloud, ownCloud, and NAS devices</li>
                <li>Persistent login (no re-authentication needed)</li>
                <li>Self-hosted and private</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>
