<script lang="ts">
  import { page } from '$app/stores';
  import { progress } from '$lib/settings';
  import type { Volume } from '$lib/types';
  import { ListgroupItem } from 'flowbite-svelte';
  import { CheckCircleSolid } from 'flowbite-svelte-icons';
  import type { ListGroupItemType } from 'flowbite-svelte/dist/types';

  export let item: string | ListGroupItemType;
  const volume = item as Volume;

  const { volumeName, mokuroData } = volume as Volume;

  $: currentPage = $progress?.[volume?.mokuroData.volume_uuid || 0] || 1;
  $: progressDisplay = `${currentPage} / ${volume.mokuroData.pages.length}`;
  $: isComplete = currentPage === volume.mokuroData.pages.length;
</script>

{#if $page.params.manga}
  <a
    data-sveltekit-replacestate
    href={`/${$page.params.manga}/${mokuroData.volume_uuid}`}
    class="h-full w-full"
  >
    <ListgroupItem>
      <div
        class:text-green-400={isComplete}
        class="flex flex-row gap-5 items-center justify-between w-full"
      >
        <div>
          <p class="font-semibold" class:text-white={!isComplete}>{decodeURI(volumeName)}</p>
          <p>{progressDisplay}</p>
        </div>
        {#if isComplete}
          <CheckCircleSolid />
        {/if}
      </div>
    </ListgroupItem>
  </a>
{/if}
