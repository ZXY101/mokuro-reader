<script lang="ts">
  import { db } from '$lib/catalog/db';
  import { changeProfile, currentProfile, profiles } from '$lib/settings';
  import { promptConfirmation } from '$lib/util';
  import { AccordionItem, Button, Select } from 'flowbite-svelte';

  $: items = Object.keys($profiles).map((id) => {
    return { value: id, name: id };
  });

  let profile = $currentProfile;

  function onChange() {
    changeProfile(profile);
  }

  function onClear() {
    promptConfirmation('Are you sure you want to clear your catalog?', () => db.catalog.clear());
  }
</script>

<AccordionItem>
  <span slot="header">Profile</span>
  <div class="flex flex-col gap-5">
    <div class="flex flex-col gap-2">
      <Select {items} bind:value={profile} on:change={onChange} />
      <Button size="sm" outline color="dark">Manage profiles</Button>
    </div>
    <Button on:click={onClear} outline color="red">Clear catalog</Button>
  </div>
</AccordionItem>
