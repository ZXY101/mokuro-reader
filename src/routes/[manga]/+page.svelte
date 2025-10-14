<script lang="ts">
  import { catalog } from '$lib/catalog';
  import { goto } from '$app/navigation';
  import VolumeItem from '$lib/components/VolumeItem.svelte';
  import PlaceholderVolumeItem from '$lib/components/PlaceholderVolumeItem.svelte';
  import BackupButton from '$lib/components/BackupButton.svelte';
  import { Button, Listgroup, Spinner } from 'flowbite-svelte';
  import { db } from '$lib/catalog/db';
  import { promptConfirmation, zipManga, showSnackbar } from '$lib/util';
  import { promptExtraction } from '$lib/util/modals';
  import { progressTrackerStore } from '$lib/util/progress-tracker';
  import { page } from '$app/stores';
  import type { VolumeMetadata } from '$lib/types';
  import { deleteVolume, mangaStats } from '$lib/settings';
  import { driveState, driveFilesCache } from '$lib/util/google-drive';
  import type { DriveState } from '$lib/util/google-drive';
  import { CloudArrowUpOutline, TrashBinSolid, DownloadSolid } from 'flowbite-svelte-icons';
  import { downloadSeriesFromDrive } from '$lib/util/download-from-drive';
  import { backupQueue } from '$lib/util/backup-queue';
  import { unifiedCloudManager } from '$lib/util/sync/unified-cloud-manager';
  import { providerManager } from '$lib/util/sync';

  function sortManga(a: VolumeMetadata, b: VolumeMetadata) {
    return a.volume_title.localeCompare(b.volume_title, undefined, {
      numeric: true,
      sensitivity: 'base'
    });
  }

  let allVolumes = $derived(
    $catalog?.find((item) => item.series_uuid === $page.params.manga)?.volumes.sort(sortManga)
  );

  // Separate real volumes from placeholders
  let manga = $derived(allVolumes?.filter(v => !v.isPlaceholder) || []);
  let placeholders = $derived(allVolumes?.filter(v => v.isPlaceholder) || []);

  let loading = $state(false);

  let state = $state<DriveState>({
    isAuthenticated: false,
    isCacheLoading: false,
    isCacheLoaded: false,
    isFullyConnected: false,
    needsAttention: false
  });
  $effect(() => {
    return driveState.subscribe(value => {
      state = value;
    });
  });

  // Check if all volumes in series are backed up (using unified cloud manager)
  let driveCache = $state(new Map());
  $effect(() => {
    return driveFilesCache.store.subscribe(value => {
      driveCache = value;
    });
  });

  // Subscribe to unified cloud cache updates
  let cloudFiles = $state<Map<string, any[]>>(new Map());
  let cacheHasLoaded = $state(false);
  let wasFetching = $state(false);

  $effect(() => {
    return unifiedCloudManager.cloudFiles.subscribe(value => {
      console.log('[Series Page] Cloud files updated:', value.size, 'series');
      cloudFiles = value;
      // If we get files and weren't fetching, cache must already be loaded
      if (value.size > 0 && !wasFetching) {
        cacheHasLoaded = true;
        console.log('[Series Page] Cache already loaded (has files)');
      }
    });
  });

  // Track when fetching completes to know when cache is loaded
  $effect(() => {
    return unifiedCloudManager.isFetching.subscribe(isFetching => {
      console.log('[Series Page] isFetching:', isFetching, 'wasFetching:', wasFetching);
      // Mark cache as loaded when fetching transitions from true to false
      if (wasFetching && !isFetching) {
        cacheHasLoaded = true;
        console.log('[Series Page] Cache has loaded (fetch complete)');
      }
      wasFetching = isFetching;
      // Also mark as loaded if not fetching and we have files
      if (!isFetching && cloudFiles.size > 0) {
        cacheHasLoaded = true;
        console.log('[Series Page] Cache already loaded (not fetching + has files)');
      }
    });
  });

  // Subscribe to provider manager status for reactive authentication state
  let providerStatus = $state({ hasAnyAuthenticated: false, providers: {}, needsAttention: false });
  $effect(() => {
    return providerManager.status.subscribe(value => {
      console.log('[Series Page] Provider status updated:', value.hasAnyAuthenticated, value);
      providerStatus = value;
      // Reset cache loaded state when provider changes
      if (!value.hasAnyAuthenticated) {
        cacheHasLoaded = false;
        wasFetching = false;
      }
    });
  });
  let hasAnyProvider = $derived(providerStatus.hasAnyAuthenticated);
  let isCloudReady = $derived(hasAnyProvider && cacheHasLoaded);

  // Debug logging for reactive values
  $effect(() => {
    console.log('[Series Page] Reactive values - hasAnyProvider:', hasAnyProvider, 'allBackedUp:', allBackedUp, 'anyBackedUp:', anyBackedUp);
  });

  // Use $effect to manually compute these values when cloudFiles changes
  let allBackedUp = $state(false);
  let anyBackedUp = $state(false);

  $effect(() => {
    // This effect runs whenever cloudFiles changes
    if (!manga || manga.length === 0) {
      allBackedUp = false;
      anyBackedUp = false;
      return;
    }

    // Efficient O(1) lookup: Get series files from Map by series title
    const seriesTitle = manga[0].series_title;
    const seriesFiles = cloudFiles.get(seriesTitle) || [];

    allBackedUp = manga.every(vol => {
      const path = `${vol.series_title}/${vol.volume_title}.cbz`;
      return seriesFiles.some(f => f.path === path);
    });

    anyBackedUp = manga.some(vol => {
      const path = `${vol.series_title}/${vol.volume_title}.cbz`;
      return seriesFiles.some(f => f.path === path);
    });

    console.log('[Series Page] Backup status computed - allBackedUp:', allBackedUp, 'anyBackedUp:', anyBackedUp, 'seriesFiles:', seriesFiles.length);
  });

  async function confirmDelete(deleteStats = false, deleteDrive = false) {
    const seriesUuid = manga?.[0].series_uuid;
    if (seriesUuid) {
      manga?.forEach((vol) => {
        const volId = vol.volume_uuid;
        db.volumes_data.where('volume_uuid').equals(vol.volume_uuid).delete();
        db.volumes.where('volume_uuid').equals(vol.volume_uuid).delete();

        // Only delete stats and progress if the checkbox is checked
        if (deleteStats) {
          deleteVolume(volId);
        }
      });

      // Delete from Drive if checkbox checked
      if (deleteDrive && isAuthenticated && manga) {
        await deleteSeriesFromDrive(manga);
      }

      goto('/');
    }
  }

  async function deleteSeriesFromDrive(volumes: VolumeMetadata[]) {
    if (!volumes || volumes.length === 0) return;

    const seriesTitle = volumes[0].series_title;

    // Check if any volumes are backed up (efficient O(1) Map lookup)
    const backedUpVolumes = cloudFiles.get(seriesTitle) || [];

    if (backedUpVolumes.length === 0) {
      showSnackbar('No volumes found in cloud', 'info');
      return;
    }

    try {
      // Use the new deleteSeriesFolder method which deletes the entire folder
      // The unified manager automatically updates its cache, so no need to fetch again
      const result = await unifiedCloudManager.deleteSeriesFolder(seriesTitle);

      if (result.failed === 0) {
        showSnackbar(`Deleted ${result.succeeded} volume(s) from cloud`, 'success');
      } else {
        showSnackbar(`Deleted ${result.succeeded} volume(s), ${result.failed} failed`, 'error');
      }
    } catch (error) {
      console.error('Failed to delete series from cloud:', error);
      showSnackbar('Failed to delete from cloud', 'error');
      // Refresh cache to restore correct state on error
      await unifiedCloudManager.fetchAllCloudVolumes();
    }
  }

  async function onDeleteFromDrive() {
    if (!manga || manga.length === 0) return;

    // Check if any provider is authenticated
    if (!hasAnyProvider) {
      showSnackbar('Please connect to a cloud storage provider first', 'error');
      return;
    }

    if (!anyBackedUp) {
      showSnackbar('No backups found in cloud', 'info');
      return;
    }

    promptConfirmation(
      `Delete ${manga[0].series_title} from cloud storage?`,
      async () => {
        await deleteSeriesFromDrive(manga);
      }
    );
  }

  function onDelete() {
    const hasDriveBackups = manga?.some(vol =>
      driveCache.has(`${vol.series_title}/${vol.volume_title}.cbz`)
    );

    promptConfirmation(
      'Are you sure you want to delete this manga?',
      confirmDelete,
      undefined,
      {
        label: "Also delete stats and progress?",
        storageKey: "deleteStatsPreference",
        defaultValue: false
      },
      hasDriveBackups ? {
        label: "Also delete from Google Drive?",
        storageKey: "deleteDrivePreference",
        defaultValue: false
      } : undefined
    );
  }

  async function onExtract() {
    if (manga && manga.length > 0) {
      const firstVolume = {
        series_title: manga[0].series_title,
        volume_title: manga[0].volume_title
      };

      promptExtraction(firstVolume, async (asCbz, individualVolumes, includeSeriesTitle) => {
        loading = true;
        loading = await zipManga(manga, asCbz, individualVolumes, includeSeriesTitle);
      });
    }
  }

  async function backupSeries() {
    if (!manga || manga.length === 0) return;

    // Check if any provider is authenticated
    const provider = unifiedCloudManager.getDefaultProvider();
    if (!provider) {
      showSnackbar('Please connect to a cloud storage provider first', 'error');
      return;
    }

    // Filter out already backed up volumes using unified cloud manager
    const volumesToBackup = manga.filter(vol =>
      !unifiedCloudManager.existsInCloud(vol.series_title, vol.volume_title)
    );

    if (volumesToBackup.length === 0) {
      showSnackbar('All volumes already backed up', 'info');
      return;
    }

    // Add volumes to backup queue
    backupQueue.queueSeriesVolumesForBackup(volumesToBackup, provider.type);

    showSnackbar(`Added ${volumesToBackup.length} volume(s) to backup queue`, 'success');
  }

  async function downloadAllPlaceholders() {
    if (!placeholders || placeholders.length === 0) return;

    // Check if any cloud provider is authenticated
    if (!hasAnyProvider) {
      showSnackbar('Please sign in to a cloud storage provider first', 'error');
      return;
    }

    try {
      // Use the download queue to handle placeholders
      const { queueSeriesVolumes } = await import('$lib/util/download-queue');
      queueSeriesVolumes(placeholders);
    } catch (error) {
      console.error('Failed to download placeholders:', error);
    }
  }

  // Detect duplicate Drive files - multiple Drive files with same path
  // Looks directly at Drive cache, independent of local download status
  let duplicateDriveFiles = $derived.by(() => {
    if (!manga || manga.length === 0) return [];

    // Get all Drive files for this series from cache (regardless of local state)
    const seriesTitle = manga[0].series_title;
    const driveFilesForSeries = driveFilesCache.getDriveFilesBySeries(seriesTitle);

    // Group Drive files by path
    const pathGroups = new Map<string, typeof driveFilesForSeries>();
    for (const driveFile of driveFilesForSeries) {
      const existing = pathGroups.get(driveFile.path);
      if (existing) {
        existing.push(driveFile);
      } else {
        pathGroups.set(driveFile.path, [driveFile]);
      }
    }

    // Collect all duplicate files (keep most recent, mark others for deletion)
    const duplicates: typeof driveFilesForSeries = [];
    for (const files of pathGroups.values()) {
      if (files.length > 1) {
        // Sort by modified time, keep most recent
        files.sort((a, b) => {
          const timeA = new Date(a.modifiedTime).getTime();
          const timeB = new Date(b.modifiedTime).getTime();
          return timeB - timeA; // Most recent first
        });

        // Add all but the first (most recent) to duplicates list
        for (let i = 1; i < files.length; i++) {
          duplicates.push(files[i]);
        }
      }
    }

    return duplicates;
  });

  let hasDuplicates = $derived(duplicateDriveFiles.length > 0);

  async function cleanDriveDuplicates() {
    if (!state.isAuthenticated) {
      showSnackbar('Please sign in to Google Drive first', 'error');
      return;
    }

    if (duplicateDriveFiles.length === 0) {
      showSnackbar('No duplicate Drive files found', 'info');
      return;
    }

    promptConfirmation(
      `Remove ${duplicateDriveFiles.length} duplicates from Drive?\n\nWe'll keep one copy of each volume and remove the duplicates.`,
      async () => {
        let successCount = 0;
        let failCount = 0;

        for (const duplicate of duplicateDriveFiles) {
          try {
            await driveApiClient.trashFile(duplicate.fileId);
            driveFilesCache.removeDriveFileById(duplicate.fileId);
            successCount++;
          } catch (error) {
            console.error(`Failed to delete ${duplicate.name}:`, error);
            failCount++;
          }
        }

        if (failCount === 0) {
          showSnackbar(`Cleaned up ${successCount} duplicate(s)`, 'success');
        } else {
          showSnackbar(`Cleaned up ${successCount}, ${failCount} failed`, 'error');
        }
      }
    );
  }
