<script lang="ts">
  import { Button, Spinner } from 'flowbite-svelte';
  import { CloudArrowUpOutline, TrashBinSolid } from 'flowbite-svelte-icons';
  import { backupVolumeToCloud } from '$lib/util/backup';
  import { showSnackbar } from '$lib/util';
  import { unifiedCloudManager } from '$lib/util/sync/unified-cloud-manager';
  import type { VolumeMetadata } from '$lib/types';
  import type { ProviderType } from '$lib/util/sync/provider-interface';
  import type { CloudVolumeWithProvider } from '$lib/util/sync/unified-cloud-manager';

  interface Props {
    volume: VolumeMetadata;
    class?: string;
  }

  let { volume, class: className }: Props = $props();

  let isBackingUp = $state(false);
  let currentStep = $state('');

  // Subscribe to unified cloud files
  let cloudFiles = $state<CloudVolumeWithProvider[]>([]);
  let isFetching = $state(false);

  $effect(() => {
    const unsubscribers = [
      unifiedCloudManager.cloudFiles.subscribe(value => { cloudFiles = value; }),
      unifiedCloudManager.isFetching.subscribe(value => { isFetching = value; })
    ];
    return () => unsubscribers.forEach(unsub => unsub());
  });

  // Check if this volume exists in any cloud provider
  let cloudFile = $derived(
    unifiedCloudManager.getCloudFile(volume.series_title, volume.volume_title)
  );
  let isBackedUp = $derived(cloudFile !== undefined);
  let backupProvider = $derived(cloudFile?.provider);

  // Get default provider for backup
  function getDefaultProvider(): ProviderType | null {
    const provider = unifiedCloudManager.getDefaultProvider();
    return provider ? provider.type : null;
  }

  // Check if any provider is authenticated
  let hasAuthenticatedProvider = $derived(getDefaultProvider() !== null);

  async function handleBackup(e: MouseEvent) {
    e.stopPropagation();

    const provider = getDefaultProvider();
    if (!provider) {
      showSnackbar('Please connect to a cloud storage provider first', 'error');
      return;
    }

    if (isBackedUp) {
      showSnackbar('Volume already backed up', 'info');
      return;
    }

    isBackingUp = true;
    try {
      await backupVolumeToCloud(volume, provider, (step) => {
        currentStep = step;
      });
      showSnackbar('Backup completed successfully', 'success');

      // Refresh cloud files to show the new backup
      await unifiedCloudManager.fetchAllCloudVolumes();
    } catch (error) {
      console.error('Backup failed:', error);
      showSnackbar(`Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      isBackingUp = false;
      currentStep = '';
    }
  }

  async function handleDelete(e: MouseEvent) {
    e.stopPropagation();

    if (!cloudFile) {
      showSnackbar('Volume not backed up', 'info');
      return;
    }

    try {
      await unifiedCloudManager.deleteVolumeCbz(cloudFile.fileId);
      showSnackbar(`Deleted from ${cloudFile.provider}`, 'success');
    } catch (error) {
      console.error('Delete failed:', error);
      showSnackbar(`Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }

  // Provider display names
  function getProviderDisplayName(provider: ProviderType): string {
    switch (provider) {
      case 'google-drive':
        return 'Drive';
      case 'mega':
        return 'MEGA';
      case 'webdav':
        return 'WebDAV';
      default:
        return 'Cloud';
    }
  }
</script>

{#if !hasAuthenticatedProvider}
  <!-- Don't render anything when not authenticated -->
{:else if isFetching && cloudFiles.length === 0}
  <Button
    color="light"
    size="xs"
    class={className}
    disabled={true}
    title="Loading cloud status..."
  >
    <Spinner size="4" class="me-2" />
    Loading...
  </Button>
{:else if isBackedUp}
  <Button
    color="red"
    size="xs"
    class={className}
    on:click={handleDelete}
    title={`Delete from ${backupProvider ? getProviderDisplayName(backupProvider) : 'cloud'}`}
  >
    <TrashBinSolid class="w-4 h-4 me-2" />
    Delete from {backupProvider ? getProviderDisplayName(backupProvider) : 'cloud'}
  </Button>
{:else}
  <Button
    color="light"
    size="xs"
    class={className}
    disabled={isBackingUp}
    on:click={handleBackup}
    title="Backup to cloud storage"
  >
    {#if isBackingUp}
      <Spinner size="4" class="me-2" />
      {currentStep || 'Backing up...'}
    {:else}
      <CloudArrowUpOutline class="w-4 h-4 me-2" />
      Backup to Cloud
    {/if}
  </Button>
{/if}
