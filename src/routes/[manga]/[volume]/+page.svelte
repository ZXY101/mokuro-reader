<script lang="ts">
  import { page } from '$app/stores';
  import Reader from '$lib/components/Reader/Reader.svelte';
  import Timer from '$lib/components/Reader/Timer.svelte';
  import {
    effectiveVolumeSettings,
    initializeVolume,
    settings,
    startCount,
    volumes
  } from '$lib/settings';
  import { onMount } from 'svelte';
  import { activityTracker } from '$lib/util/activity-tracker';
  import { Spinner } from 'flowbite-svelte';

  let volumeId = $derived($page.params.volume);
  let count: undefined | number = $state(undefined);

  onMount(() => {
    if (!$volumes?.[volumeId]) {
      initializeVolume(volumeId);
    }

    // Auto-start timer when volume opens (user intends to read)
    count = startCount(volumeId);
    // Record initial activity to start the inactivity timeout
    activityTracker.recordActivity();

    return () => {
      if (count) {
        clearInterval(count);
        count = undefined;
      }
    };
  });
</script>

{#if $effectiveVolumeSettings[volumeId]}
  {#if $settings.showTimer}
    <Timer bind:count {volumeId} />
  {/if}
  {#key volumeId}
    <Reader volumeSettings={$effectiveVolumeSettings[volumeId]} />
  {/key}
{:else}
  <div class="flex items-center justify-center w-screen h-screen">
    <Spinner size="12" />
  </div>
{/if}
