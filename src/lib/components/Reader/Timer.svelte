<script lang="ts">
  import { startCount, volumeStats } from '$lib/settings';
  import { activityTracker } from '$lib/util/activity-tracker';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';

  interface Props {
    count: number | undefined;
    volumeId: string;
  }

  let { count = $bindable(), volumeId }: Props = $props();

  let active = $derived(Boolean(count));

  function startTimer() {
    if (!count) {
      count = startCount(volumeId);
    }
  }

  function stopTimer() {
    if (count) {
      clearInterval(count);
      count = undefined;
    }
  }

  function onClick() {
    if (count) {
      stopTimer();
      // Reset activity tracker so next activity can restart timer
      activityTracker.stop();
    } else {
      startTimer();
      // Record activity to start the inactivity timeout
      activityTracker.recordActivity();
    }
  }

  onMount(() => {
    // Initialize activity tracker callbacks
    activityTracker.initialize({
      onActive: () => {
        startTimer();
      },
      onInactive: () => {
        stopTimer();
      }
    });

    // If user is already active when Timer mounts (e.g., from volume navigation),
    // start the timer immediately to avoid the race condition where recordActivity()
    // was called before callbacks were initialized
    if (get(activityTracker.active)) {
      startTimer();
    }

    return () => {
      stopTimer();
    };
  });
</script>

<button
  class:text-primary-700={!active}
  class="mix-blend-difference z-10 fixed opacity-50 right-20 top-5 p-10 m-[-2.5rem]"
  onclick={onClick}
>
  {#key $volumeStats?.timeReadInMinutes}
    <p>
      {active ? 'Active' : 'Paused'} | Minutes read: {$volumeStats?.timeReadInMinutes}
    </p>
  {/key}
</button>
