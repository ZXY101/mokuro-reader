<script lang="ts">
  import { catalog } from '$lib/catalog';
  import { goto } from '$app/navigation';
  import VolumeItem from '$lib/components/VolumeItem.svelte';
  import BackupButton from '$lib/components/BackupButton.svelte';
  import { Button, Listgroup, Spinner } from 'flowbite-svelte';
  import { db } from '$lib/catalog/db';
  import { promptConfirmation, zipManga, showSnackbar, backupVolumeToDrive } from '$lib/util';
  import { promptExtraction } from '$lib/util/modals';
  import { page } from '$app/stores';
  import type { VolumeMetadata } from '$lib/types';
  import { deleteVolume, mangaStats } from '$lib/settings';
  import { tokenManager, driveFilesCache } from '$lib/util/google-drive';
  import { CloudArrowUpOutline } from 'flowbite-svelte-icons';

  function sortManga(a: VolumeMetadata, b: VolumeMetadata) {
    return a.volume_title.localeCompare(b.volume_title, undefined, {
      numeric: true,
      sensitivity: 'base'
    });
  }

  let manga = $derived(
    $catalog?.find((item) => item.series_uuid === $page.params.manga)?.volumes.sort(sortManga)
  );

  let loading = $state(false);
  let backingUpSeries = $state(false);
  let backupProgress = $state('');

  let token = $state('');
  $effect(() => {
    return tokenManager.token.subscribe(value => {
      token = value;
    });
  });

  let isAuthenticated = $derived(token !== '');

  // Check if all volumes in series are backed up
  let driveCache = $state(new Map());
  $effect(() => {
    return driveFilesCache.store.subscribe(value => {
      driveCache = value;
    });
  });

  let allBackedUp = $derived.by(() => {
    if (!manga || manga.length === 0) return false;
    return manga.every(vol => driveCache.has(`${vol.series_title}/${vol.volume_title}.cbz`));
  });

  async function confirmDelete(deleteStats = false) {
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
      goto('/');
    }
  }

  function onDelete() {
    promptConfirmation(
      'Are you sure you want to delete this manga?', 
      confirmDelete, 
      undefined, 
      {
        label: "Also delete stats and progress?",
        storageKey: "deleteStatsPreference",
        defaultValue: false
      }
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
    if (!isAuthenticated) {
      showSnackbar('Please sign in to Google Drive first', 'error');
      return;
    }

    backingUpSeries = true;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < manga.length; i++) {
      const volume = manga[i];
      backupProgress = `Backing up ${i + 1}/${manga.length}: ${volume.volume_title}`;

      try {
        await backupVolumeToDrive(volume);
        successCount++;
      } catch (error) {
        console.error(`Failed to backup ${volume.volume_title}:`, error);
        failCount++;
      }
    }

    backingUpSeries = false;
    backupProgress = '';

    if (failCount === 0) {
      showSnackbar(`Successfully backed up all ${successCount} volumes`, 'success');
    } else {
      showSnackbar(`Backed up ${successCount} volumes, ${failCount} failed`, 'error');
    }
  }
</script>

<svelte:head>
  <title>{manga?.[0].series_title || 'Manga'}</title>
</svelte:head>
{#if manga && $mangaStats}
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
      <div class="sm:block flex-col flex gap-2">
        <Button
          color={allBackedUp ? 'green' : 'light'}
          on:click={backupSeries}
          disabled={backingUpSeries || !isAuthenticated}
        >
          {#if backingUpSeries}
            <Spinner size="4" class="me-2" />
            {backupProgress}
          {:else if allBackedUp}
            <CloudArrowUpOutline class="w-4 h-4 me-2" />
            Series backed up
          {:else}
            <CloudArrowUpOutline class="w-4 h-4 me-2" />
            Backup series to Drive
          {/if}
        </Button>
        <Button color="alternative" on:click={onDelete}>Remove manga</Button>
        <Button color="light" on:click={onExtract} disabled={loading}>
          {loading ? 'Extracting...' : 'Extract manga'}
        </Button>
      </div>
    </div>
    <Listgroup active class="flex-1 h-full w-full">
      {#each manga as volume (volume.volume_uuid)}
        <VolumeItem {volume} />
      {/each}
    </Listgroup>
  </div>
{:else}
  <div class="flex justify-center p-16">Manga not found</div>
{/if}
