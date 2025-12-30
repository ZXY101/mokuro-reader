<script lang="ts">
  import { page } from '$app/stores';
  import { settings, updateAnkiSetting } from '$lib/settings';
  import { AccordionItem, Helper, Input, Label, Select, Toggle } from 'flowbite-svelte';
  import { DYNAMIC_TAGS, DEFAULT_ANKI_TAGS } from '$lib/anki-connect';

  let disabled = $derived(!$settings.ankiConnectSettings.enabled);

  let enabled = $state($settings.ankiConnectSettings.enabled);
  let cropImage = $state($settings.ankiConnectSettings.cropImage);
  let grabSentence = $state($settings.ankiConnectSettings.grabSentence);
  let overwriteImage = $state($settings.ankiConnectSettings.overwriteImage);

  let pictureField = $state($settings.ankiConnectSettings.pictureField);
  let sentenceField = $state($settings.ankiConnectSettings.sentenceField);

  let heightField = $state($settings.ankiConnectSettings.heightField);
  let widthField = $state($settings.ankiConnectSettings.widthField);
  let qualityField = $state($settings.ankiConnectSettings.qualityField);

  let triggerMethod = $state($settings.ankiConnectSettings.triggerMethod);
  let ankiTags = $state($settings.ankiConnectSettings.tags);

  const triggerOptions = [
    { value: 'rightClick', name: 'Right click (long press on mobile)' },
    { value: 'doubleTap', name: 'Double tap' },
    { value: 'both', name: 'Both' },
    { value: 'neither', name: 'Neither' }
  ];

  function insertTag(tag: string) {
    ankiTags = ankiTags ? `${ankiTags} ${tag}`.trim() : tag;
    updateAnkiSetting('tags', ankiTags);
  }
</script>

<AccordionItem>
  {#snippet header()}Anki Connect{/snippet}
  <div class="flex flex-col gap-5">
    <Helper
      >For anki connect integration to work, you must add the reader (<code class="text-primary-500"
        >{$page.url.origin}</code
      >) to your anki connect <b class="text-primary-500">webCorsOriginList</b> list</Helper
    >
    <Helper>
      To trigger the anki connect integration, double click or right click (long press on mobile)
      any text box.
    </Helper>
    <div>
      <Toggle bind:checked={enabled} onchange={() => updateAnkiSetting('enabled', enabled)}
        >AnkiConnect Integration Enabled</Toggle
      >
    </div>
    <div>
      <Label class="text-gray-900 dark:text-white">Picture field:</Label>
      <Input
        {disabled}
        type="text"
        bind:value={pictureField}
        onchange={() => updateAnkiSetting('pictureField', pictureField)}
      />
    </div>
    <div>
      <Label class="text-gray-900 dark:text-white">Sentence field:</Label>
      <Input
        {disabled}
        type="text"
        bind:value={sentenceField}
        onchange={() => updateAnkiSetting('sentenceField', sentenceField)}
      />
    </div>
    <div>
      <Toggle
        {disabled}
        bind:checked={cropImage}
        onchange={() => updateAnkiSetting('cropImage', cropImage)}>Crop image</Toggle
      >
    </div>
    <div>
      <Toggle
        {disabled}
        bind:checked={overwriteImage}
        onchange={() => updateAnkiSetting('overwriteImage', overwriteImage)}>Overwrite image</Toggle
      >
    </div>
    <div>
      <Toggle
        {disabled}
        bind:checked={grabSentence}
        onchange={() => updateAnkiSetting('grabSentence', grabSentence)}>Grab sentence</Toggle
      >
    </div>
    <div>
      <Label class="text-gray-900 dark:text-white">
        Trigger method:
        <Select
          onchange={() => updateAnkiSetting('triggerMethod', triggerMethod)}
          items={triggerOptions}
          bind:value={triggerMethod}
        />
      </Label>
    </div>
    <div>
      <Label class="text-gray-900 dark:text-white">Tags:</Label>
      <Input
        {disabled}
        type="text"
        placeholder={DEFAULT_ANKI_TAGS}
        bind:value={ankiTags}
        onchange={() => updateAnkiSetting('tags', ankiTags)}
      />
      <div class="mt-2 flex flex-wrap gap-2">
        {#each DYNAMIC_TAGS as { tag, description }}
          <button
            type="button"
            {disabled}
            onclick={() => insertTag(tag)}
            class="inline-flex items-center rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            title={description}
          >
            {tag}
          </button>
        {/each}
      </div>
      <Helper class="mt-1">Click to insert. Spaces in names become underscores.</Helper>
    </div>
    <hr />
    <h4 class="text-gray-900 dark:text-white">Quality Settings</h4>
    <Helper>Allows you to customize the file size stored on your devices</Helper>
    <div>
      <Label class="text-gray-900 dark:text-white">Max Height (0 = Ignore; 200 Recommended):</Label>
      <Input
        {disabled}
        type="number"
        bind:value={heightField}
        onchange={() => {
          updateAnkiSetting('heightField', heightField);
          if (heightField < 0) heightField = 0;
        }}
        min={0}
      />
    </div>
    <div>
      <Label class="text-gray-900 dark:text-white">Max Width (0 = Ignore; 200 Recommended):</Label>
      <Input
        {disabled}
        type="number"
        bind:value={widthField}
        onchange={() => {
          updateAnkiSetting('widthField', widthField);
          if (widthField < 0) widthField = 0;
        }}
        min={0}
      />
    </div>
    <div>
      <Label class="text-gray-900 dark:text-white"
        >Quality (Between 0 and 1; 0.5 Recommended):</Label
      >
      <Input
        {disabled}
        type="number"
        bind:value={qualityField}
        onchange={() => updateAnkiSetting('qualityField', qualityField)}
        min={0}
        max={1}
        step="0.1"
      />
    </div>
  </div>
</AccordionItem>
