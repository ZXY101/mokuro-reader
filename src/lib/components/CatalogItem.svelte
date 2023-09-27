<script lang="ts">
  import { catalog } from '$lib/catalog';

  export let id: string;

  $: manga = $catalog?.find((item) => item.id === id)?.manga[0];
</script>

{#if manga}
  <a href={id}>
    <div class="flex flex-col gap-[5px] text-center items-center">
      {manga.mokuroData.title}
      {#if manga.files}
        <img
          src={URL.createObjectURL(Object.values(manga.files)[0])}
          alt="img"
          class="object-contain w-[250px] h-[350px] bg-black border-gray-900 border"
        />
      {/if}
    </div>
  </a>
{/if}
