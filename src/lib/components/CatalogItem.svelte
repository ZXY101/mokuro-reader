<script lang="ts">
  import { volumesWithPlaceholders } from '$lib/catalog';
  import { progress } from '$lib/settings';
  import { DownloadSolid } from 'flowbite-svelte-icons';
  import { Spinner } from 'flowbite-svelte';
  import { downloadSeriesFromDrive } from '$lib/util/download-from-drive';
  import { driveState } from '$lib/util/google-drive';
  import { showSnackbar } from '$lib/util';
  import { downloadQueue } from '$lib/util/download-queue';

  interface Props {
    series_uuid: string;
  }

  let { series_uuid }: Props = $props();

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
  );

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

  async function handleClick(e: MouseEvent) {
    if (isPlaceholderOnly) {
      e.preventDefault();

      // Prevent re-clicking during download
      if (isDownloading) {
        return;
      }

      let authenticated = false;
      driveState.subscribe(state => {
        authenticated = state.isAuthenticated;
      })();

      if (!authenticated) {
        showSnackbar('Please sign in to Google Drive first', 'error');
        return;
      }

      await downloadSeriesFromDrive(allSeriesVolumes);
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
        <div class="sm:w-[250px] sm:h-[350px] bg-black border-gray-900 border flex items-center justify-center">
          <div class="w-24 h-24 flex items-center justify-center">
            {#if isDownloading}
              <Spinner size="16" color="blue" />
            {:else}
              <DownloadSolid class="w-24 h-24 text-blue-400" />
            {/if}
          </div>
        </div>
      {:else if volume.thumbnail}
        <img
          src={URL.createObjectURL(volume.thumbnail)}
          alt="img"
          class="object-contain sm:w-[250px] sm:h-[350px] bg-black border-gray-900 border"
        />
      {/if}
      <p class="font-semibold sm:w-[250px] line-clamp-1">
        {volume.series_title}
      </p>
      {#if isPlaceholderOnly}
        <p class="text-xs text-blue-400">In Drive</p>
      {/if}
    </div>
  </a>
{/if}
