<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { progress } from '$lib/settings';
  import type { Volume } from '$lib/types';
  import { ListgroupItem } from 'flowbite-svelte';
  import type { ListGroupItemType } from 'flowbite-svelte/dist/types';

  export let item: string | ListGroupItemType;
  const volume = item as Volume;

  const { volumeName, mokuroData } = volume as Volume;

  function onClick() {
    goto(`${$page.params.manga}/${mokuroData.volume_uuid}`);
  }

  $: currentPage = $progress?.[volume?.mokuroData.volume_uuid || 0] || 1;

  $: progressDisplay = `${currentPage} / ${volume.mokuroData.pages.length}`;
</script>

<a href={`${$page.params.manga}/${mokuroData.volume_uuid}`} class="h-full w-full">
  <ListgroupItem>
    <div>
      <h3 class="font-semibold">{volumeName}</h3>
      <p>{progressDisplay}</p>
    </div>
  </ListgroupItem>
</a>
