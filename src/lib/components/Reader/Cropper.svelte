<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { cropperStore, getCroppedImg, updateLastCard, type Pixels } from '$lib/anki-connect';
  import { Button, Modal, Spinner } from 'flowbite-svelte';
  import { onMount } from 'svelte';
  import Cropper from 'svelte-easy-crop';

  let open = false;
  let pixels: Pixels;
  let loading = false;

  afterNavigate(() => {
    close();
  });

  onMount(() => {
    cropperStore.subscribe((value) => {
      if (value) {
        open = value.open;
      }
    });
  });

  function close() {
    loading = false;
    cropperStore.set({ open: false });
  }

  async function onCrop() {
    if ($cropperStore?.image && $cropperStore?.sentence && pixels) {
      loading = true;
      const imageData = await getCroppedImg($cropperStore.image, pixels);
      updateLastCard(imageData, $cropperStore.sentence);
      close();
    }
  }

  function onCropComplete(e: any) {
    pixels = e.detail.pixels;
  }
</script>

<Modal title="Crop image" bind:open on:{close}>
  {#if $cropperStore?.image && !loading}
    <div class=" flex flex-col gap-2">
      <div class="relative w-full h-[55svh] sm:h-[70svh]">
        <Cropper
          zoomSpeed={0.5}
          maxZoom={10}
          image={$cropperStore?.image}
          on:cropcomplete={onCropComplete}
        />
      </div>
      <Button on:click={onCrop}>Crop</Button>
      <Button on:click={close} outline color="light">Close</Button>
    </div>
  {:else}
    <div class="text-center"><Spinner /></div>
  {/if}
</Modal>
