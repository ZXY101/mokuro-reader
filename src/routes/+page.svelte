<script lang="ts">
  import { onMount } from 'svelte';
  import Catalog from '$lib/components/Catalog.svelte';
  import { enrichAllOrphanedVolumes } from '$lib/settings/volume-data';

  onMount(() => {
    // Enrich orphaned volumes when catalog loads
    // This happens after users upload volumes
    enrichAllOrphanedVolumes();
  });
</script>

<svelte:head>
  <title>Mokuro</title>
</svelte:head>

<div class="p-2 h-[90svh]">
  <Catalog />
</div>
