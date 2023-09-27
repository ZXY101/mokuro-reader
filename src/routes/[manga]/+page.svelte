<script lang="ts">
  import { catalog } from '$lib/catalog';
  import { goto } from '$app/navigation';
  import VolumeItem from '$lib/components/VolumeItem.svelte';
  import { Button, Listgroup } from 'flowbite-svelte';
  import { db } from '$lib/catalog/db';
  import { promptConfirmation } from '$lib/util';
  import { page } from '$app/stores';
  import type { Volume } from '$lib/types';
  import { onMount } from 'svelte';

  function sortManga(a: Volume, b: Volume) {
    if (a.volumeName < b.volumeName) {
      return -1;
    }
    if (a.volumeName > b.volumeName) {
      return 1;
    }
    return 0;
  }

  $: manga = $catalog?.find((item) => item.id === $page.params.manga)?.manga.sort(sortManga);

  async function confirmDelete() {
    const title = manga?.[0].mokuroData.title_uuid;
    await db.catalog.delete(title);
    goto('/');
  }

  function onDelete() {
    promptConfirmation('Are you sure you want to delete this manga?', confirmDelete);
  }
</script>

<svelte:head>
  <title>{manga?.[0].mokuroData.title || 'Manga'}</title>
</svelte:head>
{#if manga}
  <div class="p-2 flex flex-col gap-5">
    <div class="flex flex-row justify-between">
      <div class="flex flex-col">
        <h3 class="font-bold">{manga[0].mokuroData.title}</h3>
        <p>Volumes: {manga.length}</p>
      </div>
      <div><Button color="alternative" on:click={onDelete}>Remove manga</Button></div>
    </div>
    <Listgroup items={manga} let:item active class="flex-1 h-full w-full">
      <VolumeItem {item} />
    </Listgroup>
  </div>
{:else}
  <div class="flex justify-center p-16">Manga not found</div>
{/if}
