<script lang="ts">
  import type { VolumeMetadata } from '$lib/types';
  import { progress } from '$lib/settings';
  import { miscSettings } from '$lib/settings/misc';
  import { showSnackbar } from '$lib/util';
  import { downloadQueue, queueSeriesVolumes } from '$lib/util/download-queue';
  import { unifiedCloudManager } from '$lib/util/sync/unified-cloud-manager';
  import PlaceholderThumbnail from './PlaceholderThumbnail.svelte';
  import { nav } from '$lib/util/navigation';
  import { isPWA } from '$lib/util/pwa';

  interface Props {
    series_uuid: string;
    volumes: VolumeMetadata[]; // Pre-computed by parent - avoids O(N) re-filtering
    providerName?: string; // Shared across all items - avoids repeated lookups
  }

  let { series_uuid, volumes, providerName = 'Cloud' }: Props = $props();

  // Volumes are already filtered by parent, just need to sort once
  let seriesVolumes = $derived(
    [...volumes].sort((a, b) => a.volume_title.localeCompare(b.volume_title))
  );

  // Split into local vs cloud placeholders
  let localVolumes = $derived(seriesVolumes.filter((v) => !v.isPlaceholder));
  let hasLocalVolumes = $derived(localVolumes.length > 0);

  // Find unread volumes (only among local volumes)
  let unreadVolumes = $derived(
    localVolumes.filter((v) => ($progress?.[v.volume_uuid] || 1) < v.page_count - 1)
  );

  // Display volume: first unread, or first local, or first placeholder
  let volume = $derived(unreadVolumes[0] ?? localVolumes[0] ?? seriesVolumes[0]);

  // UI state flags
  let isComplete = $derived(unreadVolumes.length === 0 && hasLocalVolumes);
  let isPlaceholderOnly = $derived(!hasLocalVolumes);

  // Get volumes for stacked thumbnail based on settings
  let stackedVolumes = $derived.by(() => {
    const hideRead = $miscSettings.catalogHideReadVolumes;
    const stackCount = $miscSettings.catalogStackCount;
    // If hiding read volumes and there are unread ones, show those; otherwise show all local
    const sourceVolumes = hideRead && unreadVolumes.length > 0 ? unreadVolumes : localVolumes;
    return sourceVolumes.slice(0, stackCount);
  });

  // Keep allSeriesVolumes for handleClick function
  let allSeriesVolumes = $derived(seriesVolumes);

  // Check if this series is downloading or queued
  let isDownloading = $derived(
    isPlaceholderOnly && volume
      ? $downloadQueue.some((item) => item.seriesTitle === volume.series_title)
      : false
  );

  // Store blob URLs for thumbnails
  let thumbnailUrls = $state<Map<string, string>>(new Map());

  // Create blob URLs for stacked volumes
  $effect(() => {
    const newUrls = new Map<string, string>();
    const urlsToRevoke: string[] = [];

    for (const vol of stackedVolumes) {
      if (vol.thumbnail) {
        const url = URL.createObjectURL(vol.thumbnail);
        urlsToRevoke.push(url);
        newUrls.set(vol.volume_uuid, url);
      }
    }

    thumbnailUrls = newUrls;

    // Cleanup: revoke all blob URLs when effect is destroyed
    return () => {
      urlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
    };
  });

  // Base thumbnail dimensions
  const BASE_WIDTH = 250;
  const BASE_HEIGHT = 360;
  const OUTER_PADDING = 25; // pt-4 pb-6 ≈ 25px

  // Calculate container dimensions based on settings
  let containerDimensions = $derived.by(() => {
    const stackCount = $miscSettings.catalogStackCount;
    const hOffsetPercent = $miscSettings.catalogHorizontalStep / 100;
    const vOffsetPercent = $miscSettings.catalogVerticalStep / 100;

    // Extra space needed for stacking: offset% × base × (stackCount - 1)
    const extraWidth = BASE_WIDTH * hOffsetPercent * (stackCount - 1);
    const extraHeight = BASE_HEIGHT * vOffsetPercent * (stackCount - 1);

    // Inner container (thumbnail area)
    const innerWidth = Math.round(BASE_WIDTH + extraWidth);
    const innerHeight = Math.round(BASE_HEIGHT + extraHeight);

    // Outer container (with padding)
    const outerWidth = innerWidth;
    const outerHeight = innerHeight + OUTER_PADDING;

    return {
      innerWidth,
      innerHeight,
      outerWidth,
      outerHeight
    };
  });

  // Calculate step sizes in pixels
  let stepSizes = $derived.by(() => {
    const stackCount = $miscSettings.catalogStackCount;
    const hOffsetPercent = $miscSettings.catalogHorizontalStep / 100;
    const vOffsetPercent = $miscSettings.catalogVerticalStep / 100;

    // Step in pixels based on base thumbnail size
    const horizontalStep = BASE_WIDTH * hOffsetPercent;
    const verticalStep = BASE_HEIGHT * vOffsetPercent;

    return {
      horizontal: horizontalStep,
      vertical: verticalStep,
      topOffset: 0
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
    } else if ($isPWA) {
      // In PWA mode, use navigation system instead of href
      e.preventDefault();
      nav.toSeries(series_uuid);
    }
  }
</script>

{#if volume}
  <a href={series_uuid} onclick={handleClick}>
    <div
      class:text-green-400={isComplete}
      class:opacity-70={isPlaceholderOnly}
      class="relative flex flex-col items-center gap-[5px] rounded-lg border-2 border-transparent p-3 text-center transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
      class:cursor-pointer={isPlaceholderOnly}
    >
      {#if isPlaceholderOnly}
        <!-- Stacked placeholder layout to show volume count -->
        <div
          class="relative pt-4 pb-6"
          style="width: {containerDimensions.outerWidth}px; height: {containerDimensions.outerHeight}px;"
        >
          <PlaceholderThumbnail
            count={seriesVolumes.length}
            {isDownloading}
            showDownloadUI={true}
          />
        </div>
      {:else if stackedVolumes.length > 0}
        <!-- Stacked diagonal layout: dynamic stepping based on settings -->
        <div
          class="relative pt-4 pb-6"
          style="width: {containerDimensions.outerWidth}px; height: {containerDimensions.outerHeight}px;"
        >
          <div
            class="relative overflow-hidden"
            style="width: {containerDimensions.innerWidth}px; height: {containerDimensions.innerHeight}px;"
          >
            {#each stackedVolumes as vol, i (vol.volume_uuid)}
              {#if thumbnailUrls.get(vol.volume_uuid)}
                <img
                  src={thumbnailUrls.get(vol.volume_uuid)}
                  alt={vol.volume_title}
                  class="absolute h-auto border border-gray-900 bg-black"
                  style="max-width: {BASE_WIDTH}px; max-height: {BASE_HEIGHT}px; left: {i *
                    stepSizes.horizontal}px; top: {stepSizes.topOffset +
                    i * stepSizes.vertical}px; z-index: {stackedVolumes.length -
                    i}; filter: drop-shadow(2px 4px 6px rgba(0, 0, 0, 0.5));"
                />
              {/if}
            {/each}
          </div>
        </div>
      {/if}
      <p class="line-clamp-2 font-semibold" style="width: {containerDimensions.outerWidth}px;">
        {volume.series_title}
      </p>
      {#if isPlaceholderOnly}
        <p class="text-xs text-blue-400">
          {seriesVolumes.length} volume{seriesVolumes.length !== 1 ? 's' : ''} in {providerName}
        </p>
      {/if}
    </div>
  </a>
{/if}
