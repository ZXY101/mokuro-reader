<script lang="ts">
  import { Button, Spinner } from 'flowbite-svelte';
  import { CloudArrowUpOutline, CheckCircleSolid } from 'flowbite-svelte-icons';
  import { backupVolumeToDrive } from '$lib/util';
  import { showSnackbar } from '$lib/util';
  import { tokenManager, driveFilesCache } from '$lib/util/google-drive';
  import type { VolumeMetadata } from '$lib/types';
  import type { DriveFileMetadata } from '$lib/util/google-drive';

  interface Props {
    volume: VolumeMetadata;
    class?: string;
  }

  let { volume, class: className }: Props = $props();

  let isBackingUp = $state(false);
  let currentStep = $state('');

  let token = $state('');
  $effect(() => {
    return tokenManager.token.subscribe(value => {
      token = value;
    });
  });

  let isAuthenticated = $derived(token !== '');

  // Subscribe to Drive files cache
  let driveCache = $state<Map<string, DriveFileMetadata>>(new Map());
  $effect(() => {
    return driveFilesCache.store.subscribe(value => {
      driveCache = value;
    });
  });

  // Check if this volume exists in Drive (by parent/filename path)
  let expectedPath = $derived(`${volume.series_title}/${volume.volume_title}.cbz`);
  let isBackedUp = $derived.by(() => {
    const exists = driveCache.has(expectedPath);
    console.log(`Checking backup status for: ${expectedPath}, exists: ${exists}`);
    console.log('Cache keys:', Array.from(driveCache.keys()));
    return exists;
  });

  async function handleBackup(e: MouseEvent) {
    e.stopPropagation();

    if (!isAuthenticated) {
      showSnackbar('Please sign in to Google Drive first', 'error');
      return;
    }

    if (isBackedUp) {
      showSnackbar('Volume already backed up', 'info');
      return;
    }

    isBackingUp = true;
    try {
      await backupVolumeToDrive(volume, (step) => {
        currentStep = step;
      });
      showSnackbar('Backup completed successfully', 'success');
    } catch (error) {
      console.error('Backup failed:', error);
      showSnackbar(`Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      isBackingUp = false;
      currentStep = '';
    }
  }
</script>

<Button
  color={isBackedUp ? 'green' : 'light'}
  size="xs"
  class={className}
  disabled={isBackingUp || !isAuthenticated || isBackedUp}
  on:click={handleBackup}
  title={isBackedUp ? 'Already backed up to Drive' : 'Backup to Google Drive'}
>
  {#if isBackingUp}
    <Spinner size="4" class="me-2" />
    {currentStep || 'Backing up...'}
  {:else if isBackedUp}
    <CheckCircleSolid class="w-4 h-4 me-2" />
    Backed up
  {:else}
    <CloudArrowUpOutline class="w-4 h-4 me-2" />
    Backup to Drive
  {/if}
</Button>
