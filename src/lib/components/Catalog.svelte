<script lang="ts">
  import { catalog } from '$lib/catalog';
  import { Button } from 'flowbite-svelte';
  import CatalogItem from './CatalogItem.svelte';
  import { promptConfirmation } from '$lib/util';
  import { db } from '$lib/catalog/db';

  function onClear() {
    promptConfirmation('Are you sure you want to clear your catalog?', () => db.catalog.clear());
  }
</script>

{#if $catalog}
  {#if $catalog.length > 0}
    <div class="flex flex-col gap-5">
      <div class="sm:block flex-col flex">
        <Button outline color="red" class="float-right" on:click={onClear}>Clear catalog</Button>
      </div>
      <div class="flex flex-row gap-5 flex-wrap">
        {#each $catalog as { id, manga } (id)}
          <CatalogItem {manga} />
        {/each}
      </div>
    </div>
  {:else}
    <div class="text-center p-20">
      <p>Your catalog is currently empty.</p>
    </div>
  {/if}
{:else}
  <p>Loading...</p>
{/if}
