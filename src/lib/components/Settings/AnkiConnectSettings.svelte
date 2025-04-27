<script lang="ts">
  import { page } from '$app/stores';
  import { settings, updateAnkiSetting } from '$lib/settings';
  import { AccordionItem, Label, Toggle, Input, Helper, Select } from 'flowbite-svelte';

  $: disabled = !$settings.ankiConnectSettings.enabled;

  let enabled = $settings.ankiConnectSettings.enabled;
  let cropImage = $settings.ankiConnectSettings.cropImage;
  let grabSentence = $settings.ankiConnectSettings.grabSentence;
  let overwriteImage = $settings.ankiConnectSettings.overwriteImage;

  let pictureField = $settings.ankiConnectSettings.pictureField;
  let sentenceField = $settings.ankiConnectSettings.sentenceField;

  let heightField = $settings.ankiConnectSettings.heightField;
  let widthField = $settings.ankiConnectSettings.widthField;
  let qualityField = $settings.ankiConnectSettings.qualityField;

  let triggerMethod = $settings.ankiConnectSettings.triggerMethod;

  const triggerOptions = [
    { value: 'rightClick', name: 'Right click (long press on mobile)' },
    { value: 'doubleTap', name: 'Double tap' },
    { value: 'both', name: 'Both' },
    { value: 'neither', name: 'Neither' }
  ];
</script>

<AccordionItem>
  <span slot="header">Anki Connect</span>
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
      <Toggle bind:checked={enabled} on:change={() => updateAnkiSetting('enabled', enabled)}
        >AnkiConnect Integration Enabled</Toggle
      >
    </div>
    <div>
      <Label>Picture field:</Label>
      <Input
        {disabled}
        type="text"
        bind:value={pictureField}
        on:change={() => updateAnkiSetting('pictureField', pictureField)}
      />
    </div>
    <div>
      <Label>Sentence field:</Label>
      <Input
        {disabled}
        type="text"
        bind:value={sentenceField}
        on:change={() => updateAnkiSetting('sentenceField', sentenceField)}
      />
    </div>
    <div>
      <Toggle
        {disabled}
        bind:checked={cropImage}
        on:change={() => updateAnkiSetting('cropImage', cropImage)}>Crop image</Toggle
      >
    </div>
    <div>
      <Toggle
        {disabled}
        bind:checked={overwriteImage}
        on:change={() => updateAnkiSetting('overwriteImage', overwriteImage)}
        >Overwrite image</Toggle
      >
    </div>
    <div>
      <Toggle
        {disabled}
        bind:checked={grabSentence}
        on:change={() => updateAnkiSetting('grabSentence', grabSentence)}>Grab sentence</Toggle
      >
    </div>
    <div>
      <Label>
        Trigger method:
        <Select
          on:change={() => updateAnkiSetting('triggerMethod', triggerMethod)}
          items={triggerOptions}
          bind:value={triggerMethod}
        />
      </Label>
    </div>
    <hr>
    <h4>Quality Settings</h4>
    <Helper>Allows you to customize the file size stored on your devices</Helper>
    <div>
      <Label>Max Height (0 = Ignore; 200 Recommended):</Label>
      <Input
        {disabled}
        type="number"
        bind:value={heightField}
        on:change={() => {updateAnkiSetting('heightField', heightField); if (heightField < 0) heightField = 0;}}
        min={0}
      />
    </div>
    <div>
      <Label>Max Width (0 = Ignore; 200 Recommended):</Label>
      <Input
        {disabled}
        type="number"
        bind:value={widthField}
        on:change={() => {updateAnkiSetting('widthField', widthField); if (widthField < 0) widthField = 0;}}
        min={0}
      />
    </div>
    <div>
      <Label>Quality (Between 0 and 1; 0.5 Recommended):</Label>
      <Input
        {disabled}
        type="number"
        bind:value={qualityField}
        on:change={() => updateAnkiSetting('qualityField', qualityField)}
      />
    </div>
  </div>
</AccordionItem>
