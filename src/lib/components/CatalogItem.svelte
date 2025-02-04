<script lang="ts">
  import { volumes } from '$lib/catalog';

  export let series_uuid: string;

  $: firstVolume = Object.values($volumes).sort((a,b) => a.volume_title.localeCompare(b.volume_title) ).find((item) => item.series_uuid === series_uuid);
</script>

{#if firstVolume}
  <a href={series_uuid}>
    <div
      class="flex flex-col gap-[5px] text-center items-center bg-slate-900 pb-1 bg-opacity-50 border border-slate-950"
    >
      {#if firstVolume.thumbnail}
        <img
          src={URL.createObjectURL(firstVolume.thumbnail)}
          alt="img"
          class="object-contain sm:w-[250px] sm:h-[350px] bg-black border-gray-900 border"
        />
      {/if}
      <p class="font-semibold sm:w-[250px] line-clamp-1">
        {firstVolume.series_title}
      </p>
    </div>
  </a>
{/if}
