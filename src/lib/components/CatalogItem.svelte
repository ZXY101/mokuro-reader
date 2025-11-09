<script lang="ts">
  import { volumesWithPlaceholders } from '$lib/catalog';
  import { progress } from '$lib/settings';
  import { DownloadSolid } from 'flowbite-svelte-icons';
  import { Spinner } from 'flowbite-svelte';
  import { showSnackbar } from '$lib/util';
  import { downloadQueue, queueSeriesVolumes } from '$lib/util/download-queue';
  import { unifiedCloudManager } from '$lib/util/sync/unified-cloud-manager';

  interface Props {
    series_uuid: string;
  }

  let { series_uuid }: Props = $props();

  // Get active provider's display name
  let providerDisplayName = $derived.by(() => {
    const provider = unifiedCloudManager.getActiveProvider();
    return provider?.name || 'Cloud';
  });

  let firstUnreadVolume = $derived(
    Object.values($volumesWithPlaceholders)
      .filter(v => !v.isPlaceholder)
      .sort((a, b) => a.volume_title.localeCompare(b.volume_title))
      .find(
        (item) =>
          item.series_uuid === series_uuid &&
          ($progress?.[item.volume_uuid || 0] || 1) < item.page_count - 1
      )
  );

  let firstVolume = $derived(
    Object.values($volumesWithPlaceholders)
      .sort((a, b) => a.volume_title.localeCompare(b.volume_title))
      .find((item) => item.series_uuid === series_uuid)
  );

  let allSeriesVolumes = $derived(
    Object.values($volumesWithPlaceholders)
      .filter(v => v.series_uuid === series_uuid)
      .sort((a, b) => a.volume_title.localeCompare(b.volume_title))
  );

  // Get up to 3 volumes for stacked thumbnail (local volumes only)
  let stackedVolumes = $derived.by(() => {
    const localVolumes = allSeriesVolumes.filter(v => !v.isPlaceholder);

    // Check if there are any unread volumes
    const unreadVolumes = localVolumes.filter(v =>
      ($progress?.[v.volume_uuid] || 1) < v.page_count - 1
    );

    // If there are unread volumes, only show those; otherwise show all
    const volumesToStack = unreadVolumes.length > 0 ? unreadVolumes : localVolumes;

    // Take up to 3 (already sorted alphabetically, first volume will be on top/left)
    return volumesToStack.slice(0, 3);
  });

  let volume = $derived(firstUnreadVolume ?? firstVolume);
  let isComplete = $derived(!firstUnreadVolume);
  let isPlaceholderOnly = $derived(volume?.isPlaceholder === true);

  // Track queue state
  let queueState = $state($downloadQueue);
  $effect(() => {
    return downloadQueue.subscribe(value => {
      queueState = value;
    });
  });

  // Check if this series is downloading or queued
  let isDownloading = $derived.by(() => {
    if (!volume || !isPlaceholderOnly) return false;

    const seriesItems = queueState.filter(item => item.seriesTitle === volume.series_title);
    return seriesItems.length > 0;
  });

  // Calculate rendered dimensions for an image given max constraints
  function calculateRenderedDimensions(naturalWidth: number, naturalHeight: number) {
    const maxW = 250;
    const maxH = 360;

    // Calculate scale factors needed to fit within constraints
    const scaleW = maxW / naturalWidth;
    const scaleH = maxH / naturalHeight;

    // Use the smaller scale factor (more restrictive constraint)
    // Don't scale up (max scale = 1)
    const scale = Math.min(scaleW, scaleH, 1);

    return {
      width: naturalWidth * scale,
      height: naturalHeight * scale
    };
  }

  // Store thumbnail dimensions
  let thumbnailDimensions = $state<Map<string, { width: number; height: number }>>(new Map());

  // Load thumbnail dimensions
  $effect(() => {
    const newDimensions = new Map<string, { width: number; height: number }>();

    const promises = stackedVolumes.map(vol => {
      if (!vol.thumbnail) return Promise.resolve();

      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          newDimensions.set(vol.volume_uuid, {
            width: img.naturalWidth,
            height: img.naturalHeight
          });
          resolve();
        };
        img.onerror = () => resolve(); // Skip on error
        img.src = URL.createObjectURL(vol.thumbnail);
      });
    });

    Promise.all(promises).then(() => {
      thumbnailDimensions = newDimensions;
    });
  });

  // Calculate dynamic step sizes based on actual image dimensions
  let stepSizes = $derived.by(() => {
    const containerWidth = 325;
    const containerHeight = 385;

    // Default horizontal step (11% of width)
    const horizontalStep = containerWidth * 0.11;

    // Calculate vertical step to fill height exactly
    if (stackedVolumes.length === 0 || thumbnailDimensions.size === 0) {
      // Fallback to default 11%
      return {
        horizontal: horizontalStep,
        vertical: containerHeight * 0.11,
        topOffset: 0
      };
    }

    // Calculate rendered dimensions and aspect ratios for all volumes
    const renderedData = stackedVolumes
      .map(vol => {
        const dims = thumbnailDimensions.get(vol.volume_uuid);
        if (!dims) return null;

        const rendered = calculateRenderedDimensions(dims.width, dims.height);
        return {
          height: rendered.height,
          width: rendered.width,
          aspectRatio: rendered.width / rendered.height
        };
      })
      .filter(d => d !== null);

    if (renderedData.length === 0) {
      return {
        horizontal: horizontalStep,
        vertical: containerHeight * 0.11,
        topOffset: 0
      };
    }

    // Use the tallest rendered height
    const maxRenderedHeight = Math.max(...renderedData.map(d => d.height));

    // Calculate average aspect ratio
    const avgAspectRatio = renderedData.reduce((sum, d) => sum + d.aspectRatio, 0) / renderedData.length;

    // Preferred aspect ratio for manga (250:350)
    const preferredAspect = 250 / 350; // 0.714

    // Apply height penalty for squat images
    let effectiveHeight = containerHeight;
    if (avgAspectRatio > preferredAspect) {
      // How much squatter than preferred (0 = perfect, higher = more squat)
      const excessAspect = avgAspectRatio - preferredAspect;

      // Gentle penalty: ~100px per 1.0 excess aspect (so square gets ~28.6px penalty)
      // Capped at 60px to still favor filling
      const penalty = Math.min(excessAspect * 100, 60);

      effectiveHeight = containerHeight - penalty;
    }

    // Calculate step size using effective height: (effectiveHeight - maxHeight) / (numVolumes - 1)
    const numVolumes = stackedVolumes.length;
    const verticalStep = numVolumes > 1
      ? Math.max(0, (effectiveHeight - maxRenderedHeight) / (numVolumes - 1))
      : 0;

    // Center the stack: unused space is split equally top/bottom
    const unusedSpace = containerHeight - effectiveHeight;
    const topOffset = unusedSpace / 2;

    return {
      horizontal: horizontalStep,
      vertical: verticalStep,
      topOffset
    };
  });

  async function handleClick(e: MouseEvent) {
    if (isPlaceholderOnly) {
      e.preventDefault();

      // Prevent re-clicking during download
      if (isDownloading) {
        return;
      }

      // Check if any cloud provider is authenticated
      const hasProvider = unifiedCloudManager.getActiveProvider() !== null;
      if (!hasProvider) {
        showSnackbar('Please sign in to a cloud storage provider first');
        return;
      }

      // Queue all series volumes for download
      queueSeriesVolumes(allSeriesVolumes);
    }
  }
