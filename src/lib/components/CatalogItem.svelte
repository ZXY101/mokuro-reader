<script lang="ts">
  import { volumes } from '$lib/catalog';

  export let id: string;

  $: firstVolume = $volumes?.find((item) => item.title_uuid === id);
</script>

{#if firstVolume}
  <a href={id}>
    <div
      class="flex flex-col gap-[5px] text-center items-center bg-slate-900 pb-1 bg-opacity-50 border border-slate-950"
    >
      {#if firstVolume.thumbnail}
        <img
          src={URL.createObjectURL(firstVolume.thumbnail)}
          alt="img"
          class="object-contain sm:w-[250px] sm:h-[350px] bg-black border-gray-900 border"
        />
      {:else if firstVolume.files}
        <img
          src={URL.createObjectURL(Object.values(firstVolume.files)[0])}
          alt="img"
          class="object-contain sm:w-[250px] sm:h-[350px] bg-black border-gray-900 border"
        />
      {/if}
      <p class="font-semibold sm:w-[250px] line-clamp-1">
        {firstVolume.title}
      </p>
    </div>
  </a>
{/if}
