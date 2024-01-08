<script lang="ts">
  import { catalog } from '$lib/catalog';
  import { Button, Search } from 'flowbite-svelte';
  import CatalogItem from './CatalogItem.svelte';
  import Loader from './Loader.svelte';
  import { GridOutline, SortOutline } from 'flowbite-svelte-icons';

  $: sortedCatalog = $catalog
    ?.sort((a, b) => a.manga[0].mokuroData.title.localeCompare(b.manga[0].mokuroData.title))
    .filter((item) => {
      return item.manga[0].mokuroData.title.toLowerCase().indexOf(search.toLowerCase()) !== -1;
    });

  let search = '';
</script>

{#if $catalog}
  {#if $catalog.length > 0}
    <div class="flex flex-col gap-5">
      <div class="flex gap-1 py-2">
        <Search bind:value={search} />
        <!-- <Button size="sm" color="alternative"><GridOutline /></Button>
        <Button size="sm" color="alternative"><SortOutline /></Button> -->
      </div>
      {#if search && sortedCatalog.length === 0}
        <div class="text-center p-20">
          <p>No results found.</p>
        </div>
      {:else}
        <div class="flex sm:flex-row flex-col gap-5 flex-wrap justify-center sm:justify-start">
          {#each sortedCatalog as { id } (id)}
            <CatalogItem {id} />
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <div class="text-center p-20">
      <p>Your catalog is currently empty.</p>
    </div>
  {/if}
{:else}
  <Loader>Fetching catalog...</Loader>
{/if}
