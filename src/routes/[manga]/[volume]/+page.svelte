<script lang="ts">
  import { page } from '$app/stores';
  import Reader from '$lib/components/Reader/Reader.svelte';
  import { initializeVolume, startCount, volumeSettings, volumes } from '$lib/settings';
  import { onMount } from 'svelte';

  const volumeId = $page.params.volume;

  onMount(() => {
    if (!$volumes?.[volumeId]) {
      initializeVolume(volumeId);
    }

    const count = startCount(volumeId);

    return () => {
      clearInterval(count);
    };
  });
</script>

{#if $volumeSettings[volumeId]}
  <Reader volumeSettings={$volumeSettings[volumeId]} />
{/if}
