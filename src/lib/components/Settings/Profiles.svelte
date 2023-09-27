<script lang="ts">
  import { db } from '$lib/catalog/db';
  import { promptConfirmation } from '$lib/util';
  import { AccordionItem, Button, Select } from 'flowbite-svelte';

  let profiles = [
    { value: 'default', name: 'Default' },
    { value: 'profile1', name: 'Profile 1' },
    { value: 'profile2', name: 'Porfile 2' }
  ];

  let profile = 'default';

  function onClear() {
    promptConfirmation('Are you sure you want to clear your catalog?', () => db.catalog.clear());
  }
</script>

<AccordionItem>
  <span slot="header">Profile</span>
  <div class="flex flex-col gap-5">
    <div class="flex flex-col gap-2">
      <Select items={profiles} value={profile} />
      <Button size="sm" outline color="dark">Manage profiles</Button>
    </div>
    <Button on:click={onClear} outline color="red">Clear catalog</Button>
  </div>
</AccordionItem>
