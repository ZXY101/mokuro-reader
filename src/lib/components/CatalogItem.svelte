<script lang="ts">
  import { currentManga } from '$lib/catalog';
  import type { Volume } from '$lib/types';
  export let manga: Volume[];
  const { volumeName, files, mokuroData } = manga[0];

  function onClick() {
    currentManga.set(manga);
  }
</script>

<a href={volumeName} on:click={onClick}>
  <div class="flex flex-col gap-[5px] text-center items-center">
    {mokuroData.title}
    {#if files}
      <img
        src={URL.createObjectURL(Object.values(files)[0])}
        alt="img"
        class="object-contain w-[250px] h-[350px] bg-black border-gray-900 border"
      />
    {/if}
  </div>
</a>