</script>

{#if volume}
  <a href={series_uuid} onclick={handleClick}>
    <div
      class:text-green-400={isComplete}
      class:opacity-70={isPlaceholderOnly}
      class="flex flex-col gap-[5px] text-center items-center bg-slate-900 pb-1 bg-opacity-50 border border-slate-950 relative"
      class:cursor-pointer={isPlaceholderOnly}
    >
      {#if isPlaceholderOnly}
        <div class="sm:w-[325px] sm:h-[385px] bg-black border-gray-900 border flex items-center justify-center">
          <div class="w-24 h-24 flex items-center justify-center">
            {#if isDownloading}
              <Spinner size="16" color="blue" />
            {:else}
              <DownloadSolid class="w-24 h-24 text-blue-400" />
            {/if}
          </div>
        </div>
      {:else if stackedVolumes.length > 0}
        <!-- Stacked diagonal layout: dynamic stepping based on image aspect ratios -->
        <div class="relative sm:w-[325px] sm:h-[410px] sm:pt-4 sm:pb-6">
          <div class="relative sm:w-full sm:h-[385px] overflow-hidden">
            {#each stackedVolumes as vol, i (vol.volume_uuid)}
              {#if vol.thumbnail}
                <img
                  src={URL.createObjectURL(vol.thumbnail)}
                  alt={vol.volume_title}
                  class="absolute sm:max-w-[250px] sm:max-h-[360px] h-auto bg-black border-gray-900 border"
                  style="left: {i * stepSizes.horizontal}px; top: {stepSizes.topOffset + (i * stepSizes.vertical)}px; z-index: {stackedVolumes.length - i}; filter: drop-shadow(2px 4px 6px rgba(0, 0, 0, 0.5));"
                />
              {/if}
            {/each}
          </div>
        </div>
      {/if}
      <p class="font-semibold sm:w-[325px] line-clamp-1">
        {volume.series_title}
      </p>
      {#if isPlaceholderOnly}
        <p class="text-xs text-blue-400">In {providerDisplayName}</p>
      {/if}
    </div>
  </a>
{/if}
