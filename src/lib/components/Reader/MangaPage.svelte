<script lang="ts">
  import type { Page } from '$lib/types';
  import { onMount } from 'svelte';
  import TextBoxes from './TextBoxes.svelte';
  import { zoomDefault } from '$lib/panzoom';

  interface Props {
    page: Page;
    src: File;
    volumeUuid: string;
  }

  let { page, src, volumeUuid }: Props = $props();

  let url = $state('');

  // Track blob URL and clean up properly to prevent memory leaks
  $effect(() => {
    let currentBlobUrl: string | null = null;

    // Create new blob URL
    if (src) {
      currentBlobUrl = URL.createObjectURL(src);
      url = `url(${currentBlobUrl})`;
    } else {
      url = '';
    }

    // Cleanup function runs on effect re-run or component unmount
    return () => {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  });

  onMount(() => {
    zoomDefault();

    return () => {
      // Small delay to ensure smooth transition
      setTimeout(() => {
        zoomDefault();
      }, 10);
    };
  });
</script>

<div
  draggable="false"
  style:width={`${page.img_width}px`}
  style:height={`${page.img_height}px`}
  style:background-image={url}
  class="relative"
>
  <TextBoxes {page} {src} {volumeUuid} />
</div>
