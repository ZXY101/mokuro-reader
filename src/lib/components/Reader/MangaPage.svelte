<script lang="ts">
  import type { Page } from '$lib/types';
  import { onMount } from 'svelte';
  import TextBoxes from './TextBoxes.svelte';
  import { zoomDefault } from '$lib/panzoom';

  export let page: Page;
  export let src: File;

  $: url = src ? `url(${URL.createObjectURL(src)})` : '';

  onMount(() => {
    zoomDefault();
  });
</script>

<div
  draggable="false"
  style:width={`${page.img_width}px`}
  style:height={`${page.img_height}px`}
  style:background-image={url}
  class="relative"
>
  <TextBoxes {page} {src} />
</div>
