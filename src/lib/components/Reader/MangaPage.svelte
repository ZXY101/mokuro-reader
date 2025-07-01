<script lang="ts">
  import type { Page } from '$lib/types';
  import { afterUpdate, onMount, onDestroy } from 'svelte';
  import TextBoxes from './TextBoxes.svelte';
  import { zoomDefault } from '$lib/panzoom';

  type FileWithBlob = File & { blob?: string };

  export let page: Page;
  export let src: FileWithBlob;
  let url: string = '';

  // $: url = src ? `url(${URL.createObjectURL(src)})` : '';
  $: {
      if (src) {
          src.blob = src.blob || URL.createObjectURL(src);
          url = `url(${src.blob})`;
      } else {
          url = '';
      }
  }
  let legacy: HTMLElement | null;

  onMount(() => {
    legacy = document.getElementById('popupAbout');
    zoomDefault();

    return () => {
      setTimeout(() => {
        zoomDefault();
      }, 10);
    };
  });

  $: {
    if (legacy) {
      legacy.style.backgroundImage = url;
    }
  }

  afterUpdate(() => {
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
