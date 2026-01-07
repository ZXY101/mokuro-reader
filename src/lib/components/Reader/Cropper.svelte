<script lang="ts">
  import { currentView } from '$lib/util/hash-router';
  import { cropperStore, getCroppedImg, type Pixels, sendToAnki } from '$lib/anki-connect';
  import { settings } from '$lib/settings';
  import { Button, Helper, Input, Label, Modal, Spinner, Textarea } from 'flowbite-svelte';
  import { onMount, onDestroy } from 'svelte';
  import CropperJS from 'cropperjs';
  import 'cropperjs/dist/cropper.css';
  import type { Page } from '$lib/types';

  let open = $state(false);
  let pixels: Pixels | undefined = undefined;
  let loading = $state(false);
  let cropper: CropperJS | null = null;

  // Editable fields
  let editableSelectedText = $state('');
  let editableSentence = $state('');

  // Track whether we opened with no pre-selected text (show textbox picker)
  let openedWithoutText = $state(false);

  // Track which block is currently selected (for highlighting)
  let selectedBlockIndex = $state<number | null>(null);

  // Track whether crop image is enabled
  let cropEnabled = $derived($settings.ankiConnectSettings.cropImage);
  let cardMode = $derived($settings.ankiConnectSettings.cardMode);
  let grabSentence = $derived($settings.ankiConnectSettings.grabSentence);
  let sentenceField = $derived($settings.ankiConnectSettings.sentenceField);

  // Get available pages for selection
  let pages = $derived($cropperStore?.pages || []);

  // Flatten blocks from all pages with their position info for rendering
  interface TextBoxZone {
    left: string;
    top: string;
    width: string;
    height: string;
    text: string;
    blockIndex: number;
  }

  let textBoxZones = $derived.by(() => {
    const zones: TextBoxZone[] = [];
    // Use first page only (each image corresponds to one page)
    const page = pages[0];
    if (!page) return zones;

    const { img_width, img_height, blocks } = page;
    if (!img_width || !img_height) return zones;

    blocks.forEach((block, index) => {
      const [xmin, ymin, xmax, ymax] = block.box;
      // Convert to percentages for responsive positioning
      zones.push({
        left: `${(xmin / img_width) * 100}%`,
        top: `${(ymin / img_height) * 100}%`,
        width: `${((xmax - xmin) / img_width) * 100}%`,
        height: `${((ymax - ymin) / img_height) * 100}%`,
        text: block.lines.join(' '),
        blockIndex: index
      });
    });

    return zones;
  });

  // Show textbox picker when in create mode, no text selected, and pages available
  let showTextboxPicker = $derived(
    cardMode === 'create' && openedWithoutText && textBoxZones.length > 0
  );

  // Close modal on navigation (hash route change)
  let previousViewType = $state($currentView.type);
  $effect(() => {
    const viewType = $currentView.type;
    if (viewType !== previousViewType) {
      previousViewType = viewType;
      if (open) {
        close();
      }
    }
  });

  onMount(() => {
    cropperStore.subscribe((value) => {
      if (value) {
        open = value.open;
        // Initialize editable fields from store
        if (value.open) {
          editableSelectedText = value.selectedText || '';
          editableSentence = value.sentence || '';
          // Track if we opened without pre-selected text
          openedWithoutText = !value.selectedText;
          selectedBlockIndex = null;
        }
      }
    });
  });

  // Select a textbox zone to populate both Front and Sentence fields
  function selectTextboxZone(zone: TextBoxZone) {
    editableSelectedText = zone.text;
    editableSentence = zone.text;
    selectedBlockIndex = zone.blockIndex;
  }

  onDestroy(() => {
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
  });

  function initCropper(img: HTMLImageElement) {
    const setup = () => {
      if (cropper) {
        cropper.destroy();
      }

      // Get text box bounds if available
      const textBox = $cropperStore?.textBox;

      cropper = new CropperJS(img, {
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 1,
        restore: false,
        guides: true,
        center: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
        aspectRatio: NaN, // Free-form cropping
        ready() {
          // Set initial crop to text box bounds if available
          if (textBox && cropper) {
            const [xmin, ymin, xmax, ymax] = textBox;
            cropper.setData({
              x: xmin,
              y: ymin,
              width: xmax - xmin,
              height: ymax - ymin
            });
          }
          updatePixels();
        },
        crop() {
          updatePixels();
        }
      });
    };

    if (img.complete && img.naturalWidth > 0) {
      setup();
    } else {
      img.onload = setup;
    }
  }

  function updatePixels() {
    if (!cropper) return;
    const data = cropper.getData(true);
    pixels = {
      x: data.x,
      y: data.y,
      width: data.width,
      height: data.height
    };
  }

  function close() {
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    loading = false;
    editableSelectedText = '';
    editableSentence = '';
    openedWithoutText = false;
    selectedBlockIndex = null;
    cropperStore.set({ open: false });
  }

  async function onSend() {
    if ($cropperStore?.image) {
      loading = true;
      try {
        let imageData: string | null | undefined;

        if (cropEnabled && pixels) {
          // Crop the image if crop mode is enabled
          imageData = await getCroppedImg($cropperStore.image, pixels, $settings);
        } else {
          // Use full image - fetch and convert to base64
          const response = await fetch($cropperStore.image);
          const blob = await response.blob();
          imageData = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        }

        sendToAnki(
          imageData,
          editableSelectedText,
          editableSentence,
          $cropperStore.tags,
          $cropperStore.metadata
        );
        close();
      } catch (error) {
        console.error('[Cropper] Error:', error);
        loading = false;
      }
    }
  }
