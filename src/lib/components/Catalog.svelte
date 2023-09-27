<script lang="ts">
  import { catalog } from '$lib/catalog';
  import CatalogItem from './CatalogItem.svelte';
</script>

{#if $catalog}
  {#if $catalog.length > 0}
    <div class="flex flex-col gap-5">
      <div class="flex sm:flex-row flex-col gap-5 flex-wrap justify-center sm:justify-start">
        {#each $catalog as { id } (id)}
          <CatalogItem {id} />
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
