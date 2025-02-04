<script lang="ts">
  import { volumes } from '$lib/catalog';
  import { ListgroupItem } from 'flowbite-svelte';

  export let series_uuid: string;

  $: firstVolume = Object.values($volumes).sort((a,b) => a.volume_title.localeCompare(b.volume_title) ).find((item) => item.series_uuid === series_uuid);
</script>

{#if firstVolume}
  <div>
    <ListgroupItem>
      <a href={series_uuid} class="h-full w-full">
        <div class="flex justify-between items-center">
          <p class="font-semibold text-white">{firstVolume.series_title}</p>
          {#if firstVolume.thumbnail}
            <img
              src={URL.createObjectURL(firstVolume.thumbnail)}
              alt="img"
              class="object-contain w-[50px] h-[70px] bg-black border-gray-900 border"
            />
          {/if}
        </div>
      </a>
    </ListgroupItem>
  </div>
{/if}