</script>

<Modal
  title={cardMode === 'create' ? 'Create Anki Card' : 'Update Anki Card'}
  bind:open
  onclose={close}
>
  {#if $cropperStore?.image && !loading}
    <div class="flex flex-col gap-3">
      {#if cropEnabled}
        <div class="cropper-container">
          <img
            src={$cropperStore?.image}
            alt="Crop preview"
            class="cropper-image block max-w-full"
            use:initCropper
          />
        </div>
      {:else}
        <div class="image-container flex justify-center">
          <div class="relative inline-block">
            <img src={$cropperStore?.image} alt="Preview" class="max-h-[30svh] object-contain" />
            {#if showTextboxPicker}
              <!-- Clickable text box zones overlaid on the image -->
              {#each textBoxZones as zone}
                <button
                  type="button"
                  onclick={() => selectTextboxZone(zone)}
                  class="textbox-zone"
                  class:selected={selectedBlockIndex === zone.blockIndex}
                  style:left={zone.left}
                  style:top={zone.top}
                  style:width={zone.width}
                  style:height={zone.height}
                  title={zone.text}
                ></button>
              {/each}
            {/if}
          </div>
        </div>
        {#if showTextboxPicker}
          <Helper class="text-center">Click a text box on the image to select it</Helper>
        {/if}
      {/if}

      <div>
        <Label class="text-gray-900 dark:text-white">
          Front: {#if cardMode === 'create'}<span class="text-red-500">*</span>{/if}
        </Label>
        <Input
          bind:value={editableSelectedText}
          placeholder="Selected text for card front..."
          class="mt-1"
          required={cardMode === 'create'}
        />
        <Helper class="mt-1"
          >The word or phrase (card front){#if cardMode === 'create'}
            - required{/if}</Helper
        >
      </div>

      {#if grabSentence && sentenceField !== 'Front'}
        <div>
          <Label class="text-gray-900 dark:text-white">{sentenceField}:</Label>
          <Textarea
            rows={2}
            bind:value={editableSentence}
            placeholder="Full sentence context..."
            class="mt-1"
          />
          <Helper class="mt-1">Full context sentence</Helper>
        </div>
      {/if}

      <div class="flex gap-2">
        <Button onclick={onSend} class="flex-1">
          {cardMode === 'create' ? 'Create Card' : 'Update Card'}
        </Button>
        <Button onclick={close} outline color="light">Cancel</Button>
      </div>
    </div>
  {:else}
    <div class="text-center"><Spinner /></div>
  {/if}
</Modal>

<style>
  .cropper-container {
    position: relative;
    height: 50dvh;
    overflow: hidden;
    border-radius: 0.5rem;
    background: #111827;
  }

  .cropper-container :global(.cropper-container) {
    height: 100% !important;
  }

  /* Make resize handles larger and easier to grab */
  .cropper-container :global(.cropper-point) {
    width: 20px !important;
    height: 20px !important;
    opacity: 1 !important;
  }

  .cropper-container :global(.cropper-point.point-nw) {
    top: -10px !important;
    left: -10px !important;
  }

  .cropper-container :global(.cropper-point.point-ne) {
    top: -10px !important;
    right: -10px !important;
  }

  .cropper-container :global(.cropper-point.point-sw) {
    bottom: -10px !important;
    left: -10px !important;
  }

  .cropper-container :global(.cropper-point.point-se) {
    bottom: -10px !important;
    right: -10px !important;
  }

  .cropper-container :global(.cropper-point.point-n),
  .cropper-container :global(.cropper-point.point-s) {
    width: 40px !important;
    left: 50% !important;
    margin-left: -20px !important;
  }

  .cropper-container :global(.cropper-point.point-e),
  .cropper-container :global(.cropper-point.point-w) {
    height: 40px !important;
    top: 50% !important;
    margin-top: -20px !important;
  }

  .cropper-container :global(.cropper-line) {
    background-color: rgba(59, 130, 246, 0.5) !important;
  }

  .textbox-zone {
    position: absolute;
    border: 2px solid red;
    background: transparent;
    cursor: pointer;
    transition: all 0.15s ease;
    padding: 0;
  }

  .textbox-zone:hover {
    background: rgba(255, 0, 0, 0.15);
    border-color: #ff4444;
  }

  .textbox-zone.selected {
    background: rgba(0, 128, 255, 0.25);
    border-color: #0080ff;
    border-width: 3px;
  }
</style>
