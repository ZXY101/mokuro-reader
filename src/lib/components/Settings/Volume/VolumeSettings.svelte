<script lang="ts">
  import { page } from '$app/stores';
  import { zoomDefault } from '$lib/panzoom';
  import {
    updateProgress,
    updateVolumeSetting,
    volumes,
    volumeSettings,
    type VolumeSettingsKey,
    type PageViewMode
  } from '$lib/settings';
  import { AccordionItem, Helper, Toggle, Label, Select } from 'flowbite-svelte';

  const volumeId = $page.params.volume;

  let settings = $derived($volumeSettings[$page.params.volume]);

  let toggles = $derived([
    { key: 'rightToLeft', text: 'Right to left', value: settings.rightToLeft },
    { key: 'hasCover', text: 'First page is cover', value: settings.hasCover }
  ] as { key: VolumeSettingsKey; text: string; value: any }[]);

  const pageViewModes: { value: PageViewMode; name: string }[] = [
    { value: 'single', name: 'Single page' },
    { value: 'dual', name: 'Dual page' },
    { value: 'auto', name: 'Auto (detect orientation & spreads)' }
  ];

  function onChange(key: VolumeSettingsKey, value: any) {
    updateVolumeSetting(volumeId, key, !value);
    if (key === 'hasCover') {
      const pageClamped = Math.max($volumes[volumeId].progress - 1, 1);
      updateProgress(volumeId, pageClamped);
      zoomDefault();
    }
  }

  function onPageViewModeChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    updateVolumeSetting(volumeId, 'singlePageView', target.value as PageViewMode);
    zoomDefault();
  }
</script>

<AccordionItem open>
  {#snippet header()}
    <span>Volume settings</span>
  {/snippet}
  <div class="flex flex-col gap-5">
    <Helper>These settings only apply to this volume</Helper>
    <div>
      <Label for="page-view-mode" class="mb-2">Page view mode</Label>
      <Select
        id="page-view-mode"
        size="sm"
        items={pageViewModes}
        bind:value={settings.singlePageView}
        on:change={onPageViewModeChange}
      />
    </div>
    {#each toggles as { key, text, value }}
      <Toggle size="small" checked={value} on:change={() => onChange(key, value)}>{text}</Toggle>
    {/each}
  </div>
</AccordionItem>
