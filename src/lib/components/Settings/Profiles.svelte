<script lang="ts">
  import { AccordionItem, Button, Label, Select } from 'flowbite-svelte';

  let profiles = [
    { value: 'default', name: 'Default' },
    { value: 'profile1', name: 'Profile 1' },
    { value: 'profile2', name: 'Porfile 2' }
  ];

  let profile = 'default';
</script>

<AccordionItem>
  <span slot="header">Profile</span>
  <div class="flex flex-col gap-2">
    <Select items={profiles} value={profile} />
    <Button size="sm" outline color="dark">Manage profiles</Button>
  </div>
</AccordionItem>
