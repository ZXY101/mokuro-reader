<script lang="ts">
  import { confirmationPopupStore } from '$lib/util';
  import { Button, Modal, Checkbox } from 'flowbite-svelte';
  import { ExclamationCircleOutline } from 'flowbite-svelte-icons';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  let open = $state(false);
  let deleteStats = $state(false);

  // Load the user's previous selection from localStorage
  onMount(() => {
    if (browser) {
      const savedPreference = localStorage.getItem('deleteStatsPreference');
      if (savedPreference !== null) {
        deleteStats = savedPreference === 'true';
      }
    }

    confirmationPopupStore.subscribe((value) => {
      if (value) {
        open = value.open;
      }
    });
  });

  function handleConfirm() {
    // Save the user's preference
    if (browser) {
      localStorage.setItem('deleteStatsPreference', deleteStats.toString());
    }
    
    if ($confirmationPopupStore?.onConfirm) {
      $confirmationPopupStore.onConfirm(deleteStats);
    }
  }
</script>

<Modal bind:open size="xs" autoclose outsideclose>
  <div class="text-center">
    <ExclamationCircleOutline class="mx-auto mb-4 text-gray-400 w-12 h-12 dark:text-gray-200" />
    <h3 class="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
      {$confirmationPopupStore?.message}
    </h3>
    {#if $confirmationPopupStore?.showStatsOption}
      <div class="flex items-center justify-center mb-4">
        <Checkbox bind:checked={deleteStats} id="delete-stats" />
        <label for="delete-stats" class="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400">
          Also delete stats and progress?
        </label>
      </div>
    {/if}
    <Button color="red" class="mr-2" on:click={handleConfirm}>Yes</Button>
    <Button color="alternative" on:click={$confirmationPopupStore?.onCancel}>No</Button>
  </div>
</Modal>
