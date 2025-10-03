<script lang="ts">
  import { Button, Spinner } from 'flowbite-svelte';
  import { CloudArrowUpOutline } from 'flowbite-svelte-icons';
  import { backupVolumeToDrive } from '$lib/util';
  import { showSnackbar } from '$lib/util';
  import { tokenManager } from '$lib/util/google-drive';
  import type { VolumeMetadata } from '$lib/types';

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

  async function handleBackup() {
    if (!isAuthenticated) {
      showSnackbar('Please sign in to Google Drive first', 'error');
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
  color="light"
  size="xs"
  class={className}
  disabled={isBackingUp || !isAuthenticated}
  on:click={handleBackup}
>
  {#if isBackingUp}
    <Spinner size="4" class="me-2" />
    {currentStep || 'Backing up...'}
  {:else}
    <CloudArrowUpOutline class="w-4 h-4 me-2" />
    Backup to Drive
  {/if}
</Button>
