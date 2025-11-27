<script lang="ts">
  import { AccordionItem, Label, Range, Toggle } from 'flowbite-svelte';
  import { miscSettings, updateMiscSetting } from '$lib/settings/misc';
  import { isCatalog } from '$lib/util';
</script>

{#if isCatalog()}
  <AccordionItem>
    {#snippet header()}Catalog layout{/snippet}
    <div class="flex flex-col gap-4">
      <div>
        <Label class="mb-2">Stack count: {$miscSettings.catalogStackCount}</Label>
        <Range
          min={1}
          max={10}
          value={$miscSettings.catalogStackCount}
          oninput={(e) =>
            updateMiscSetting('catalogStackCount', parseInt(e.currentTarget.value))}
        />
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Number of volumes shown in stack (1-10)
        </p>
      </div>

      <div>
        <Label class="mb-2">Horizontal offset: {$miscSettings.catalogHorizontalStep}%</Label>
        <Range
          min={0}
          max={30}
          value={$miscSettings.catalogHorizontalStep}
          oninput={(e) =>
            updateMiscSetting('catalogHorizontalStep', parseInt(e.currentTarget.value))}
        />
      </div>

      <div>
        <Label class="mb-2">Vertical offset: {$miscSettings.catalogVerticalStep}%</Label>
        <Range
          min={0}
          max={30}
          value={$miscSettings.catalogVerticalStep}
          oninput={(e) =>
            updateMiscSetting('catalogVerticalStep', parseInt(e.currentTarget.value))}
        />
      </div>

      <Toggle
        checked={$miscSettings.catalogHideReadVolumes}
        onchange={(e) => updateMiscSetting('catalogHideReadVolumes', e.currentTarget.checked)}
      >
        Hide completed volumes in stack
      </Toggle>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        When enabled, only unread volumes appear in the stack
      </p>
    </div>
  </AccordionItem>
{/if}
