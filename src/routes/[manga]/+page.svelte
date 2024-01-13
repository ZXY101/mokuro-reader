<script lang="ts">
  import { catalog } from '$lib/catalog';
  import { goto } from '$app/navigation';
  import VolumeItem from '$lib/components/VolumeItem.svelte';
  import { Button, Listgroup } from 'flowbite-svelte';
  import { db } from '$lib/catalog/db';
  import { promptConfirmation, zipManga } from '$lib/util';
  import { page } from '$app/stores';
  import type { Volume } from '$lib/types';
  import { deleteVolume, volumes } from '$lib/settings';

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

  $: stats = manga
    ?.map((vol) => vol.mokuroData.volume_uuid)
    ?.reduce(
      (stats: any, volumeId) => {
        const timeReadInMinutes = $volumes[volumeId]?.timeReadInMinutes || 0;
        const chars = $volumes[volumeId]?.chars || 0;
        const completed = $volumes[volumeId]?.completed || 0;

        stats.timeReadInMinutes = stats.timeReadInMinutes + timeReadInMinutes;
        stats.chars = stats.chars + chars;
        stats.completed = stats.completed + completed;

        return stats;
      },
      { timeReadInMinutes: 0, chars: 0, completed: 0 }
    );

  $: loading = false;

  async function confirmDelete() {
    const title = manga?.[0].mokuroData.title_uuid;
    manga?.forEach((vol) => {
      const volId = vol.mokuroData.volume_uuid;
      deleteVolume(volId);
    });

    await db.catalog.delete(title);
    goto('/');
  }

  function onDelete() {
    promptConfirmation('Are you sure you want to delete this manga?', confirmDelete);
  }

  async function onExtract() {
    if (manga) {
      loading = true;
      loading = await zipManga(manga);
    }
  }
</script>

<svelte:head>
  <title>{manga?.[0].mokuroData.title || 'Manga'}</title>
</svelte:head>
{#if manga}
  <div class="p-2 flex flex-col gap-5">
    <div class="flex flex-row justify-between">
      <div class="flex flex-col gap-2">
        <h3 class="font-bold">{manga[0].mokuroData.title}</h3>
        <div class="flex flex-col gap-0 sm:flex-row sm:gap-5">
          <p>Volumes: {stats.completed} / {manga.length}</p>
          <p>Characters read: {stats.chars}</p>
          <p>Minutes read: {stats.timeReadInMinutes}</p>
        </div>
      </div>
      <div class="sm:block flex-col flex gap-2">
        <Button color="alternative" on:click={onDelete}>Remove manga</Button>
        <Button color="light" on:click={onExtract} disabled={loading}>
          {loading ? 'Extracting...' : 'Extract manga'}
        </Button>
      </div>
    </div>
    <Listgroup items={manga} let:item active class="flex-1 h-full w-full">
      <VolumeItem {item} />
    </Listgroup>
  </div>
{:else}
  <div class="flex justify-center p-16">Manga not found</div>
{/if}
