<script lang="ts">
  import { page } from '$app/stores';
  import Reader from '$lib/components/Reader/Reader.svelte';
  import Timer from '$lib/components/Reader/Timer.svelte';
  import { initializeVolume, settings, startCount, volumeSettings, volumes } from '$lib/settings';
  import { onMount } from 'svelte';

  const volumeId = $page.params.volume;
  let count: undefined | number = undefined;
  let inactiveTimer: undefined | number = undefined;
  let inactive = false;

  onMount(() => {
    if (!$volumes?.[volumeId]) {
      initializeVolume(volumeId);
    }

    count = startCount(volumeId);

    return () => {
      clearInterval(count);
      count = undefined;
    };
  });

  function onBlur() {
    // This is an attempt to pause the timer when the page loses focus, but
    // keep it going if focus is given to an extension such as yomitan
    if (
      document.activeElement?.innerHTML.includes('moz-extension') ||
      !Boolean(document.activeElement?.innerHTML)
    ) {
      return;
    }

    clearInterval(count);
    count = undefined;
  }

  function onFocus() {
    count = startCount(volumeId);
  }

  function resetInactiveTimer() {
    if (inactive && !count) {
      count = startCount(volumeId);
    }

    clearTimeout(inactiveTimer);
    inactive = false;

    inactiveTimer = setTimeout(() => {
      clearInterval(count);
      count = undefined;
      inactive = true;
    }, 15 * 1000);
  }
</script>

<svelte:window
  on:blur={onBlur}
  on:focus={onFocus}
  on:load={resetInactiveTimer}
  on:mousemove={resetInactiveTimer}
  on:keydown={resetInactiveTimer}
/>

{#if $volumeSettings[volumeId]}
  {#if $settings.showTimer}
    <Timer active={Boolean(count)} />
  {/if}
  <Reader volumeSettings={$volumeSettings[volumeId]} />
{/if}
