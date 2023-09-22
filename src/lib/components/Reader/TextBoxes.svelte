<script lang="ts">
  import { clamp, showSnackbar } from '$lib/util';
  import type { Page } from '$lib/types';
  import { settings } from '$lib/settings';
  import { CirclePlusSolid } from 'flowbite-svelte-icons';
  import { getLastCardInfo } from '$lib/anki-connect';

  export let page: Page;

  $: textBoxes = page.blocks.map((block) => {
    const { img_height, img_width } = page;
    const { box, font_size, lines, vertical } = block;

    let [_xmin, _ymin, _xmax, _ymax] = box;

    const xmin = clamp(_xmin, 0, img_width);
    const ymin = clamp(_ymin, 0, img_height);
    const xmax = clamp(_xmax, 0, img_width);
    const ymax = clamp(_ymax, 0, img_height);

    const width = xmax - xmin;
    const height = ymax - ymin;

    const textBox = {
      left: `${xmin}px`,
      top: `${ymin}px`,
      width: `${width}px`,
      height: `${height}px`,
      fontSize: $settings.fontSize === 'auto' ? `${font_size}px` : `${$settings.fontSize}pt`,
      writingMode: vertical ? 'vertical-rl' : 'horizontal-tb',
      lines
    };

    return textBox;
  });

  $: fontWeight = $settings.boldFont ? 'bold' : '400';
  $: display = $settings.displayOCR ? 'block' : 'none';
  $: border = $settings.textBoxBorders ? '1px solid red' : 'none';
  $: contenteditable = $settings.textEditable;

  async function onUpdateCard() {
    const res = await getLastCardInfo();

    showSnackbar(res.fields.Word.value);
  }
</script>

{#each textBoxes as { fontSize, height, left, lines, top, width, writingMode }, index (`text-box-${index}`)}
  <div
    class="text-box"
    style:width
    style:height
    style:left
    style:top
    style:font-size={fontSize}
    style:writing-mode={writingMode}
    style:font-weight={fontWeight}
    style:display
    style:border
    {contenteditable}
  >
    {#if $settings.ankiConnectSettings.enabled}
      <button class="absolute -m-8 opacity-0 hover:block p-4" on:click={onUpdateCard}>
        <CirclePlusSolid class="text-primary-500 hover:text-primary-600" />
      </button>
    {/if}
    {#each lines as line}
      <p>{line}</p>
    {/each}
  </div>
{/each}

<style>
  .text-box {
    color: black;
    padding: 0;
    position: absolute;
    line-height: 1.1em;
    font-size: 16pt;
    white-space: nowrap;
    border: 1px solid rgba(0, 0, 0, 0);
    z-index: 1000;
  }

  .text-box:focus,
  .text-box:hover {
    background: rgb(255, 255, 255);
    border: 1px solid rgba(0, 0, 0, 0);
    z-index: 999 !important;
  }

  .text-box p {
    display: none;
    white-space: nowrap;
    letter-spacing: 0.1em;
    line-height: 1.1em;
    margin: 0;
    background-color: rgb(255, 255, 255);
    font-weight: var(--bold);
  }

  .text-box:hover button {
    opacity: 100;
  }

  .text-box:focus p,
  .text-box:hover p {
    display: table;
  }
</style>
