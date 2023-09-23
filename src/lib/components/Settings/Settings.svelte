<script lang="ts">
  import { Drawer, CloseButton, Button, Accordion } from 'flowbite-svelte';
  import { UserSettingsSolid } from 'flowbite-svelte-icons';
  import { sineIn } from 'svelte/easing';
  import { resetSettings } from '$lib/settings';
  import { promptConfirmation } from '$lib/util';
  import AnkiConnectSettings from './AnkiConnectSettings.svelte';
  import ReaderSettings from './ReaderSettings.svelte';
  import Profiles from './Profiles.svelte';

  let transitionParams = {
    x: 320,
    duration: 200,
    easing: sineIn
  };

  export let hidden = true;

  function onReset() {
    hidden = true;
    promptConfirmation('Restore default settings?', resetSettings);
  }

  function onClose() {
    hidden = true;
  }
</script>

<Drawer
  placement="right"
  transitionType="fly"
  width="lg:w-1/4 md:w-1/2 w-full"
  {transitionParams}
  bind:hidden
  id="settings"
>
  <div class="flex items-center">
    <h5 id="drawer-label" class="inline-flex items-center mb-4 text-base font-semibold">
      <UserSettingsSolid class="w-4 h-4 mr-2.5" />Settings
    </h5>
    <CloseButton on:click={onClose} class="mb-4 dark:text-white" />
  </div>
  <div class="flex flex-col gap-5">
    <Accordion flush>
      <ReaderSettings />
      <AnkiConnectSettings />
      <Profiles />
    </Accordion>
    <div class="flex flex-col gap-2">
      <Button outline on:click={onReset}>Reset</Button>
      <Button outline on:click={onClose} color="light">Close</Button>
    </div>
  </div>
</Drawer>