<script lang="ts">
  import Catalog from '$lib/components/Catalog.svelte';
  import { createProfile, deleteProfile } from '$lib/settings';
</script>

<svelte:head>
  <title>Mokuro</title>
</svelte:head>

<div class="p-2 h-[90svh]">
  <Catalog />
</div>
