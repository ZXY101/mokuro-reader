<script lang="ts">
  import { page } from '$app/stores';
  import { toggleFullScreen } from '$lib/panzoom';
  import { updateVolumeSetting, volumeSettings, type VolumeSettingsKey } from '$lib/settings';
  import { AccordionItem, Button, Helper, Toggle } from 'flowbite-svelte';

  $: settings = $volumeSettings[$page.params.volume];

  $: toggles = [
    { key: 'rightToLeft', text: 'Right to left', value: settings.rightToLeft },
    { key: 'singlePageView', text: 'Single page view', value: settings.singlePageView },
    { key: 'hasCover', text: 'First page is cover', value: settings.hasCover }
  ] as { key: VolumeSettingsKey; text: string; value: any }[];
</script>

<AccordionItem open>
  <span slot="header">Volume settings</span>
  <div class="flex flex-col gap-5">
    <Helper>These settings only apply to this volume</Helper>
    {#each toggles as { key, text, value }}
      <Toggle
        size="small"
        checked={value}
        on:change={() => updateVolumeSetting($page.params.volume, key, !value)}>{text}</Toggle
      >
    {/each}
    <Button color="alternative" on:click={toggleFullScreen}>Toggle fullscreen</Button>
  </div>
</AccordionItem>
