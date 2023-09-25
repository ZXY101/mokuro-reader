<script lang="ts">
  import { settings, updateAnkiSetting } from '$lib/settings';
  import { AccordionItem, Label, Toggle, Input } from 'flowbite-svelte';

  $: disabled = !$settings.ankiConnectSettings.enabled;

  let enabled = $settings.ankiConnectSettings.enabled;
  let cropImage = $settings.ankiConnectSettings.cropImage;
  let grabSentence = $settings.ankiConnectSettings.grabSentence;
  let overwriteImage = $settings.ankiConnectSettings.overwriteImage;

  let pictureField = $settings.ankiConnectSettings.pictureField;
  let sentenceField = $settings.ankiConnectSettings.sentenceField;
</script>

<AccordionItem>
  <span slot="header">Anki Connect</span>
  <div class="flex flex-col gap-5">
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
  </div>
</AccordionItem>
