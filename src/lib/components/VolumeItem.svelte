<script lang="ts">
  import { page } from '$app/stores';
  import { currentVolume } from '$lib/catalog';
  import type { Volume } from '$lib/types';

  export let volume: Volume;
  const { volumeName, files } = volume;

  function onClick() {
    currentVolume.set(volume);
  }
</script>

<a href={`${$page.params.manga}/${volumeName}`} on:click={onClick}>
  <div class="flex flex-col gap-[5px] text-center">
    {volumeName}
    {#if files}
      <img
        src={URL.createObjectURL(Object.values(files)[0])}
        alt="img"
        class="object-contain w-[250px] h-[350px] bg-black border-gray-900 border"
      />
    {/if}
  </div>
</a>
