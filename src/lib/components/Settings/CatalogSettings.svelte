<script lang="ts">
  import { AccordionItem, Button } from 'flowbite-svelte';
  import { db } from '$lib/catalog/db';
  import { promptConfirmation } from '$lib/util';
  import { clearVolumes } from '$lib/settings';
  import { nav } from '$lib/util/navigation';

  function onConfirm() {
    clearVolumes();
    // Clear all 4 tables in the v3 schema
    db.volumes.clear();
    db.volume_thumbnails.clear();
    db.volume_ocr.clear();
    db.volume_files.clear();
  }

  function onClear() {
    promptConfirmation('Are you sure you want to clear your catalog?', onConfirm);
    nav.toCatalog();
  }
</script>

<AccordionItem>
  {#snippet header()}Catalog settings{/snippet}
  <div class="flex flex-col">
    <Button onclick={onClear} outline color="red">Clear catalog</Button>
  </div>
</AccordionItem>
