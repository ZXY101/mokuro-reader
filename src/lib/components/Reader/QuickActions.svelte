<script lang="ts">
  import { zoomFitToScreen } from '$lib/panzoom';
  import { SpeedDial, SpeedDialButton } from 'flowbite-svelte';
  import { settings } from '$lib/settings';
  import {
    ArrowLeftOutline,
    ArrowRightOutline,
    ImageOutline,
    ZoomOutOutline
  } from 'flowbite-svelte-icons';
  import { imageToWebp, showCropper, updateLastCard } from '$lib/anki-connect';
  import { promptConfirmation } from '$lib/util';

  export let left: (_e: any, ingoreTimeOut?: boolean) => void;
  export let right: (_e: any, ingoreTimeOut?: boolean) => void;
  export let src: File;

  let open = false;

  function handleZoom() {
    zoomFitToScreen();
    open = false;
  }

  function handleLeft(_e: Event) {
    left(_e, true);
    open = false;
  }

  function handleRight(_e: Event) {
    right(_e, true);
    open = false;
  }

  async function onUpdateCard() {
    if ($settings.ankiConnectSettings.enabled) {
      if ($settings.ankiConnectSettings.cropImage) {
        showCropper(URL.createObjectURL(src));
      } else {
        promptConfirmation('Add image to last created anki card?', async () => {
          const imageData = await imageToWebp(src);
          updateLastCard(imageData);
        });
      }
    }
    open = false;
  }
</script>

{#if $settings.quickActions}
  <SpeedDial
    tooltip="none"
    trigger="click"
    defaultClass="absolute end-3 bottom-3 z-50"
    outline
    color="dark"
    bind:open
  >
    {#if $settings.ankiConnectSettings.enabled}
      <SpeedDialButton on:click={onUpdateCard}>
        <ImageOutline />
      </SpeedDialButton>
    {/if}
    <SpeedDialButton on:click={handleZoom}>
      <ZoomOutOutline />
    </SpeedDialButton>
    <SpeedDialButton on:click={handleRight}>
      <ArrowRightOutline />
    </SpeedDialButton>
    <SpeedDialButton on:click={handleLeft}>
      <ArrowLeftOutline />
    </SpeedDialButton>
  </SpeedDial>
{/if}
