<script lang="ts">
  import { page } from '$app/stores';
  import Reader from '$lib/components/Reader/Reader.svelte';
  import { initializeVolume, volumes } from '$lib/settings';
  import { onMount } from 'svelte';

  onMount(() => {
    const volumeId = $page.params.volume;

    if (!$volumes?.[volumeId]) {
      initializeVolume(volumeId);
    }
  });
</script>

<Reader />
