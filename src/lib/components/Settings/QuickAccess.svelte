<script lang="ts">
  import { toggleFullScreen } from '$lib/panzoom';
  import { isReader } from '$lib/util';

  import { Button } from 'flowbite-svelte';
</script>

{#if isReader()}
  <div class="flex flex-col gap-2">
    <Button color="alternative" on:click={toggleFullScreen}>Toggle fullscreen</Button>
    <Button color="alternative" on:click={() => history.back()}>Close reader</Button>
  </div>
{/if}
