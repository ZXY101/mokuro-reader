<script lang="ts">
  import { Button, Modal, Toggle } from 'flowbite-svelte';
  import { extractionModalStore } from '$lib/util/modals';
  import { onMount } from 'svelte';

  let open = false;
  let asCbz = true;
  let individualVolumes = false;

  onMount(() => {
    extractionModalStore.subscribe((value) => {
      if (value) {
        open = value.open;
      }
    });
  });

  function handleExtract() {
    if ($extractionModalStore?.onConfirm) {
      $extractionModalStore.onConfirm(asCbz, individualVolumes);
    }
    open = false;
  }

  function handleCancel() {
    if ($extractionModalStore?.onCancel) {
      $extractionModalStore.onCancel();
    }
    open = false;
  }
</script>

<Modal bind:open size="sm" autoclose outsideclose>
  <div class="text-center">
    <h3 class="mb-5 text-lg font-normal text-gray-700 dark:text-gray-300">
      Extract Options
    </h3>
    <div class="flex flex-col gap-4 mb-5">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Extract as CBZ</span>
        <Toggle bind:checked={asCbz} />
      </div>
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Extract individual volumes</span>
        <Toggle bind:checked={individualVolumes} />
      </div>
    </div>
    <div class="flex justify-center gap-2">
      <Button color="blue" on:click={handleExtract}>Extract</Button>
      <Button color="alternative" on:click={handleCancel}>Cancel</Button>
    </div>
  </div>
</Modal>