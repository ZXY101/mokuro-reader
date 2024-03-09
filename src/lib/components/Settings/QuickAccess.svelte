<script lang="ts">
  import { toggleFullScreen } from '$lib/panzoom';
  import { isReader } from '$lib/util';

  import { Button } from 'flowbite-svelte';

  export let hidden = false;

  function onClose() {
    hidden = true;
    history.back();
  }
</script>

{#if isReader()}
  <div class="flex flex-col gap-2">
    <Button color="alternative" on:click={toggleFullScreen}>Toggle fullscreen</Button>
    <Button color="alternative" on:click={onClose}>Close reader</Button>
  </div>
{/if}
