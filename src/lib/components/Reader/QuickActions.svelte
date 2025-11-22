<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { toggleFullScreen, zoomFitToScreen } from '$lib/panzoom';
  import { SpeedDial, SpeedDialButton } from 'flowbite-svelte';
  import { settings } from '$lib/settings';
  import {
    ArrowLeftOutline,
    ArrowRightOutline,
    CompressOutline,
    ImageOutline,
    ZoomOutOutline
  } from 'flowbite-svelte-icons';
  import { imageToWebp, showCropper, updateLastCard } from '$lib/anki-connect';
  import { promptConfirmation } from '$lib/util';

  interface Props {
    left: (_e: any, ingoreTimeOut?: boolean) => void;
    right: (_e: any, ingoreTimeOut?: boolean) => void;
    src1: File | undefined;
    src2: File | undefined;
  }

  let { left, right, src1, src2 }: Props = $props();

  let open = $state(false);

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

  async function onUpdateCard(src: File | undefined) {
    if ($settings.ankiConnectSettings.enabled && src) {
      if ($settings.ankiConnectSettings.cropImage) {
        showCropper(URL.createObjectURL(src));
      } else {
        promptConfirmation('Add image to last created anki card?', async () => {
          const imageData = await imageToWebp(src, $settings);
          updateLastCard(imageData);
        });
      }
    }
    open = false;
  }
</script>

{#if $settings.quickActions}
  <SpeedDial tooltip="none" trigger="click" class="absolute end-3 bottom-3 z-50">
    {#if $settings.ankiConnectSettings.enabled}
      <SpeedDialButton name={src2 ? '1' : undefined} onclick={() => onUpdateCard(src1)}>
        <ImageOutline />
      </SpeedDialButton>
    {/if}
    {#if $settings.ankiConnectSettings.enabled && src2}
      <SpeedDialButton name="2" onclick={() => onUpdateCard(src2)}>
        <ImageOutline />
      </SpeedDialButton>
    {/if}
    <SpeedDialButton onclick={toggleFullScreen}>
      <CompressOutline />
    </SpeedDialButton>
    <SpeedDialButton onclick={handleZoom}>
      <ZoomOutOutline />
    </SpeedDialButton>
    <SpeedDialButton onclick={handleRight}>
      <ArrowRightOutline />
    </SpeedDialButton>
    <SpeedDialButton onclick={handleLeft}>
      <ArrowLeftOutline />
    </SpeedDialButton>
  </SpeedDial>
{/if}
