<script lang="ts">
  import { AccordionItem, Button } from 'flowbite-svelte';
  import { db } from '$lib/catalog/db';
  import { promptConfirmation } from '$lib/util';

  function onClear() {
    promptConfirmation('Are you sure you want to clear your catalog?', () => db.catalog.clear());
  }
</script>

<AccordionItem>
  <span slot="header">Catalog settings</span>
  <Button on:click={onClear} outline color="red">Clear catalog</Button>
</AccordionItem>
