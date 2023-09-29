<script lang="ts">
  import { changeProfile, currentProfile, profiles } from '$lib/settings';

  import { AccordionItem, Button, Listgroup, Modal, Select } from 'flowbite-svelte';
  import ManageProfilesModal from './ManageProfilesModal.svelte';

  $: items = Object.keys($profiles).map((id) => {
    return { value: id, name: id };
  });

  let profile = $currentProfile;

  function onChange() {
    changeProfile(profile);
  }

  let manageModalOpen = false;
</script>

<ManageProfilesModal bind:open={manageModalOpen} />

<AccordionItem>
  <span slot="header">Profile</span>
  <div class="flex flex-col gap-5">
    <div class="flex flex-col gap-2">
      <Select {items} bind:value={profile} on:change={onChange} placeholder="Select profile ..." />
      <Button size="sm" outline color="dark" on:click={() => (manageModalOpen = true)}
        >Manage profiles</Button
      >
    </div>
  </div>
</AccordionItem>
