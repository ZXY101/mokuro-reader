<script lang="ts">
  import { currentManga } from '$lib/catalog';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import VolumeItem from '$lib/components/VolumeItem.svelte';
  import { Button } from 'flowbite-svelte';
  import { db } from '$lib/catalog/db';
  import { promptConfirmation } from '$lib/util';

  const manga = $currentManga?.sort((a, b) => {
    if (a.volumeName < b.volumeName) {
      return -1;
    }
    if (a.volumeName > b.volumeName) {
      return 1;
    }
    return 0;
  });

  onMount(() => {
    if (!manga) {
      goto('/');
    }
  });

  async function confirmDelete() {
    const title = manga?.[0].mokuroData.title_uuid;
    await db.catalog.delete(title);
    goto('/');
  }

  function onDelete() {
    promptConfirmation('Are you sure you want to delete this manga?', confirmDelete);
  }
</script>

<div class="p-2 flex flex-col gap-5">
  <div class="sm:block flex-col flex">
    <Button outline color="red" class="float-right" on:click={onDelete}>Delete manga</Button>
  </div>
  <div class="flex flex-row gap-5 flex-wrap">
    {#if manga}
      {#each manga as volume}
        <VolumeItem {volume} />
      {/each}
    {/if}
  </div>
</div>
