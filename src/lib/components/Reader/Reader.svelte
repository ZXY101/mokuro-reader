<script lang="ts">
  import { currentVolume } from '$lib/catalog';
  import { Panzoom, toggleFullScreen, zoomDefault } from '$lib/panzoom';
  import { progress, settings, updateProgress } from '$lib/settings';
  import { clamp } from '$lib/util';
  import { Input, Popover, Range } from 'flowbite-svelte';
  import MangaPage from './MangaPage.svelte';
  import { ChervonDoubleLeftSolid, ChervonDoubleRightSolid } from 'flowbite-svelte-icons';
  import { afterUpdate } from 'svelte';
  import Cropper from './Cropper.svelte';

  const volume = $currentVolume;
  const pages = volume?.mokuroData.pages;

  $: page = $progress?.[volume?.mokuroData.volume_uuid || 0] || 1;
  $: index = page - 1;
  $: navAmount =
    $settings.singlePageView || ($settings.hasCover && !$settings.singlePageView && index === 0)
      ? 1
      : 2;

  let start: Date;

  function mouseDown() {
    start = new Date();
  }

  function left(_e: any, ingoreTimeOut?: boolean) {
    const newPage = $settings.rightToLeft ? page + navAmount : page - navAmount;
    changePage(newPage, ingoreTimeOut);
  }

  function right(_e: any, ingoreTimeOut?: boolean) {
    const newPage = $settings.rightToLeft ? page - navAmount : page + navAmount;
    changePage(newPage, ingoreTimeOut);
  }

  function changePage(newPage: number, ingoreTimeOut = false) {
    const end = new Date();
    const clickDuration = ingoreTimeOut ? 0 : end.getTime() - start?.getTime();

    if (pages && volume && clickDuration < 200) {
      if (showSecondPage() && page + 1 === pages.length && newPage > page) {
        return;
      }
      updateProgress(volume.mokuroData.volume_uuid, clamp(newPage, 1, pages?.length));
      zoomDefault();
    }
  }

  $: showSecondPage = () => {
    if (!pages) {
      return false;
    }

    if ($settings.singlePageView || index + 1 >= pages.length) {
      return false;
    }

    if (index === 0 && $settings.hasCover) {
      return false;
    }

    return true;
  };

  $: manualPage = page;
  $: pageDisplay = showSecondPage()
    ? `${page},${page + 1} / ${pages?.length}`
    : `${page} / ${pages?.length}`;

  let hasCoverSetting = $settings.hasCover;

  $: {
    if ($settings.hasCover !== hasCoverSetting) {
      hasCoverSetting = $settings.hasCover;
      if (page > 1 && !$settings.singlePageView) {
        page--;
      }
    }
  }

  function onInputClick(this: any) {
    this.select();
  }

  function onManualPageChange() {
    changePage(manualPage, true);
  }

  afterUpdate(() => {
    zoomDefault();
  });

  function handleShortcuts(event: KeyboardEvent & { currentTarget: EventTarget & Window }) {
    switch (event.code) {
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
        left(event, true);
        return;
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
        right(event, true);
        return;
      case 'Home':
        changePage(1, true);
        return;
      case 'End':
        if (pages) {
          changePage(pages.length, true);
        }
        return;
      case 'Space':
        if (pages && page + 1 <= pages.length) {
          changePage(page + 1, true);
        }
        return;
      case 'KeyF':
        toggleFullScreen();
        return;
      default:
        break;
    }
  }
</script>

<svelte:window on:resize={zoomDefault} on:keyup|preventDefault={handleShortcuts} />
{#if volume && pages}
  <Cropper />
  <Popover placement="bottom-end" trigger="click" triggeredBy="#page-num" class="z-20">
    <div class="flex flex-col gap-3">
      <div class="flex flex-row items-center gap-5 z-10">
        <ChervonDoubleLeftSolid
          on:click={() => changePage($settings.rightToLeft ? pages.length : 1, true)}
          class="hover:text-primary-600"
        />
        <Input
          type="number"
          size="sm"
          defaultClass="select-all"
          bind:value={manualPage}
          on:click={onInputClick}
          on:change={onManualPageChange}
        />
        <ChervonDoubleRightSolid
          on:click={() => changePage($settings.rightToLeft ? 1 : pages.length, true)}
          class="hover:text-primary-600"
        />
      </div>
      <Range min={1} max={pages.length} bind:value={manualPage} on:change={onManualPageChange} />
    </div>
  </Popover>
  <button
    class="absolute opacity-50 left-5 top-5 z-10 mix-blend-difference"
    class:hidden={!$settings.pageNum}
    id="page-num"
  >
    {pageDisplay}
  </button>
  <div class="flex">
    <Panzoom>
      <button
        class="h-full fixed -left-1/2 z-10 w-1/2 hover:bg-slate-400 opacity-[0.01] justify-items-center"
        on:mousedown={mouseDown}
        on:mouseup={left}
      />
      <button
        class="h-full fixed -right-1/2 z-10 w-1/2 hover:bg-slate-400 opacity-[0.01]"
        on:mousedown={mouseDown}
        on:mouseup={right}
      />
      <div class="flex flex-row" class:flex-row-reverse={!$settings.rightToLeft}>
        {#if showSecondPage()}
          <MangaPage page={pages[index + 1]} src={Object.values(volume?.files)[index + 1]} />
        {/if}
        <MangaPage page={pages[index]} src={Object.values(volume?.files)[index]} />
      </div>
    </Panzoom>
  </div>
  <button
    on:mousedown={mouseDown}
    on:mouseup={left}
    class="left-0 top-0 absolute h-full w-10 hover:bg-slate-400 opacity-[0.01]"
  />
  <button
    on:mousedown={mouseDown}
    on:mouseup={right}
    class="right-0 top-0 absolute h-full w-10 hover:bg-slate-400 opacity-[0.01]"
  />
{/if}