</script>

<svelte:head>
  <title>{manga?.[0]?.series_title || 'Manga'}</title>
</svelte:head>
{#if !$catalog || $catalog.length === 0}
  <div class="flex justify-center items-center p-16">
    <Spinner size="12" />
  </div>
{:else if manga && manga.length > 0 && $mangaStats}
  <div class="p-2 flex flex-col gap-5">
    <div class="flex flex-row justify-between">
      <div class="flex flex-col gap-2">
        <h3 class="font-bold">{manga[0].series_title}</h3>
        <div class="flex flex-col gap-0 sm:flex-row sm:gap-5">
          <p>Volumes: {$mangaStats.completed} / {manga.length}</p>
          <p>Characters read: {$mangaStats.chars}</p>
          <p>Minutes read: {$mangaStats.timeReadInMinutes}</p>
        </div>
      </div>
      <div class="flex flex-row gap-2 items-start">
        <!-- Debug: hasAnyProvider={hasAnyProvider}, cacheHasLoaded={cacheHasLoaded}, isCloudReady={isCloudReady}, allBackedUp={allBackedUp}, anyBackedUp={anyBackedUp} -->
        {#if isCloudReady}
          {#if !allBackedUp}
            <Button
              color="light"
              on:click={backupSeries}
            >
              <CloudArrowUpOutline class="w-4 h-4 me-2" />
              {anyBackedUp ? 'Backup remaining volumes' : 'Backup series to cloud'}
            </Button>
          {/if}
          {#if anyBackedUp}
            <Button
              color="red"
              on:click={onDeleteFromDrive}
            >
              <TrashBinSolid class="w-4 h-4 me-2" />
              Delete series from cloud
            </Button>
          {/if}
        {/if}
        <Button color="alternative" on:click={onDelete}>Remove manga</Button>
        <Button color="light" on:click={onExtract} disabled={loading}>
          {loading ? 'Extracting...' : 'Extract manga'}
        </Button>
      </div>
    </div>
    <Listgroup active class="flex-1 h-full w-full">
      {#if hasDuplicates && state.isAuthenticated}
        <div class="mb-4 flex items-center justify-between px-4 py-2 bg-red-50 dark:bg-red-900/20 rounded">
          <h4 class="text-sm font-semibold text-red-600 dark:text-red-400">Duplicates found in Drive ({duplicateDriveFiles.length})</h4>
          <Button size="xs" color="red" on:click={cleanDriveDuplicates}>
            <TrashBinSolid class="w-3 h-3 me-1" />
            Clean Duplicates
          </Button>
        </div>
      {/if}

      {#each manga as volume (volume.volume_uuid)}
        <VolumeItem {volume} />
      {/each}

      {#if placeholders && placeholders.length > 0}
        <div class="mt-4 mb-2 flex items-center justify-between px-4">
          <h4 class="text-sm font-semibold text-gray-400">Available in Cloud ({placeholders.length})</h4>
          {#if hasAnyProvider}
            <Button size="xs" color="blue" on:click={downloadAllPlaceholders}>
              <DownloadSolid class="w-3 h-3 me-1" />
              Download all
            </Button>
          {/if}
        </div>
        {#each placeholders as placeholder (placeholder.volume_uuid)}
          <PlaceholderVolumeItem volume={placeholder} />
        {/each}
      {/if}
    </Listgroup>
  </div>
{:else}
  <div class="flex justify-center p-16">Manga not found</div>
{/if}
