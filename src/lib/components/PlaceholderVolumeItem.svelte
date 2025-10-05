<script lang="ts">
  import type { VolumeMetadata } from '$lib/types';
  import { Frame, ListgroupItem, Button, Spinner } from 'flowbite-svelte';
  import { DownloadSolid, TrashBinSolid } from 'flowbite-svelte-icons';
  import { downloadVolumeFromDrive } from '$lib/util/download-from-drive';
  import { progressTrackerStore } from '$lib/util/progress-tracker';
  import { driveApiClient } from '$lib/util/google-drive/api-client';
  import { driveFilesCache } from '$lib/util/google-drive/drive-files-cache';
  import { showSnackbar, promptConfirmation } from '$lib/util';

  interface Props {
    volume: VolumeMetadata;
  }

  let { volume }: Props = $props();

  const volName = decodeURI(volume.volume_title);

  // Format file size
  let sizeDisplay = $derived.by(() => {
    if (!volume.driveSize) return 'Unknown size';
    const mb = (volume.driveSize / (1024 * 1024)).toFixed(1);
    return `${mb} MB`;
  });

  // Track download state from progress tracker
  let progressState = $state($progressTrackerStore);
  $effect(() => {
    return progressTrackerStore.subscribe(value => {
      progressState = value;
    });
  });

  let processId = $derived(`download-${volume.driveFileId}`);
  let downloadProcess = $derived.by(() => {
    return progressState.processes.find(p => p.id === processId);
  });

  let isDownloading = $derived(!!downloadProcess);
  let downloadProgress = $derived(downloadProcess?.progress || 0);
  let downloadStatus = $derived(downloadProcess?.status || '');

  async function onDownloadClicked(e: Event) {
    e.stopPropagation();

    try {
      await downloadVolumeFromDrive(volume);
    } catch (error) {
      console.error('Download failed:', error);
    }
  }

  async function onDeleteClicked(e: Event) {
    e.stopPropagation();

    promptConfirmation(
      `Delete ${volName} from Google Drive?`,
      async () => {
        try {
          if (!volume.driveFileId) {
            throw new Error('No Drive file ID');
          }

          await driveApiClient.trashFile(volume.driveFileId);
          driveFilesCache.removeDriveFileById(volume.driveFileId);
          showSnackbar(`Deleted ${volName} from Drive`, 'success');
        } catch (error) {
          console.error('Failed to delete from Drive:', error);
          showSnackbar(`Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
      }
    );
  }
</script>

<Frame rounded border class="divide-y divide-gray-200 dark:divide-gray-600">
  <ListgroupItem normalClass="py-4 opacity-70">
    <DownloadSolid class="w-[50px] h-[70px] text-blue-400 mr-3" />
    <div class="flex flex-row gap-5 items-center justify-between w-full">
      <div>
        <p class="font-semibold text-gray-400">{volName}</p>
        <p class="text-sm text-gray-500">In Drive • {sizeDisplay}</p>
      </div>
      <div class="flex gap-2 items-center">
        {#if isDownloading}
          <Button color="light" disabled={true}>
            <Spinner size="4" class="me-2" />
            {downloadProgress}%
          </Button>
        {:else}
          <Button color="blue" onclick={onDownloadClicked}>
            <DownloadSolid class="w-4 h-4 me-2" />
            Download
          </Button>
          <Button color="red" onclick={onDeleteClicked}>
            <TrashBinSolid class="w-4 h-4 me-2" />
            Delete from Drive
          </Button>
        {/if}
      </div>
    </div>
  </ListgroupItem>
</Frame>
