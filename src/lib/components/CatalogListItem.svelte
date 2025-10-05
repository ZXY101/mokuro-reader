<script lang="ts">
  import { volumesWithPlaceholders } from '$lib/catalog';
  import { ListgroupItem } from 'flowbite-svelte';
  import { progress } from '$lib/settings';
  import { DownloadSolid } from 'flowbite-svelte-icons';
  import { downloadSeriesFromDrive } from '$lib/util/download-from-drive';
  import { driveState } from '$lib/util/google-drive';
  import { showSnackbar } from '$lib/util';

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

  async function handleClick(e: MouseEvent) {
    if (isPlaceholderOnly) {
      e.preventDefault();

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
  <div class:opacity-70={isPlaceholderOnly}>
    <ListgroupItem>
      <a href={series_uuid} class="h-full w-full" onclick={handleClick}>
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-2">
            <p class:text-green-400={isComplete} class="font-semibold">{volume.series_title}</p>
            {#if isPlaceholderOnly}
              <span class="text-xs text-blue-400">In Drive</span>
            {/if}
          </div>
          {#if isPlaceholderOnly}
            <DownloadSolid class="w-[50px] h-[70px] text-blue-400" />
          {:else if volume.thumbnail}
            <img
              src={URL.createObjectURL(volume.thumbnail)}
              alt="img"
              class="object-contain w-[50px] h-[70px] bg-black border-gray-900 border"
            />
          {/if}
        </div>
      </a>
    </ListgroupItem>
  </div>
{/if}
