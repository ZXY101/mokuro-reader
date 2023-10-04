<script lang="ts">
  import { settings, updateSetting, type SettingsKey } from '$lib/settings';
  import { Toggle } from 'flowbite-svelte';

  $: toggles = [
    { key: 'textEditable', text: 'Editable text', value: $settings.textEditable },
    { key: 'textBoxBorders', text: 'Text box borders', value: $settings.textBoxBorders },
    { key: 'displayOCR', text: 'OCR enabled', value: $settings.displayOCR },
    { key: 'boldFont', text: 'Bold font', value: $settings.boldFont },
    { key: 'pageNum', text: 'Show page number', value: $settings.pageNum },
    { key: 'charCount', text: 'Show character count', value: $settings.charCount },
    { key: 'mobile', text: 'Mobile', value: $settings.mobile }
  ] as { key: SettingsKey; text: string; value: any }[];
</script>

{#each toggles as { key, text, value }}
  <Toggle size="small" checked={value} on:change={() => updateSetting(key, !value)}>{text}</Toggle>
{/each}
