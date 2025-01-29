<script lang="ts">
  import { volumes } from '$lib/catalog';
  import { ListgroupItem } from 'flowbite-svelte';

  export let id: string;

  $: firstVolume = $volumes?.find((item) => item.title_uuid === id);
</script>

{#if firstVolume}
  <div>
    <ListgroupItem>
      <a href={id} class="h-full w-full">
        <div class="flex justify-between items-center">
          <p class="font-semibold text-white">{firstVolume.title}</p>
          {#if firstVolume.thumbnail}
            <img
              src={URL.createObjectURL(firstVolume.thumbnail)}
              alt="img"
              class="object-contain w-[50px] h-[70px] bg-black border-gray-900 border"
            />
          {:else if firstVolume.files}
            <img
              src={URL.createObjectURL(Object.values(firstVolume.files)[0])}
              alt="img"
              class="object-contain w-[50px] h-[70px] bg-black border-gray-900 border"
            />
          {/if}
        </div>
      </a>
    </ListgroupItem>
  </div>
{/if}
