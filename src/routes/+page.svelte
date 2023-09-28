<script lang="ts">
  import Catalog from '$lib/components/Catalog.svelte';
  import { createProfile, deleteProfile } from '$lib/settings';
  import { Button } from 'flowbite-svelte';

  function newProfile() {
    createProfile('New');
  }

  function Delete() {
    deleteProfile('New');
  }
</script>

<svelte:head>
  <title>Mokuro</title>
</svelte:head>

<div class="p-2 h-[90svh]">
  <Button on:click={newProfile}>New profile</Button>
  <Button on:click={Delete}>Delete</Button>
  <Catalog />
</div>
