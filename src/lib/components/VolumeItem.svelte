<script lang="ts">
  import { page } from '$app/stores';
  import { deleteVolume, progress } from '$lib/settings';
  import type { VolumeEntry } from '$lib/types';
  import { promptConfirmation } from '$lib/util';
  import { ListgroupItem, Frame } from 'flowbite-svelte';
  import { CheckCircleSolid, TrashBinSolid } from 'flowbite-svelte-icons';
  import { goto } from '$app/navigation';
  import { db } from '$lib/catalog/db';

  export let volume: VolumeEntry;

  const volName = decodeURI(volume.volume);

  $: currentPage = $progress?.[volume.volume_uuid || 0] || 1;
  $: progressDisplay = `${
    currentPage === volume.pages.length - 1 ? currentPage + 1 : currentPage
  } / ${volume.pages.length}`;
  $: isComplete =
    currentPage === volume.pages.length ||
    currentPage === volume.pages.length - 1;

  async function onDeleteClicked(e: Event) {
    e.stopPropagation();

    promptConfirmation(`Delete ${volName}?`, async () => {
      await db.volumes.where('volume_uuid').equals(volume.volume_uuid).delete();
      deleteVolume(volume.volume_uuid);

      // Check if this was the last volume for this title
      const remainingVolumes = await db.volumes
        .where('title_uuid')
        .equals(volume.title_uuid)
        .count();

      if (remainingVolumes > 0) {
        goto(`/${$page.params.manga}`);
      } else {
        goto('/');
      }
    });
  }
</script>

{#if $page.params.manga}
  <Frame rounded border class="divide-y divide-gray-200 dark:divide-gray-600">
    <ListgroupItem
      on:click={() => goto(`/${$page.params.manga}/${volume_uuid}`)}
      normalClass="py-4"
    >
      <div
        class:text-green-400={isComplete}
        class="flex flex-row gap-5 items-center justify-between w-full"
      >
        <div>
          <p class="font-semibold" class:text-white={!isComplete}>{volName}</p>
          <p>{progressDisplay}</p>
        </div>
        <div class="flex gap-2">
          <TrashBinSolid
            class="text-red-400 hover:text-red-500 z-10 poin"
            on:click={onDeleteClicked}
          />
          {#if isComplete}
            <CheckCircleSolid />
          {/if}
        </div>
      </div>
    </ListgroupItem>
  </Frame>
{/if}
