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

  // Initialize volume when volumeId changes (reactive to navigation)
  $effect(() => {
    if (!$volumes?.[volumeId]) {
      initializeVolume(volumeId);
    }
  });

  // Start/restart timer when volumeId changes
  $effect(() => {
    // Record activity when volume changes
    activityTracker.recordActivity();

    // Start timer for this volume
    count = startCount(volumeId);

    // Cleanup: clear the interval when volumeId changes or component unmounts
    return () => {
      if (count) {
        clearInterval(count);
        count = undefined;
      }
    };
  });

  onMount(() => {
    // Set up activity tracker timeout
    activityTracker.setTimeoutDuration($settings.inactivityTimeoutMinutes);

    return () => {
      // Stop activity tracker when component unmounts
      activityTracker.stop();
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
